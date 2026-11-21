import type { PuzzlePuzzle } from '@/entities/game'
import {
  trainingApi,
  type PuzzleReportReasonCode,
  type ReportableTrainingDiscipline,
} from '@/entities/training'
import logger from '@/shared/lib/logger'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  verifyPuzzleForReport,
  type PuzzleVerificationResult,
  type VerificationProgress,
} from '../lib/puzzleReportVerifier'

export type PuzzleReportPhase =
  | 'form'
  | 'verifying'
  | 'valid'
  | 'suspicious_submitted'
  | 'error'

export const usePuzzleReportStore = defineStore('puzzleReport', () => {
  const isOpen = ref(false)
  const targetDiscipline = ref<ReportableTrainingDiscipline | null>(null)
  const targetPuzzle = ref<PuzzlePuzzle | null>(null)
  const selectedReasons = ref<PuzzleReportReasonCode[]>([])
  const comment = ref('')

  const phase = ref<PuzzleReportPhase>('form')
  const progress = ref<VerificationProgress | null>(null)
  const verificationResult = ref<PuzzleVerificationResult | null>(null)
  const errorMessage = ref<string | null>(null)
  const reportedPuzzleIds = ref<Set<string>>(new Set())

  let abortController: AbortController | null = null
  let beforeVerifyHook: (() => Promise<void>) | null = null

  const availableReasons = computed<PuzzleReportReasonCode[]>(() => {
    const puzzle = targetPuzzle.value
    if (!puzzle) return []
    if (puzzle.strategy === 'playOutOnly') {
      const primaryReason: PuzzleReportReasonCode =
        puzzle.objective === 'hold_draw' ? 'impossible_draw' : 'impossible_win'
      return [primaryReason, 'wrong_turn_or_color', 'other']
    }
    return ['wrong_solution', 'alternative_solution', 'position_unclear', 'other']
  })

  const canStartVerification = computed(
    () => phase.value === 'form' && selectedReasons.value.length > 0 && targetPuzzle.value !== null,
  )

  function isPuzzleReported(puzzleId?: string | null): boolean {
    if (!puzzleId) return false
    return reportedPuzzleIds.value.has(puzzleId)
  }

  function openModal(
    discipline: ReportableTrainingDiscipline,
    puzzle: PuzzlePuzzle,
    options?: { onBeforeVerify?: () => Promise<void> },
  ): void {
    abortActiveCheck()
    targetDiscipline.value = discipline
    targetPuzzle.value = puzzle
    selectedReasons.value = []
    comment.value = ''
    phase.value = 'form'
    progress.value = null
    verificationResult.value = null
    errorMessage.value = null
    beforeVerifyHook = options?.onBeforeVerify ?? null
    isOpen.value = true
  }

  function abortActiveCheck(): void {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  function closeModal(): void {
    abortActiveCheck()
    isOpen.value = false
    phase.value = 'form'
    progress.value = null
    errorMessage.value = null
  }

  function resetToForm(): void {
    abortActiveCheck()
    phase.value = 'form'
    progress.value = null
    verificationResult.value = null
    errorMessage.value = null
  }

  async function startVerification(): Promise<void> {
    const discipline = targetDiscipline.value
    const puzzle = targetPuzzle.value
    if (!discipline || !puzzle || selectedReasons.value.length === 0) return

    abortActiveCheck()
    const controller = new AbortController()
    abortController = controller

    phase.value = 'verifying'
    progress.value = null
    verificationResult.value = null
    errorMessage.value = null

    try {
      if (beforeVerifyHook) {
        await beforeVerifyHook()
      }
      if (controller.signal.aborted) return

      const result = await verifyPuzzleForReport(puzzle, {
        discipline,
        signal: controller.signal,
        onProgress: (p) => {
          if (!controller.signal.aborted) {
            progress.value = p
          }
        },
      })

      if (controller.signal.aborted) return
      verificationResult.value = result

      if (result.verdict === 'network_error') {
        errorMessage.value = result.errorMessage ?? 'Verification service unavailable'
        phase.value = 'error'
        return
      }

      if (result.verdict === 'valid') {
        // Valid puzzle: anti-spam gate rejects sending to backend
        phase.value = 'valid'
        return
      }

      // Suspicious puzzle confirmed by automated check -> submit report & quarantine immediately
      await trainingApi.submitPuzzleReport({
        discipline,
        puzzle_id: puzzle.puzzle_id,
        reasons: [...selectedReasons.value],
        comment: comment.value.trim(),
        verification_source: result.source,
        engine_depth: result.depth,
        engine_eval_cp: result.moverScore?.type === 'cp' ? result.moverScore.value : undefined,
        engine_mate: result.moverScore?.type === 'mate' ? result.moverScore.value : undefined,
        engine_wdl_win: result.wdl?.win,
        engine_wdl_draw: result.wdl?.draw,
        engine_wdl_loss: result.wdl?.loss,
        engine_best_move: result.engineBestMove,
        mismatch_ply: result.mismatchPly,
        tablebase_category: result.tablebaseCategory,
        solver_fen: result.solverFen,
      })

      const nextSet = new Set(reportedPuzzleIds.value)
      nextSet.add(puzzle.puzzle_id)
      reportedPuzzleIds.value = nextSet
      phase.value = 'suspicious_submitted'
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[PuzzleReportStore] Verification or submission failed:', msg)
      errorMessage.value = msg
      phase.value = 'error'
    } finally {
      if (abortController === controller) {
        abortController = null
      }
    }
  }

  return {
    isOpen,
    targetDiscipline,
    targetPuzzle,
    selectedReasons,
    comment,
    phase,
    progress,
    verificationResult,
    errorMessage,
    availableReasons,
    canStartVerification,
    isPuzzleReported,
    openModal,
    closeModal,
    resetToForm,
    startVerification,
  }
})
