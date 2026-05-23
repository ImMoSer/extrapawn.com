import { useWorkoutStore } from '@/features/workout'
import type {
  GameLaunchOptions,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'

export function useGameLauncher() {
  const router = useRouter()
  const workoutStore = useWorkoutStore()

  const launchGame = (options: GameLaunchOptions) => {
    const { mode, difficulty, theme } = options

    console.log('[GameLauncher] Launching:', options)

    const capitalizeDiff = (d: string): 'Novice' | 'Pro' | 'Master' => {
      const lower = d.toLowerCase()
      if (lower === 'pro') return 'Pro'
      if (lower === 'master') return 'Master'
      return 'Novice'
    }

    const targetDiff = capitalizeDiff(difficulty)

    // 1. FINISH HIM
    if (mode === 'finish_him') {
      workoutStore.loadNewPuzzle('finish_him', { category: theme, difficulty: targetDiff })
      router.push({ name: 'workout' })
      return
    }

    // 2. THEORY ENDINGS
    if (mode === 'theory_endings') {
      workoutStore.loadNewPuzzle('theory_endings', { category: theme, difficulty: targetDiff })
      router.push({ name: 'workout' })
      return
    }

    // 3. PRACTICAL CHESS
    if (mode === 'practical_chess') {
      workoutStore.loadNewPuzzle('practical_chess', { category: theme, difficulty: targetDiff })
      router.push({ name: 'workout' })
      return
    }

    // 4. TACTICS
    if (mode === 'tactics') {
      workoutStore.loadNewPuzzle('tactics', { category: theme, difficulty: targetDiff })
      router.push({ name: 'workout' })
      return
    }

    console.warn('[GameLauncher] Unknown mode:', mode)
  }

  return {
    launchGame,
  }
}
