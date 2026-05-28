import { storeToRefs } from 'pinia'
import { useAutoplayStore } from '@/features/autoplay'

export function useTaskTodayAutoplay() {
  const autoplayStore = useAutoplayStore()
  const { isMo3ep, isAutoplayEnabled } = storeToRefs(autoplayStore)

  return {
    isMo3ep,
    isAutoplayEnabled,
  }
}
