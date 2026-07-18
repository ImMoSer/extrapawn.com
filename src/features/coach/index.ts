import CoachSidebar from './ui/CoachSidebar.vue'
import CoachSettings from './ui/CoachSettings.vue'
import QualityIcon from './ui/QualityIcon.vue'

export { CoachSidebar, CoachSettings, QualityIcon }
export { useCoachStore } from './model/coach.store'
export { useCoachFeedbackStore } from './model/coach-feedback.store'
export { waitForCoachAndCheckTakeback } from './model/coach-gameplay'
export { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
