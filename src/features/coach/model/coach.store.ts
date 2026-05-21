import { useAnalysisEngineStore } from '@/entities/analysis'
import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import { setEngineContext, getPieceCount, fetchTablebaseMoves } from '@/shared/lib/engine/coach/engine'
import { explainMoveAt, getTopMoves } from '@/shared/lib/engine/coach/analysis'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'
import { topConsequenceLine } from '@/shared/lib/engine/coach/connectors'
import { extractLlmPayload } from '@/shared/lib/engine/coach/llm-bridge'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { useCoachBookStore } from '../model/coach-book.store'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const analysisEngineStore = useAnalysisEngineStore()

  const isCoachEnabled = ref(false)
  const isAnalyzing = ref(false)

  // State for "About Position"
  const currentExplanation = ref<CoachExplanation | null>(null)
  const previousExplanation = ref<CoachExplanation | null>(null)

  // State for Visuals
  const showVisuals = ref(true)

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    if (showVisuals.value && currentExplanation.value?.visual_commands) {
      const commands = Object.values(currentExplanation.value.visual_commands).flat().join(';')
      if (commands) {
        executeMentorAction(commands)
      }
    } else if (!showVisuals.value) {
      boardStore.setCoachShapes([])
    }
  }

  // State for "Top Moves"
  const topMoves = ref<CoachTopMove[]>([])
  const topMovesLoading = ref(false)
  const tablebaseBestMove = ref<{
    san: string
    uci: string
    winner: string
    mateIn: number
    wdl: 'win' | 'loss'
  } | null>(null)

  // State for Mentor
  const isMentorLoading = ref(false)
  const isMentorSpeaking = ref(false)
  let mentorSessionId = 0
  const coachHistory = ref<{ fen: string; message: string }[]>([])

  // State for Chat Coach
  const chatSessionId = ref('')
  const chatMessages = ref<{ sender: 'user' | 'coach'; text: string; timestamp: Date }[]>([])
  const isChatLoading = ref(false)
  const sessionPuzzle = ref<Record<string, unknown> | null>(null)

  function initChatSession(puzzle?: Record<string, unknown>) {
    chatSessionId.value = window.crypto.randomUUID()
    chatMessages.value = []
    isChatLoading.value = false
    sessionPuzzle.value = puzzle || null
    logger.info('[CoachStore] New chat session initialized:', chatSessionId.value)
  }

  const preferredVoiceURI = ref<string>(localStorage.getItem('coachVoiceURI') || '')
  const preferredLanguage = ref<string>(localStorage.getItem('coachLanguage') || 'EN')

  function setPreferredVoiceURI(uri: string) {
    preferredVoiceURI.value = uri
    localStorage.setItem('coachVoiceURI', uri)
  }

  function setPreferredLanguage(lang: string) {
    preferredLanguage.value = lang
    localStorage.setItem('coachLanguage', lang)
  }

  // State for "Last Move"
  const lastMoveAnalysis = ref<CoachLastMoveAnalysis | null>(null)

  function toggleCoach() {
    isCoachEnabled.value = !isCoachEnabled.value
    if (!isCoachEnabled.value) {
      coachEngineManager.stop()
      currentExplanation.value = null
      previousExplanation.value = null
      topMoves.value = []
      lastMoveAnalysis.value = null
      boardStore.setCoachShapes([])
      coachHistory.value = []
      mentorCache.value.clear()
    } else {
      if (analysisEngineStore.isAnalysisActive) {
        logger.info('[CoachStore] Stopping deep analysis to start coach.')
        analysisEngineStore.stopAnalysis()
      }
      triggerAnalysis(boardStore.fen)
    }
  }

  function setCoachEnabled(enabled: boolean) {
    if (isCoachEnabled.value === enabled) return

    isCoachEnabled.value = enabled
    if (!enabled) {
      coachEngineManager.stop()
      currentExplanation.value = null
      previousExplanation.value = null
      topMoves.value = []
      lastMoveAnalysis.value = null
      boardStore.setCoachShapes([])
      coachHistory.value = []
      mentorCache.value.clear()
    } else {
      if (analysisEngineStore.isAnalysisActive) {
        logger.info('[CoachStore] Stopping deep analysis to start coach.')
        analysisEngineStore.stopAnalysis()
      }
      triggerAnalysis(boardStore.fen)
    }
  }

  // State for Takeback Modal
  const takebackModalVisible = ref(false)
  const takebackQuality = ref('')
  const isCoachIntervening = ref(false)
  let takebackResolve: ((value: boolean) => void) | null = null

  async function promptTakeback(quality: string): Promise<boolean> {
    takebackQuality.value = quality
    takebackModalVisible.value = true
    return new Promise((resolve) => {
      takebackResolve = resolve
    })
  }

  function resolveTakeback(takeback: boolean) {
    takebackModalVisible.value = false
    if (takebackResolve) {
      takebackResolve(takeback)
      takebackResolve = null
    }
  }

  async function triggerAnalysis(fen: string, isBotTurnFastCheck = false) {
    if (!fen) return
    isAnalyzing.value = true

    if (isBotTurnFastCheck) {
      // 1. Nur LastMoveAnalysis (explainMoveAt) laden
      await fetchLastMoveAnalysis()
      const quality = lastMoveAnalysis.value?.quality
      const isBadMove = quality && ['inaccuracy', 'mistake', 'blunder'].includes(quality)

      if (isBadMove) {
        isCoachIntervening.value = true
        // Halt den Bot auf (pausiert das Spiel, bis Takeback entschieden ist)
        gameStore.setGamePhase('IDLE')

        // Vollständige Analyse für die Visualisierung nachladen
        fetchTopMoves(fen)
        try {
          previousExplanation.value = currentExplanation.value || previousExplanation.value
          const explanation = await coachEngineManager.getExplanation(fen)
          currentExplanation.value = explanation

          if (showVisuals.value && explanation?.visual_commands) {
            const commands = Object.values(explanation.visual_commands).flat().join(';')
            if (commands) {
              executeMentorAction(commands)
            } else {
              boardStore.setCoachShapes([])
            }
          }
        } catch {
          logger.error('[CoachStore] Error generating explanation during fast check')
        } finally {
          isAnalyzing.value = false
        }

        // Asynchron auf die Entscheidung des Users warten
        setTimeout(async () => {
          const takeback = await promptTakeback(quality)
          if (takeback) {
            pgnService.undoLastMove() // Entfernt den Zug aus der Historie
            boardStore.syncBoardWithPgn() // Setzt die visuelle Anzeige zurück
            gameStore.setGamePhase('PLAYING')
            boardStore.setCoachShapes([])
          } else {
            // Bot soll doch ziehen
            gameStore.setGamePhase('PLAYING')
            await gameStore.triggerBotMove()
          }
          isCoachIntervening.value = false
        }, 100) // Timeout damit die SVG Pfeile vorher rendern

      } else {
        // Zug war in Ordnung! Abbruch, Bot einfach weitermachen lassen.
        isAnalyzing.value = false
        return
      }
    } else {
      // Normaler Ablauf (User ist am Zug)
      fetchTopMoves(fen)
      fetchLastMoveAnalysis()

      try {
        previousExplanation.value = currentExplanation.value || previousExplanation.value
        const explanation = await coachEngineManager.getExplanation(fen)
        currentExplanation.value = explanation

        if (showVisuals.value && explanation?.visual_commands) {
          const commands = Object.values(explanation.visual_commands).flat().join(';')
          if (commands) {
            executeMentorAction(commands)
          } else {
            boardStore.setCoachShapes([])
          }
        } else if (!showVisuals.value) {
          boardStore.setCoachShapes([])
        }
      } catch {
        logger.error('[CoachStore] Error generating explanation')
      } finally {
        isAnalyzing.value = false
      }
    }
  }

  async function fetchTopMoves(fen: string) {
    topMovesLoading.value = true
    tablebaseBestMove.value = null
    try {
      if (getPieceCount(fen) <= 5) {
        fetchTablebaseMoves(fen).then((moves) => {
          if (moves && moves.length > 0) {
            const bestMove = moves[0]
            if (bestMove) {
              const hasDtm = bestMove.checkmate || (bestMove.dtm !== null && bestMove.dtm !== undefined)
              if (hasDtm) {
                const sideToMove = fen.split(' ')[1] // 'w' or 'b'
                let winner = ''
                let mateIn = 0
                if (bestMove.checkmate) {
                  winner = sideToMove === 'w' ? 'White' : 'Black'
                  mateIn = 1
                } else if (bestMove.dtm !== null && bestMove.dtm !== undefined) {
                  const dtmVal = bestMove.dtm
                  if (dtmVal < 0) {
                    winner = sideToMove === 'w' ? 'White' : 'Black'
                  } else {
                    winner = sideToMove === 'w' ? 'Black' : 'White'
                  }
                  mateIn = Math.ceil(Math.abs(dtmVal) / 2)
                }

                if (winner && mateIn > 0) {
                  const userColor = boardStore.orientation.toLowerCase()
                  const wdl = winner.toLowerCase() === userColor ? 'win' : 'loss'
                  tablebaseBestMove.value = {
                    san: bestMove.san,
                    uci: bestMove.uci,
                    winner,
                    mateIn,
                    wdl
                  }
                  return
                }
              }
            }
          }
          tablebaseBestMove.value = null
        }).catch(() => {
          tablebaseBestMove.value = null
        })
      }
      const result = await getTopMoves(fen, 10)
      topMoves.value = result.moves || []
    } catch {
      logger.error('[CoachStore] Top moves failed')
    } finally {
      topMovesLoading.value = false
    }
  }

  async function fetchLastMoveAnalysis() {
    const lastNode = pgnService.getCurrentNode()

    if (!lastNode || !lastNode.parent || !lastNode.uci) {
      lastMoveAnalysis.value = null
      return
    }

    // We need the FEN *before* the move was played.
    const prevFen = lastNode.parent.fenAfter

    lastMoveAnalysis.value = { loading: true, san: lastNode.san }
    try {
      const r = await explainMoveAt(prevFen, lastNode.uci)
      lastMoveAnalysis.value = { ...r, loading: false }
    } catch {
      lastMoveAnalysis.value = null
    }
  }

  // Handle click on a top move in the UI to explain it
  const selectedMoveIndex = ref<number | null>(null)
  const selectedMoveExplanation = ref<CoachLastMoveAnalysis | null>(null)
  const selectedMoveExplanationLoading = ref(false)

  async function explainTopMove(move: { uci: string }, index: number) {
    if (selectedMoveIndex.value === index) {
      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      return
    }
    selectedMoveIndex.value = index
    selectedMoveExplanationLoading.value = true
    try {
      const result = await explainMoveAt(boardStore.fen, move.uci)
      selectedMoveExplanation.value = result
    } catch {
      logger.error('[CoachStore] Top Move Explanation failed')
    } finally {
      selectedMoveExplanationLoading.value = false
    }
  }

  // Watch the board's FEN and automatically ask the coach for insights if enabled.
  watch(
    () => boardStore.fen,
    (newFen) => {
      if (newFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        mentorCache.value.clear()
        coachHistory.value = []
      }

      if (!isCoachEnabled.value) return

      const isUserTurn = boardStore.turn === boardStore.orientation
      const isAnalysisMode = boardStore.isAnalysisModeActive

      setEngineContext(isAnalysisMode, boardStore.orientation)

      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null

      if (!isAnalysisMode && !isUserTurn) {
        // User hat gerade gezogen, Bot ist nun am Zug.
        // Führe den schnellen Coach-Check durch:
        triggerAnalysis(newFen, true)
      } else {
        // Normaler Analyse-Modus oder User ist am Zug
        triggerAnalysis(newFen, false)
      }
    },
  )

  // Mentor Caching
  const mentorCache = ref(new Map<string, string>())
  const hasCachedMentorResponse = computed(() => {
    const payload = currentExplanation.value?.llm_payload
    return !!payload?.fen && mentorCache.value.has(payload.fen as string)
  })

  // Watch deep analysis and disable coach if analysis starts
  watch(
    () => analysisEngineStore.isAnalysisActive,
    (isActive) => {
      if (isActive && isCoachEnabled.value) {
        logger.info('[CoachStore] Toggling off Coach because deep analysis started.')
        setCoachEnabled(false)
      }
    },
  )

  const lastMoveConsequence = computed(() => {
    if (!previousExplanation.value || !currentExplanation.value || !lastMoveAnalysis.value) return null
    if (lastMoveAnalysis.value.loading) return null

    return topConsequenceLine(previousExplanation.value, currentExplanation.value, {
      movingSide: previousExplanation.value.side_to_move,
      motifs: lastMoveAnalysis.value.motifs || [],
      evalSwingCp: (currentExplanation.value.eval_cp || 0) - (previousExplanation.value.eval_cp || 0),
    })
  })

  async function askMentor() {
    if (!currentExplanation.value || !currentExplanation.value.llm_payload) {
      logger.warn('[CoachStore] No LLM payload available to send to mentor.')
      return
    }

    const currentFen = currentExplanation.value.fen
    if (!currentFen) return

    // Check Cache
    if (mentorCache.value.has(currentFen)) {
      logger.info('[CoachStore] Replaying cached Mentor response for current position.')
      const cachedMsg = mentorCache.value.get(currentFen)!
      if (coachHistory.value[coachHistory.value.length - 1]?.fen !== currentFen) {
        coachHistory.value.push({ fen: currentFen, message: cachedMsg })
      }
      await playMentorResponse(cachedMsg)
      return
    }

    const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL
    if (!backendApiUrl) {
      logger.error('[CoachStore] VITE_BACKEND_API_URL not defined in .env')
      return
    }

    try {
      isMentorLoading.value = true
      const authStore = useAuthStore()
      const bookStore = useCoachBookStore()

      // Format book path nicely if available
      let formattedBookPath = ''
      const wikiInfo = bookStore.currentWikiInfo
      if (wikiInfo?.canonicalSanPath) {
        const formatted: string[] = []
        for (let i = 0; i < wikiInfo.canonicalSanPath.length; i++) {
          const move = wikiInfo.canonicalSanPath[i]
          if (!move) continue
          if (i % 2 === 0) {
            formatted.push(`${Math.floor(i / 2) + 1}. ${move}`)
          } else {
            formatted.push(move)
          }
        }
        formattedBookPath = formatted.join(' ')
      }

      const basePayload = {
        ...extractLlmPayload(currentExplanation.value, {
          lastMove: lastMoveAnalysis.value || undefined,
          consequence: lastMoveConsequence.value,
          book: wikiInfo ? {
            name: wikiInfo.name,
            eco: wikiInfo.eco,
            canonicalPathSan: formattedBookPath,
            isOutOfBook: bookStore.isOutOfBook,
            wikibooksUrl: wikiInfo.wikibooksUrl,
            wikibooksContent: wikiInfo.wikibooksContent,
            forwardMoves: wikiInfo.forwardMoves.map(m => ({ san: m.san, name: m.name }))
          } : {
            name: 'Unknown Opening',
            eco: '-',
            canonicalPathSan: '',
            isOutOfBook: bookStore.isOutOfBook,
            forwardMoves: []
          },
          userColor: boardStore.orientation,
          coachHistory: coachHistory.value,
          session_id: chatSessionId.value || undefined,
          session_puzzle: sessionPuzzle.value || undefined
        }),
        language: preferredLanguage.value,
      }

      const fullPayload = {
        payload: basePayload,
        profile: authStore.userProfile,
      }

      logger.info('[CoachStore] Sending payload to secure backend mentor proxy...', fullPayload)
      const response = await fetch(`${backendApiUrl}/coach/mentor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(fullPayload),
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`)
      }

      const data = await response.json()

      if (data && data.output) {
        // Cache the response
        mentorCache.value.set(currentFen, data.output)
        // Add to history
        if (coachHistory.value[coachHistory.value.length - 1]?.fen !== currentFen) {
          coachHistory.value.push({ fen: currentFen, message: data.output })
        }
        logger.info('[CoachStore] Mentor successfully received the payload and cached the response.')
        await playMentorResponse(data.output)
      }

    } catch (error) {
      logger.error('[CoachStore] Failed to send payload to Mentor:', error)
    } finally {
      isMentorLoading.value = false
    }
  }

  async function sendChatMessage(query?: string) {
    if (query) {
      chatMessages.value.push({
        sender: 'user',
        text: query,
        timestamp: new Date(),
      })
    }

    isChatLoading.value = true
    const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL

    try {
      if (!currentExplanation.value) {
        throw new Error('No analysis context available.')
      }

      const authStore = useAuthStore()
      const bookStore = useCoachBookStore()
      const wikiInfo = bookStore.currentWikiInfo

      let formattedBookPath = ''
      if (wikiInfo?.canonicalSanPath) {
        const formatted: string[] = []
        for (let i = 0; i < wikiInfo.canonicalSanPath.length; i++) {
          const move = wikiInfo.canonicalSanPath[i]
          if (!move) continue
          if (i % 2 === 0) {
            formatted.push(`${Math.floor(i / 2) + 1}. ${move}`)
          } else {
            formatted.push(move)
          }
        }
        formattedBookPath = formatted.join(' ')
      }

      const basePayload = {
        ...extractLlmPayload(currentExplanation.value, {
          lastMove: lastMoveAnalysis.value || undefined,
          consequence: lastMoveConsequence.value,
          book: wikiInfo ? {
            name: wikiInfo.name,
            eco: wikiInfo.eco,
            canonicalPathSan: formattedBookPath,
            isOutOfBook: bookStore.isOutOfBook,
            wikibooksUrl: wikiInfo.wikibooksUrl,
            wikibooksContent: wikiInfo.wikibooksContent,
            forwardMoves: wikiInfo.forwardMoves.map(m => ({ san: m.san, name: m.name }))
          } : {
            name: 'Unknown Opening',
            eco: '-',
            canonicalPathSan: '',
            isOutOfBook: bookStore.isOutOfBook,
            forwardMoves: []
          },
          userColor: boardStore.orientation,
          coachHistory: chatMessages.value.map(m => ({
            fen: boardStore.fen,
            message: `${m.sender === 'user' ? 'User' : 'Coach'}: ${m.text}`
          })),
          session_id: chatSessionId.value,
          session_puzzle: sessionPuzzle.value,
          question: query
        }),
        language: preferredLanguage.value,
      }

      const fullPayload = {
        payload: basePayload,
        profile: authStore.userProfile,
      }

      const response = await fetch(`${backendApiUrl}/coach/mentor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(fullPayload),
      })

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`)
      }

      const data = await response.json()
      if (data && data.output) {
        chatMessages.value.push({
          sender: 'coach',
          text: data.output,
          timestamp: new Date(),
        })
      } else {
        throw new Error('Empty response from LLM')
      }
    } catch (err: unknown) {
      logger.error('[CoachStore] Chat communication error:', err)
      chatMessages.value.push({
        sender: 'coach',
        text: `Entschuldigung, ich konnte keine Verbindung herstellen. Details: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date(),
      })
    } finally {
      isChatLoading.value = false
    }
  }

  async function playMentorResponse(output: string) {
    stopMentor() // Cancel any ongoing mentor session

    const currentId = ++mentorSessionId
    isMentorSpeaking.value = true

    if ('speechSynthesis' in window) {
      const parts = parseMentorActions(output)

      // Determine language and voice
      const firstText = parts.find(p => p.type === 'text')?.content || output
      let lang = 'en-US'
      if (/[А-Яа-яЁё]/.test(firstText)) lang = 'ru-RU'
      else if (/[ÄäÖöÜüß]/.test(firstText)) lang = 'de-DE'

      const voices = window.speechSynthesis.getVoices()
      let voice = preferredVoiceURI.value ? voices.find(v => v.voiceURI === preferredVoiceURI.value) : null
      if (!voice) {
        voice = voices.find(v => v.lang === lang && v.name.includes('Google')) || voices.find(v => v.lang === lang)
      }

      // Play sequence
      for (const part of parts) {
        if (currentId !== mentorSessionId) break

        if (part.type === 'text') {
          const text = part.content.trim()
          if (!text) continue

          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = lang
            if (voice) utterance.voice = voice

            utterance.onend = () => resolve()
            utterance.onerror = () => resolve()

            window.speechSynthesis.speak(utterance)
          })
        } else {
          executeMentorAction(part.content)
        }
      }

      if (currentId === mentorSessionId) {
        isMentorSpeaking.value = false
      }
    } else {
      logger.warn('[CoachStore] Web Speech API is not supported in this browser.')
    }
  }

  function stopMentor() {
    mentorSessionId++
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    boardStore.setCoachShapes([])
    isMentorSpeaking.value = false
  }

  function parseMentorActions(text: string) {
    const parts: { type: 'text' | 'action'; content: string }[] = []
    const regex = /\[([^\]]+)\]/g
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, match.index) })
      }
      if (match[1]) {
        parts.push({ type: 'action', content: match[1] })
      }
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIndex) })
    }

    return parts
  }

  function executeMentorAction(actionStr: string) {
    if (!actionStr) return

    const subActions = actionStr.split(';')
    const allShapes: DrawShape[] = []

    // Chessground standard brushes + safety (11 colors)
    const VALID_BRUSHES = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'gray', 'bestmove']

    for (const sub of subActions) {
      if (!sub.trim()) continue

      // Remove any brackets to prevent matching issues, then split
      const cleanSub = sub.replace(/[\[\]]/g, '').trim()
      const parts = cleanSub.split(':')
      const cmd = parts[0]?.trim()
      const data = parts[1]?.trim()

      let brush = parts[2]?.trim() || 'green'

      // Validation & Debugging
      if (!VALID_BRUSHES.includes(brush)) {
        logger.warn(`[CoachStore] Unknown brush detected: "${brush}" in command "${sub}". Falling back to green.`)
        brush = 'green'
      }

      // Map standard brushes to thin coach-specific brushes
      const coachBrush = brush === 'bestmove' ? 'bestmove' : `coach${brush}`

      if (cmd === 'clear') {
        boardStore.setCoachShapes([])
        return
      }

      if (!data) continue

      if (cmd === 'arrow' || cmd === 'route' || cmd === 'root') {
        const squares = data.split('->')
        for (let i = 0; i < squares.length - 1; i++) {
          const orig = squares[i]?.trim()
          const dest = squares[i + 1]?.trim()

          // Coordinate validation (must be e.g. "e4")
          if (orig && dest && orig.length === 2 && dest.length === 2) {
            allShapes.push({
              orig: orig as Key,
              dest: dest as Key,
              brush: coachBrush,
              modifiers: { lineWidth: 3 }
            })
          } else {
            logger.warn(`[CoachStore] Invalid coordinates for route: "${orig}" -> "${dest}"`)
          }
        }
      } else if (cmd === 'mark') {
        const squares = data.split(',')
        squares.forEach(sq => {
          const cleanSq = sq.trim()
          if (cleanSq && cleanSq.length === 2) {
            allShapes.push({
              orig: cleanSq as Key,
              brush: coachBrush
            })
          } else {
            logger.warn(`[CoachStore] Invalid coordinate for mark: "${cleanSq}"`)
          }
        })
      }
    }

    if (allShapes.length > 0) {
      // Sort shapes by color priority so the highest priority renders on top.
      const COLOR_PRIORITY: Record<string, number> = {
        coachgray: 0, coachbrown: 1, coachyellow: 2, coachgreen: 3, coachcyan: 4, coachblue: 5, coachpurple: 6, coachpink: 7, coachorange: 8, coachred: 9, bestmove: 10
      }
      allShapes.sort((a, b) => {
        const pA = COLOR_PRIORITY[a.brush as string] ?? -1
        const pB = COLOR_PRIORITY[b.brush as string] ?? -1
        return pA - pB
      })

      boardStore.setCoachShapes(allShapes)
    }
  }

  return {
    isCoachEnabled,
    isAnalyzing,
    isMentorLoading,
    isMentorSpeaking,
    chatSessionId,
    chatMessages,
    isChatLoading,
    sessionPuzzle,
    currentExplanation,
    previousExplanation,
    topMoves,
    topMovesLoading,
    tablebaseBestMove,
    lastMoveAnalysis,
    lastMoveConsequence,
    selectedMoveIndex,
    selectedMoveExplanation,
    selectedMoveExplanationLoading,
    toggleCoach,
    setCoachEnabled,
    explainTopMove,
    askMentor,
    initChatSession,
    sendChatMessage,
    preferredVoiceURI,
    preferredLanguage,
    setPreferredVoiceURI,
    setPreferredLanguage,
    stopMentor,
    hasCachedMentorResponse,
    showVisuals,
    toggleVisuals,
    executeMentorAction,
    takebackModalVisible,
    takebackQuality,
    resolveTakeback,
  }
})
