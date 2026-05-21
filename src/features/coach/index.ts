import CoachSidebar from './ui/CoachSidebar.vue'
import CoachSettings from './ui/CoachSettings.vue'
import CoachBook from './ui/CoachBook.vue'
import QualityIcon from './ui/QualityIcon.vue'

export { CoachSidebar, CoachSettings, CoachBook, QualityIcon }
export { useCoachStore } from './model/coach.store'
export { useCoachBookStore } from './model/coach-book.store'
export { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
