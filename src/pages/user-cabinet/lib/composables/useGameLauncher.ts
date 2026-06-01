import { usePuzzleStore } from '@/features/puzzle'
import type {
  GameLaunchOptions,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'

export function useGameLauncher() {
  const router = useRouter()
  const puzzleStore = usePuzzleStore()

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

    if (mode === 'finish_him' || mode === 'theory_endings' || mode === 'practical_chess' || mode === 'tactics') {
      const routeName = mode === 'finish_him'
        ? 'finish-him'
        : mode === 'theory_endings'
        ? 'theory-endings'
        : mode === 'practical_chess'
        ? 'practical-chess'
        : 'tactics'

      puzzleStore.loadNewPuzzle(mode, { category: theme, difficulty: targetDiff })
      router.push({ name: routeName })
      return
    }

    console.warn('[GameLauncher] Unknown mode:', mode)
  }

  return {
    launchGame,
  }
}
