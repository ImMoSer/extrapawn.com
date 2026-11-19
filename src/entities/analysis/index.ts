export { analysisService, countBoardPieces } from './api/AnalysisService'
export type { EvaluatedLineWithSan } from './api/AnalysisService'
export {
  buildLocalAnalysisShapes,
  classifyLocalEngineLines,
  classifyOutcomeBrush,
  computeExpectedScore,
  getLocalAnalysisSignature,
  getNagSymbolForQuality,
  getQualityTextClass,
} from './lib/localAnalysisVisuals'
export type {
  ClassifiedEngineLine,
  LocalAnalysisShape,
  LocalArrowOutcomeBrush,
  LocalEngineLineInput,
  LocalMarchBrush,
  LocalMoveQuality,
  LocalNagQuality,
  LocalScoreMoverPov,
  LocalWdlMoverPov,
  MarchStep,
} from './lib/localAnalysisVisuals'
export type {
  EngineDownloadProgress,
  EngineInitPhase,
  EngineLoadingState,
} from '@/shared/lib/engine'
