import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
  TACTICS_CATEGORIES,
  type FrontendProfileStats,
  type GameModeProfileDto,
  type UserProfileStatsDto,
  type UserProfileStatEntry,
} from '@/shared/types/api.types'

const BASE_SUCCESS = 1
const BASE_REQUESTED = 2

function normalizeGameMode(
  statsArray: UserProfileStatEntry[],
  gameMode: string,
  subModeFilter: string | null,
  subModes: readonly string[],
  difficulties: readonly string[],
  categories: readonly string[],
  baseRating: number,
  highScores?: Record<string, number>,
): GameModeProfileDto {
  const modes: GameModeProfileDto['modes'] = {}

  for (const subMode of subModes) {
    modes[subMode] = {}
    for (const diff of difficulties) {
      modes[subMode][diff] = []

      for (const cat of categories) {
        const existing = statsArray.find(
          (s) =>
            s.game_mode === gameMode &&
            (subModeFilter === null || s.sub_mode === subModeFilter) &&
            s.difficulty === diff &&
            s.category === cat,
        )
        if (existing) {
          modes[subMode][diff].push({
            category: cat,
            rating: existing.rating || baseRating,
            success: existing.puzzles_solved + BASE_SUCCESS,
            requested: existing.puzzles_solved + existing.puzzles_failed + BASE_REQUESTED,
          })
        } else {
          modes[subMode][diff].push({
            category: cat,
            rating: baseRating,
            success: BASE_SUCCESS,
            requested: BASE_REQUESTED,
          })
        }
      }
      modes[subMode][diff].sort((a, b) => b.rating - a.rating)
    }
  }

  return {
    modes,
    highScores: highScores || {},
  }
}

export function normalizeProfileStats(
  apiStats: UserProfileStatsDto | undefined | null,
  baseRating: number = 1000,
): FrontendProfileStats {
  const statsArray = apiStats?.stats || []

  return {
    finish_him: normalizeGameMode(
      statsArray,
      'playPuzzle',
      'finish_him',
      ['win'],
      ['Novice', 'Pro', 'Master'],
      FINISH_HIM_CATEGORIES,
      baseRating,
    ),
    theory_endings: normalizeGameMode(
      statsArray,
      'playPuzzle',
      'theory_endings',
      ['win'],
      ['Novice', 'Pro', 'Master'],
      THEORY_ENDING_CATEGORIES,
      baseRating,
    ),
    practical_chess: normalizeGameMode(
      statsArray,
      'playPuzzle',
      'practical_chess',
      ['win'],
      ['Novice', 'Pro', 'Master'],
      PRACTICAL_CHESS_CATEGORIES,
      baseRating,
    ),
    tactics: normalizeGameMode(
      statsArray,
      'playPuzzle',
      'tactics',
      ['win'],
      ['Novice', 'Pro', 'Master'],
      TACTICS_CATEGORIES,
      baseRating,
    ),
  }
}

export function generateExampleStats(baseRating: number = 1500): FrontendProfileStats {
  const stats = normalizeProfileStats(null, baseRating)

  const applyVariety = (
    items: { category: string; rating: number; success: number; requested: number }[] | undefined,
    seed: number,
  ) => {
    if (!items) return
    items.forEach((item, index) => {
      const variance = ((index * seed) % 800) - 300
      item.rating = baseRating + variance
      item.requested = 20 + ((index * 7) % 100)
      const rate = 0.6 + ((index * 3) % 35) / 100
      item.success = Math.floor(item.requested * rate)
    })
    items.sort((a, b) => b.rating - a.rating)
  }

  let s = 13

  // Finish Him
  for (const diff of ['Novice', 'Pro', 'Master'] as const) {
    applyVariety(stats.finish_him.modes['win']?.[diff], s++)
  }

  // Theory
  for (const diff of ['Novice', 'Pro', 'Master'] as const) {
    applyVariety(stats.theory_endings.modes['win']?.[diff], s++)
  }

  // Practical
  for (const diff of ['Novice', 'Pro', 'Master'] as const) {
    applyVariety(stats.practical_chess.modes['win']?.[diff], s++)
  }

  // Tactics
  for (const diff of ['Novice', 'Pro', 'Master'] as const) {
    applyVariety(stats.tactics.modes['win']?.[diff], s++)
  }

  return stats
}
