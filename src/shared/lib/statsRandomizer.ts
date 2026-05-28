import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
  TACTICS_CATEGORIES,
  type FrontendProfileStats,
  type LeaderboardApiResponse,
  type UserSessionProfile,
  type UnifiedLeaderboardResponse,
  type UnifiedLeaderboardEntry,
} from '@/shared/types/api.types'

/**
 * Generiert eine Zufallszahl zwischen min und max inkl.
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Generiert ein zufälliges Benutzerprofil für die Beispiel-Ansicht.
 */
export function generateRandomUserProfile(): UserSessionProfile {
  const tiers: UserSessionProfile['subscriptionTier'][] = [
    'Pawn',
    'Knight',
    'Bishop',
    'Rook',
    'Queen',
    'King',
  ]
  const randomTier = tiers[getRandomInt(0, tiers.length - 1)]!
  const baseRating = getRandomInt(1200, 2200)

  return {
    id: 'example_user',
    username: 'ExtraPawnCOM',
    perfs: {
      blitz: {
        rating: baseRating + getRandomInt(-100, 100),
        prog: getRandomInt(-50, 50),
        games: getRandomInt(500, 5000),
      },
      rapid: {
        rating: baseRating + getRandomInt(-50, 150),
        prog: getRandomInt(-30, 30),
        games: getRandomInt(200, 3000),
      },
    },
    createdAt: Date.now() - 31536000000, // 1 year ago
    profile: {
      bio: 'Just an example user showing off the cabinet features.',
      location: 'Antigravity Workspace',
    },
    PawnCoins: getRandomInt(50, 1000),
    dailyLimit: 100,
    spentToday: getRandomInt(0, 50),
    base_puzzle_rating: baseRating,
    subscriptionTier: randomTier,
    TierExpire: null,
    validatedAt: Date.now(),
    today_activity: {
      puzzles_solved_today: {
        finish_him: getRandomInt(0, 20),
        theory: getRandomInt(0, 15),
        'practical-chess': getRandomInt(0, 10),
        total: 0, // Calculated below
      },
    },
    endgame_skill: baseRating + getRandomInt(-200, 200),
  }
}

/**
 * Generiert detaillierte Statistiken mit hoher Streuung für die RoseCharts.
 */
export function generateRandomDetailedStats(baseRating: number = 1500): FrontendProfileStats {
  const applyVariety = (categories: readonly string[]) => {
    return categories.map((category) => {
      // Big spread: -400 to +600 from base
      const rating = baseRating + getRandomInt(-400, 600)
      const requested = getRandomInt(10, 200)
      // Success rate between 40% and 98%
      const success = Math.floor(requested * (getRandomInt(40, 98) / 100))
      return { category, rating, success, requested }
    })
  }

  const theoryModes = (categories: readonly string[]) => ({
    Novice: applyVariety(categories),
    Pro: applyVariety(categories),
    Master: applyVariety(categories),
  })

  return {
    finish_him: {
      modes: {
        win: theoryModes(FINISH_HIM_CATEGORIES),
      },
    },
    theory_endings: {
      modes: {
        win: theoryModes(THEORY_ENDING_CATEGORIES),
      },
    },
    practical_chess: {
      modes: {
        win: theoryModes(PRACTICAL_CHESS_CATEGORIES),
      },
    },
    tactics: {
      modes: {
        win: theoryModes(TACTICS_CATEGORIES),
      },
    },
  }
}

/**
 * Generiert zufällige Hall of Fame Daten.
 */
export function generateRandomHallOfFame(): LeaderboardApiResponse {
  const usernames = [
    'ChessMaster',
    'KnightRider',
    'GambitPlayer',
    'CheckmateKing',
    'EnPassantExpert',
  ]
  const tiers: UserSessionProfile['subscriptionTier'][] = [
    'King',
    'Queen',
    'Rook',
    'Bishop',
    'Knight',
    'Pawn',
  ]

  const genThematic = (modes: string[]): UnifiedLeaderboardResponse => {
    const res: UnifiedLeaderboardResponse = {}

    modes.forEach((cat) => {
      const items: UnifiedLeaderboardEntry[] = Array.from({ length: 5 }, (_, i) => {
        const rating = getRandomInt(800, 2200)
        const solved = getRandomInt(10, 100)
        const failed = getRandomInt(2, 20)
        return {
          id: `user_${i}`,
          username: usernames[getRandomInt(0, usernames.length - 1)]!,
          training_status: 'N',
          current_streak: getRandomInt(0, 5),
          tier: tiers[getRandomInt(0, tiers.length - 1)]!,
          sub_mode: cat,
          maxRating: rating,
          avgRating: rating - getRandomInt(0, 100),
          score: rating + getRandomInt(0, 500),
          highScore: getRandomInt(10, 100),
          activeDays: getRandomInt(1, 30),
          solved,
          failed,
          accuracy: Number(((solved / (solved + failed)) * 100).toFixed(2)),
          totalAttempts: solved + failed + getRandomInt(0, 10),
          rank: (i + 1).toString(),
        }
      })

      items.sort((a, b) => b.solved - a.solved)
      items.forEach((item, index) => {
        item.rank = (index + 1).toString()
      })
      res[cat] = items
    })
    return res
  }

  const genOverallOld = () => {
    const items = Array.from({ length: 15 }, (_, i) => {
      const score = {
        finish_him: getRandomInt(100, 2000),
        theory: getRandomInt(100, 2000),
        practical: getRandomInt(100, 2000),
      }
      const solved = {
        finish_him: Math.floor(score.finish_him / 5),
        theory: Math.floor(score.theory / 3),
        practical: Math.floor(score.practical / 5),
      }
      const failed = {
        finish_him: getRandomInt(0, 10),
        theory: getRandomInt(0, 10),
        practical: getRandomInt(0, 10),
      }

      return {
        id: `user_${i}`,
        username: usernames[getRandomInt(0, usernames.length - 1)]! + '_' + i,
        training_status: 'N' as const,
        current_streak: getRandomInt(0, 20),
        tier: tiers[getRandomInt(0, tiers.length - 1)]! as string,
        score,
        solved,
        failed,
      }
    })

    return items.sort((a, b) => {
      const scoreA = Object.values(a.score).reduce((sum, val) => sum + val, 0)
      const scoreB = Object.values(b.score).reduce((sum, val) => sum + val, 0)
      return scoreB - scoreA
    })
  }

  const genStreaks = () => {
    const items = Array.from({ length: 10 }, (_, i) => {
      const streak = getRandomInt(5, 50)
      const baseSolved = streak * 50 + getRandomInt(100, 500)

      const modes = {
        finish_him: Math.floor(baseSolved * 0.2),
        theory: Math.floor(baseSolved * 0.2),
        'practical-chess': Math.floor(baseSolved * 0.2),
      }
      const total_solved = Object.values(modes).reduce((a, b) => a + b, 0)

      return {
        lichess_id: `user_streak_${i}`,
        username: usernames[getRandomInt(0, usernames.length - 1)]! + '_S' + i,
        current_streak: streak,
        subscriptionTier: tiers[getRandomInt(0, tiers.length - 1)]! as string,
        total_solved,
        solved_by_mode: modes,
      }
    })

    return items.sort((a, b) => b.current_streak - a.current_streak)
  }

  return {
    strategicLeaderboard: genThematic(['theory', 'practical-chess', 'finish_him']),
    overallLeaderboard: genThematic(['overall']),
    finishHimLeaderboard: genThematic(['Novice', 'Pro', 'Master']),
    theoryLeaderboard: genThematic(['Novice', 'Pro', 'Master']),
    practicalLeaderboard: genThematic(['Novice', 'Pro', 'Master']),
    overallSkillLeaderboard: {
      period: 30,
      entries: genOverallOld(),
    },
    skillStreakLeaderboard: genStreaks(),
    topTodayLeaderboard: {
      period: 'heute',
      entries: genOverallOld(),
    },
  }
}
