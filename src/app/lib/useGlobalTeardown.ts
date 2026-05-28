import { useGameStore } from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import { useAnalysisStore } from '@/features/analysis'
import logger from '@/shared/lib/logger'

/**
 * Global Teardown Orchestrator
 * 
 * This service coordinates the cleanup of all stores (entities & features)
 * when switching between game modes or leaving the application.
 * 
 * It is placed in 'app' layer or 'shared' to allow importing from both 
 * entities and features without violating FSD boundaries.
 */
export function useGlobalTeardown() {
  const gameStore = useGameStore()
  const coachStore = useCoachStore()
  const analysisStore = useAnalysisStore()

  function triggerTeardown() {
    logger.info('[GlobalTeardown] Starting comprehensive cleanup.')
    
    // 1. Stop Game & Board (Entities)
    gameStore.stop()

    // 2. Reset Coach (Feature)
    coachStore.reset()

    // 3. Reset Analysis (Feature)
    analysisStore.resetAnalysisState()
    
    logger.info('[GlobalTeardown] Cleanup complete.')
  }

  return {
    triggerTeardown
  }
}
