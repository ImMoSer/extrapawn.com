import AnalysisPanel from './ui/AnalysisPanel.vue'
import QualityIcon from './ui/QualityIcon.vue'
import EvalBar from './ui/EvalBar.vue'
import VisualizerConsole from './ui/VisualizerConsole.vue'
import AboutPosition from './ui/AboutPosition.vue'
import FenInput from './ui/FenInput.vue'
import SettingsPanel from './ui/SettingsPanel.vue'

export {
  AnalysisPanel,
  QualityIcon,
  EvalBar,
  VisualizerConsole,
  AboutPosition,
  FenInput,
  SettingsPanel,
}

export { useCoachStore } from './model/coach.store'
export { useCoachFeedbackStore } from './model/coach-feedback.store'
export { useCoachOrchestratorStore, type MoveState, type PendingMoveInfo } from './model/coach-orchestrator.store'
export { waitForCoachAndCheckTakeback } from './model/coach-gameplay'
export { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'

