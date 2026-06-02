import { storeToRefs } from 'pinia'
import { useCrashtestStore } from '@/features/crashtest'

export function useTaskTodayCrashtest() {
  const crashtestStore = useCrashtestStore()
  const { isMo3ep, isCrashtestEnabled } = storeToRefs(crashtestStore)

  return {
    isMo3ep,
    isCrashtestEnabled,
  }
}
