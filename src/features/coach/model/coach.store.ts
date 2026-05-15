import { useAnalysisEngineStore } from '@/entities/analysis'
import { useBoardStore } from '@/entities/game'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import { explainMoveAt, getTopMoves } from '@/shared/lib/engine/coach/analysis'
import { topConsequenceLine } from '@/shared/lib/engine/coach/connectors'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()
  const analysisEngineStore = useAnalysisEngineStore()

  const isCoachEnabled = ref(false)
  const isAnalyzing = ref(false)

  // State for "About Position"
  const currentExplanation = ref<Record<string, unknown> | null>(null)
  const previousExplanation = ref<Record<string, unknown> | null>(null)

  // State for "Top Moves"
  const topMoves = ref<Record<string, unknown>[]>([])
  const topMovesLoading = ref(false)

  // State for Mentor
  const isMentorLoading = ref(false)
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
  const lastMoveAnalysis = ref<Record<string, unknown> | null>(null)

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

      // For now, we don't draw arrows on the board as per user request.
      // This will be reactivated when blunder detection logic is implemented.
      /*
      if (
        explanation &&
        (explanation.principal_plan as any) &&
        (explanation.principal_plan as any).moves?.length > 0
      ) {
        const bestMove = (explanation.principal_plan as any).moves[0]
        if (bestMove.from && bestMove.to) {
          boardStore.setAutoShapes([
            {
              orig: bestMove.from as Key,
              dest: bestMove.to as Key,
              brush: 'green',
              modifiers: { lineWidth: 10 },
            },
          ])
        }
      } else {
        boardStore.setAutoShapes([])
      }
      */
      boardStore.setAutoShapes([])
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
      topMoves.value = (result as any).moves || []
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
  const selectedMoveExplanation = ref<Record<string, unknown> | null>(null)
  const selectedMoveExplanationLoading = ref(false)

  async function explainTopMove(move: { move: string }, index: number) {
    if (selectedMoveIndex.value === index) {
      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      return
    }
    selectedMoveIndex.value = index
    selectedMoveExplanationLoading.value = true
    try {
      const result = await explainMoveAt(boardStore.fen, move.move)
      selectedMoveExplanation.value = result as Record<string, unknown>
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
      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      triggerAnalysis(newFen)
    },
  )

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
      movingSide: previousExplanation.value.side_to_move as string,
      motifs: (lastMoveAnalysis.value.motifs as any[]) || [],
      evalSwingCp: ((currentExplanation.value.eval_cp as number) || 0) - ((previousExplanation.value.eval_cp as number) || 0),
    })
  })

  async function askMentor() {
    if (!currentExplanation.value || !currentExplanation.value.llm_payload) {
      logger.warn('[CoachStore] No LLM payload available to send to mentor.')
      return
    }

    const webhookUrl = import.meta.env.VITE_LLM_BRIDGE
    if (!webhookUrl) {
      logger.error('[CoachStore] VITE_LLM_BRIDGE webhook URL not defined in .env')
      return
    }

    try {
      isMentorLoading.value = true
      
      const payload = {
        ...currentExplanation.value.llm_payload,
        language: preferredLanguage.value,
      }
      
      logger.info('[CoachStore] Sending payload to Mentor via n8n...', payload)
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`)
      }

      const data = await response.json()
      
      if (data && data.output) {
        if ('speechSynthesis' in window) {
          // Cancel any ongoing speech
          window.speechSynthesis.cancel()
          
          const utterance = new SpeechSynthesisUtterance(data.output)
          
          // Basic language detection for TTS
          if (/[А-Яа-яЁё]/.test(data.output)) {
            utterance.lang = 'ru-RU'
          } else if (/[ÄäÖöÜüß]/.test(data.output)) {
            utterance.lang = 'de-DE'
          } else {
            utterance.lang = 'en-US'
          }

          // Optionally pick a specific Google voice if available
          const voices = window.speechSynthesis.getVoices()
          
          let preferredVoice = null
          if (preferredVoiceURI.value) {
            preferredVoice = voices.find(v => v.voiceURI === preferredVoiceURI.value)
          }
          
          if (!preferredVoice) {
            preferredVoice = voices.find(v => v.lang === utterance.lang && v.name.includes('Google'))
          }

          if (preferredVoice) {
            utterance.voice = preferredVoice
          }

          window.speechSynthesis.speak(utterance)
        } else {
          logger.warn('[CoachStore] Web Speech API is not supported in this browser.')
        }
      }

      logger.info('[CoachStore] Mentor successfully received the payload.')
    } catch (error) {
      logger.error('[CoachStore] Failed to send payload to Mentor:', error)
    } finally {
      isMentorLoading.value = false
    }
  }

  return {
    isCoachEnabled,
    isAnalyzing,
    isMentorLoading,
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
  }
})
