import { useEndgamesStore } from '@/features/endgames'
import { useTacticsStore } from '@/features/tactics'
import type {
  GameLaunchOptions,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'

export function useGameLauncher() {
  const router = useRouter()
  const endgamesStore = useEndgamesStore()
  const tacticsStore = useTacticsStore()

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
      endgamesStore.loadNewPuzzle('finish_him', { category: theme, difficulty: targetDiff })
      router.push({ name: 'endgames' })
      return
    }

    // 2. THEORY ENDINGS
    if (mode === 'theory_endings') {
      endgamesStore.loadNewPuzzle('theory_endings', { category: theme, difficulty: targetDiff })
      router.push({ name: 'endgames' })
      return
    }

    // 3. PRACTICAL CHESS
    if (mode === 'practical_chess') {
      endgamesStore.loadNewPuzzle('practical_chess', { category: theme, difficulty: targetDiff })
      router.push({ name: 'endgames' })
      return
    }

    // 4. TACTICS
    if (mode === 'tactics') {
      tacticsStore.loadNewPuzzle('tactics', { category: theme, difficulty: targetDiff })
      router.push({ name: 'tactics' })
      return
    }

    console.warn('[GameLauncher] Unknown mode:', mode)
  }

  return {
    launchGame,
  }
}
