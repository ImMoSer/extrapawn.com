export { usePuzzleReportStore } from './model/puzzleReport.store'
export { default as PuzzleReportModal } from './ui/PuzzleReportModal.vue'
export {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  resolvePuzzleSolverFen,
  toUserPovEvaluation,
  toUserTablebaseCategory,
  verifyPuzzleForReport,
} from './lib/puzzleReportVerifier'
export type {
  PuzzleVerificationResult,
  VerificationProgress,
} from './lib/puzzleReportVerifier'
