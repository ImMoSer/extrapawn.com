import { useEndgameStore } from '@/features/endgames'
import type {
  GameLaunchOptions,
  TheoryEndingType,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'

export function useGameLauncher() {
  const router = useRouter()
  const endgameStore = useEndgameStore()

  const launchGame = (options: GameLaunchOptions) => {
    const { mode, subMode, difficulty, theme } = options

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
      endgameStore.setParams({ theme, difficulty: targetDiff })
      router.push({ name: 'finish-him-play' })
      return
    }

    // 2. THEORY ENDINGS
    if (mode === 'theory') {
      const targetMode = (subMode || 'win') as TheoryEndingType
      const targetDiff = capitalizeDiff(difficulty)

      endgameStore.setParams({ type: targetMode, difficulty: targetDiff, category: theme })

      router.push({
        name: 'theory-endings-play',
        params: { type: targetMode },
      })
      return
    }

    // 3. PRACTICAL CHESS
    if (mode === 'practical') {
      const targetDiff = capitalizeDiff(difficulty)

      endgameStore.setParams({ difficulty: targetDiff, category: theme })

      router.push({ name: 'practical-chess-play' })
      return
    }

    console.warn('[GameLauncher] Unknown mode:', mode)
  }

  return {
    launchGame,
  }
}
