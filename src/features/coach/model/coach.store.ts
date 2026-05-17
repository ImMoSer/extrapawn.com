import { useAnalysisEngineStore } from '@/entities/analysis'
import { useBoardStore, useGameStore } from '@/entities/game'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import { explainMoveAt, getTopMoves } from '@/shared/lib/engine/coach/analysis'
import { topConsequenceLine } from '@/shared/lib/engine/coach/connectors'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { extractLlmPayload } from '@/shared/lib/engine/coach/llm-bridge'
import { useAuthStore } from '@/entities/user'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'

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

  const isVisualsSuppressed = ref(false)

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    if (showVisuals.value && !isVisualsSuppressed.value && currentExplanation.value?.visual_commands) {
      const commands = Object.values(currentExplanation.value.visual_commands).join(';')
      if (commands) {
        executeMentorAction(commands)
      }
    } else if (!showVisuals.value || isVisualsSuppressed.value) {
      boardStore.setAutoShapes([])
    }
  }

  // State for "Top Moves"
  const topMoves = ref<CoachTopMove[]>([])
  const topMovesLoading = ref(false)

  // State for Mentor
  const isMentorLoading = ref(false)
  const isMentorSpeaking = ref(false)
  let mentorSessionId = 0

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
      boardStore.setAutoShapes([])
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
      boardStore.setAutoShapes([])
    } else {
      if (analysisEngineStore.isAnalysisActive) {
        logger.info('[CoachStore] Stopping deep analysis to start coach.')
        analysisEngineStore.stopAnalysis()
      }
      triggerAnalysis(boardStore.fen)
    }
  }

  async function triggerAnalysis(fen: string) {
    if (!fen) return
    isAnalyzing.value = true

    // We launch Top Moves and the Full Explanation concurrently.
    fetchTopMoves(fen)
    fetchLastMoveAnalysis()

    try {
      // Capture the current explanation before overwriting it
      previousExplanation.value = currentExplanation.value || previousExplanation.value
      const explanation = await coachEngineManager.getExplanation(fen)
      currentExplanation.value = explanation

      // Render pre-calculated visual commands immediately
      // Only if visuals are enabled AND not suppressed by another module (like MozerBook)
      if (showVisuals.value && !isVisualsSuppressed.value && explanation?.visual_commands) {
        // Flatten values in case some are arrays (e.g. diagonals) and join by ';'
        const commands = Object.values(explanation.visual_commands).flat().join(';')
        if (commands) {
          executeMentorAction(commands)
        } else {
          boardStore.setAutoShapes([])
        }
      } else if (!showVisuals.value) {
        // Only clear if coach visuals are disabled.
        // If they are just suppressed, we don't clear to avoid wiping other module's arrows.
        boardStore.setAutoShapes([])
      }
    } catch {
      logger.error('[CoachStore] Error generating explanation')
    } finally {
      isAnalyzing.value = false
    }
  }

  async function fetchTopMoves(fen: string) {
    topMovesLoading.value = true
    try {
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
      if (!isCoachEnabled.value) return
      
      // Optimization: Only analyze during live play if it's the user's turn.
      // In Analysis/Review mode, we always analyze to provide full feedback.
      const isUserTurn = boardStore.turn === boardStore.orientation
      const isAnalysisMode = boardStore.isAnalysisModeActive
      
      if (!isAnalysisMode && !isUserTurn) {
        logger.info('[CoachStore] Skipping analysis because it is the opponent\'s turn.')
        return
      }

      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      triggerAnalysis(newFen)
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

  // Watch for game loading or resetting to sleep the coach
  watch(
    () => gameStore.gamePhase,
    (newPhase) => {
      if (newPhase === 'LOADING' || newPhase === 'IDLE') {
        logger.info(`[CoachStore] Game phase changed to ${newPhase}, putting coach to sleep.`)
        setCoachEnabled(false)
      }
    }
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
      await playMentorResponse(mentorCache.value.get(currentFen)!)
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
      
      const basePayload = {
        ...extractLlmPayload(currentExplanation.value, {
          lastMove: lastMoveAnalysis.value || undefined,
          consequence: lastMoveConsequence.value
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
        logger.info('[CoachStore] Mentor successfully received the payload and cached the response.')
        await playMentorResponse(data.output)
      }

    } catch (error) {
      logger.error('[CoachStore] Failed to send payload to Mentor:', error)
    } finally {
      isMentorLoading.value = false
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
    boardStore.setAutoShapes([])
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
    
    // Chessground standard brushes + safety (10 colors)
    const VALID_BRUSHES = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'gray']
    
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

      if (cmd === 'clear') {
        boardStore.setAutoShapes([])
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
              brush,
              modifiers: { lineWidth: 8 }
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
              brush
            })
          } else {
            logger.warn(`[CoachStore] Invalid coordinate for mark: "${cleanSq}"`)
          }
        })
      }
    }

    if (allShapes.length > 0 && !isVisualsSuppressed.value) {
      // Sort shapes by color priority so the highest priority renders on top.
      const COLOR_PRIORITY: Record<string, number> = { 
        gray: 0, brown: 1, yellow: 2, green: 3, cyan: 4, blue: 5, purple: 6, pink: 7, orange: 8, red: 9 
      }
      allShapes.sort((a, b) => {
        const pA = COLOR_PRIORITY[a.brush as string] ?? -1
        const pB = COLOR_PRIORITY[b.brush as string] ?? -1
        return pA - pB
      })

      boardStore.setAutoShapes(allShapes)
    }
  }

  return {
    isCoachEnabled,
    isAnalyzing,
    isMentorLoading,
    isMentorSpeaking,
    currentExplanation,
    previousExplanation,
    topMoves,
    topMovesLoading,
    lastMoveAnalysis,
    lastMoveConsequence,
    selectedMoveIndex,
    selectedMoveExplanation,
    selectedMoveExplanationLoading,
    toggleCoach,
    setCoachEnabled,
    explainTopMove,
    askMentor,
    preferredVoiceURI,
    preferredLanguage,
    setPreferredVoiceURI,
    setPreferredLanguage,
    stopMentor,
    hasCachedMentorResponse,
    showVisuals,
    toggleVisuals,
    isVisualsSuppressed,
    executeMentorAction,
  }
})
