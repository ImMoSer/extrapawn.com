import { useFinishHimStore } from '@/features/finish-him'
import { usePracticalChessStore } from '@/features/practical-chess'
import { useTheoryEndingsStore } from '@/features/theory-endings'
import type {
  FinishHimTheme,
  GameLaunchOptions,
  PracticalChessCategory,
  TheoryEndingCategory,
  TheoryEndingType,
  TornadoMode,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'

export function useGameLauncher() {
  const router = useRouter()
  const finishHimStore = useFinishHimStore()
  const theoryStore = useTheoryEndingsStore()
  const practicalStore = usePracticalChessStore()

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
      finishHimStore.setParams(theme as FinishHimTheme, targetDiff)
      router.push({ name: 'finish-him-play' })
      return
    }

    // 2. THEORY ENDINGS
    if (mode === 'theory') {
      const targetMode = (subMode || 'win') as TheoryEndingType
      const targetDiff = capitalizeDiff(difficulty)

      theoryStore.setParams(targetMode, targetDiff, theme as TheoryEndingCategory)

      router.push({
        name: 'theory-endings-play',
        params: { type: targetMode },
      })
      return
    }

    // 3. PRACTICAL CHESS
    if (mode === 'practical') {
      const targetDiff = capitalizeDiff(difficulty)

      practicalStore.selectDifficulty(targetDiff)
      practicalStore.selectCategory(theme as PracticalChessCategory)

      router.push({ name: 'practical-chess-play' })
      return
    }

    // 4. TORNADO
    if (mode === 'tornado') {
      const targetMode = (subMode || 'blitz') as TornadoMode

      router.push({
        name: 'tornado',
        params: { mode: targetMode },
        query: theme ? { theme } : {},
      })
      return
    }

    console.warn('[GameLauncher] Unknown mode:', mode)
  }

  return {
    launchGame,
  }
}
