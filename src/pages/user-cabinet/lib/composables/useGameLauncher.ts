import { useEndgameStore } from '@/features/endgames'
import type {
  GameLaunchOptions,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'

export function useGameLauncher() {
  const router = useRouter()
  const endgameStore = useEndgameStore()

  const launchGame = (options: GameLaunchOptions) => {
    const { mode, difficulty, theme } = options

    console.log('[GameLauncher] Launching:', options)

    const capitalizeDiff = (d: string): 'Novice' | 'Pro' | 'Master' => {
      const lower = d.toLowerCase()
      if (lower === 'pro') return 'Pro'
      if (lower === 'master') return 'Master'
      return 'Novice'
    }

    // 1. FINISH HIM
    if (mode === 'finish_him') {
      const targetDiff = capitalizeDiff(difficulty)
      endgameStore.setParams({ category: theme, difficulty: targetDiff })
      router.push({ name: 'finish-him-play' })
      return
    }

    // 2. THEORY ENDINGS
    if (mode === 'theory_endings') {
      const targetDiff = capitalizeDiff(difficulty)

      endgameStore.setParams({ difficulty: targetDiff, category: theme })

      router.push({
        name: 'theory-endings-play',
      })
      return
    }

    // 3. PRACTICAL CHESS
    if (mode === 'practical_chess') {
      const targetDiff = capitalizeDiff(difficulty)

      endgameStore.setParams({ difficulty: targetDiff, category: theme })

      router.push({ name: 'practical-chess-play' })
      return
    }

    // 4. TACTICS
    if (mode === 'tactics') {
      const targetDiff = capitalizeDiff(difficulty)
      endgameStore.setParams({ category: theme, difficulty: targetDiff })
      // Assuming there is a tactics-play route, but standardizing to the generic loader if needed.
      // For now, let's assume it might use a specific one or the endgame store can handle it.
      // Based on previous code, tactics might use finish-him-play or similar, but let's check.
      // Actually, endgameStore.loadNewPuzzle handles 'tactics'.
      router.push({ name: 'finish-him-play' }) // Redirecting to finish-him for now as it handles all endgame-store puzzles
      return
    }

    console.warn('[GameLauncher] Unknown mode:', mode)
  }

  return {
    launchGame,
  }
}
