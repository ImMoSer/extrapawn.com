import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import { CRASHTEST_ENGINES } from '@/shared/types/api.types'
import {
  resolveBotEngineForDifficulty,
  trainingApi,
  type AttemptResultDTO,
  type EndgameDomain,
  type HydratedSessionDTO,
  type HydratedSessionItem,
  type SessionSummaryDTO,
} from '@/entities/training'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'
import { useTrainingSessionStore } from '../model/trainingSession.store'

vi.mock('@/shared/lib/sound', () => ({
  soundService: {
    play: vi.fn(),
  },
  registerVolumeProvider: vi.fn(),
}))

function createSessionSummary(overrides: Partial<SessionSummaryDTO> = {}): SessionSummaryDTO {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    discipline: 'theoretical_endgames',
    mode: 'warmup',
    difficulty: 'Pro',
    bot_engine: 'maia-2200',
    focus_group: 'objective',
    focus_key: 'hold_draw',
    total_count: 2,
    current_index: 0,
    solved_count: 0,
    failed_count: 0,
    is_completed: false,
    started_at: '2026-11-01T15:00:00Z',
    updated_at: '2026-11-01T15:00:00Z',
    ...overrides,
  }
}

describe('training-session — Adapter, Bot Ladder & Session Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('resolves Bot Ladder strictly per rank tier ([D12])', () => {
    expect(resolveBotEngineForDifficulty('Novice')).toBe('maia-1500')
    expect(resolveBotEngineForDifficulty('Pro')).toBe('maia-2200')
    expect(resolveBotEngineForDifficulty('Master')).toBe('t1000')
  })

  it('adapts HydratedSessionItem accurately across tactics, finishhim, practical_chess, and theoretical_endgames', () => {
    // 1. Tactics (pure_calc uses cognitive_profile when motifs are empty)
    const tacItem: HydratedSessionItem = {
      index: 0,
      puzzle_id: 'TAC-001',
      is_woodpecker: true,
      woodpecker_streak: 2,
      status: 'pending',
      tactical: {
        puzzle_id: 'TAC-001',
        discipline: 'tactics',
        strategy: 'scenarioOnly',
        first_move: 'bot',
        user_color: 'white',
        difficulty: 'Master',
        phase: 'middlegame',
        length: 'long',
        goal: 'crushing',
        master_game: true,
        course_eligible: true,
        cognitive_profile: 'pure_calc',
        geometry_motifs: [],
        operator_motifs: [],
        concept_motifs: [],
        trigger_motifs: [],
        meta_themes: ['crushing'],
        tactical_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
        tactical_solution: 'g8f8 e1e8',
        rating: 2150,
        popularity: 92,
        nb_plays: 1400,
      },
    }
    const adaptedTac = adaptSessionItemToPuzzle('tactics', tacItem)
    expect(adaptedTac.strategy).toBe('scenarioOnly')
    expect(adaptedTac.category).toBe('pure_calc')
    expect(adaptedTac.initial_fen).toBe('6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1')
    expect(adaptedTac.is_woodpecker).toBe(true)
    expect(adaptedTac.woodpecker_streak).toBe(2)

    // 2. FinishHim uses tactical_fen as initial_fen and ending_fen as puzzle_fen!
    const fhItem: HydratedSessionItem = {
      index: 0,
      puzzle_id: 'FH-001',
      is_woodpecker: false,
      woodpecker_streak: 0,
      status: 'pending',
      endgame: {
        puzzle_id: 'FH-001',
        discipline: 'finishhim',
        ending_fen: '7k/8/6QK/8/8/8/8/8 w - - 2 2',
        tactical_fen: '6k1/8/5Q1K/8/8/8/8/8 w - - 0 1',
        tactical_solution: 'f6g6 g8h8',
        difficulty: 'Pro',
        ending_rating: 1620,
        effective_rating: 1710,
        pieces_count: 3,
        domain: 'QUEEN',
        class: 'queenEnding',
        strategy: 'scenarioPlus',
        first_move: 'user',
        user_color: 'white',
        objective: 'win',
      },
    }
    const adaptedFh = adaptSessionItemToPuzzle('finishhim', fhItem)
    expect(adaptedFh.strategy).toBe('scenarioPlus')
    expect(adaptedFh.initial_fen).toBe('6k1/8/5Q1K/8/8/8/8/8 w - - 0 1')
    expect(adaptedFh.puzzle_fen).toBe('7k/8/6QK/8/8/8/8/8 w - - 2 2')
    expect(adaptedFh.domain).toBe('QUEEN')

    // 3. Theoretical Endgames rejects EXTRA domain strictly ([D9] Fail-Fast)
    const illegalExtraItem: HydratedSessionItem = {
      index: 0,
      puzzle_id: 'TH-BAD',
      is_woodpecker: false,
      woodpecker_streak: 0,
      status: 'pending',
      endgame: {
        puzzle_id: 'TH-BAD',
        discipline: 'theoretical_endgames',
        ending_fen: '7k/5Q2/7K/8/8/8/8/8 w - - 0 1',
        difficulty: 'Novice',
        ending_rating: 1200,
        effective_rating: 1200,
        pieces_count: 3,
        domain: 'EXTRA' as EndgameDomain,
        class: 'extraPawn',
        strategy: 'playOutOnly',
        first_move: 'user',
        user_color: 'white',
        objective: 'win',
      },
    }
    expect(() => adaptSessionItemToPuzzle('theoretical_endgames', illegalExtraItem)).toThrow(
      /Forbidden EXTRA domain/,
    )
  })

  it('orchestrates Pro WarmUp session, auto-locks maia-2200, records single attempt, supports analysis, and builds Session Report', async () => {
    const store = useTrainingSessionStore()
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // Puzzle 1: Hold Draw via stalemate (Qf7->g6 stalemates Kh8)
    // Puzzle 2: Win via checkmate (Qf7->g7#)
    const sessionDto: HydratedSessionDTO = {
      session: createSessionSummary({
        difficulty: 'Pro',
        bot_engine: 'maia-2200',
        total_count: 2,
      }),
      items: [
        {
          index: 0,
          puzzle_id: 'TH-HOLD-1',
          is_woodpecker: true,
          woodpecker_streak: 2,
          status: 'pending',
          endgame: {
            puzzle_id: 'TH-HOLD-1',
            discipline: 'theoretical_endgames',
            ending_fen: '7k/5Q2/7K/8/8/8/8/8 w - - 0 1',
            difficulty: 'Pro',
            ending_rating: 1750,
            effective_rating: 1750,
            pieces_count: 3,
            domain: 'QUEEN',
            class: 'queenEnding',
            strategy: 'playOutOnly',
            first_move: 'user',
            user_color: 'white',
            objective: 'hold_draw',
          },
        },
        {
          index: 1,
          puzzle_id: 'TH-WIN-2',
          is_woodpecker: false,
          woodpecker_streak: 0,
          status: 'pending',
          endgame: {
            puzzle_id: 'TH-WIN-2',
            discipline: 'theoretical_endgames',
            ending_fen: '7k/5Q2/7K/8/8/8/8/8 w - - 0 1',
            difficulty: 'Pro',
            ending_rating: 1780,
            effective_rating: 1780,
            pieces_count: 3,
            domain: 'QUEEN',
            class: 'queenEnding',
            strategy: 'playOutOnly',
            first_move: 'user',
            user_color: 'white',
            objective: 'win',
          },
        },
      ],
    }

    vi.spyOn(trainingApi, 'composeWarmupSession').mockResolvedValue(sessionDto)
    vi.spyOn(trainingApi, 'getOverview').mockResolvedValue({
      user: {
        user_id: 'u1',
        last_solved_at: '2026-11-01T15:00:00Z',
        tactics_tier: 'Novice',
        theoretical_tier: 'Pro',
        practical_tier: 'Novice',
        finishhim_tier: 'Novice',
        woodpecker_mastered_total: 4,
      },
      bot_engines: {
        Novice: 'maia-1500',
        Pro: 'maia-2200',
        Master: 't1000',
      },
      disciplines: {
        tactics: {
          discipline: 'tactics',
          unlocked_tier: 'Novice',
          global_rating: 1500,
          global_rd: 350,
          ema_accuracy: 0.5,
          solved_total: 0,
          failed_total: 0,
          warmup_allowed_sizes: [50, 100, 200],
          course_batch_sizes: [25, 50, 100],
          default_course_batch: 50,
        },
        tactics_course: {
          discipline: 'tactics_course',
          unlocked_tier: 'Novice',
          global_rating: 1500,
          global_rd: 350,
          ema_accuracy: 0.5,
          solved_total: 0,
          failed_total: 0,
          warmup_allowed_sizes: [25, 50, 100],
          course_batch_sizes: [150, 3822],
          default_course_batch: 150,
        },
        theoretical_endgames: {
          discipline: 'theoretical_endgames',
          unlocked_tier: 'Pro',
          global_rating: 1740,
          global_rd: 120,
          ema_accuracy: 0.78,
          solved_total: 40,
          failed_total: 10,
          warmup_allowed_sizes: [10, 25, 50],
          course_batch_sizes: [10, 20, 30],
          default_course_batch: 20,
        },
        practical_chess: {
          discipline: 'practical_chess',
          unlocked_tier: 'Novice',
          global_rating: 1500,
          global_rd: 350,
          ema_accuracy: 0.5,
          solved_total: 0,
          failed_total: 0,
          warmup_allowed_sizes: [10, 25, 50],
          course_batch_sizes: [10, 20, 30],
          default_course_batch: 20,
        },
        finishhim: {
          discipline: 'finishhim',
          unlocked_tier: 'Novice',
          global_rating: 1500,
          global_rd: 350,
          ema_accuracy: 0.5,
          solved_total: 0,
          failed_total: 0,
          warmup_allowed_sizes: [10, 25, 50],
          course_batch_sizes: [10, 20, 30],
          default_course_batch: 20,
        },
      },
      woodpecker: {
        due_now: 1,
        on_cooldown: 0,
        mastered_total: 4,
        by_discipline: {
          tactics: { due_now: 0, on_cooldown: 0 },
          tactics_course: { due_now: 0, on_cooldown: 0 },
          theoretical_endgames: { due_now: 1, on_cooldown: 0 },
          practical_chess: { due_now: 0, on_cooldown: 0 },
          finishhim: { due_now: 0, on_cooldown: 0 },
        },
      },
    })

    const submitSpy = vi
      .spyOn(trainingApi, 'submitAttempt')
      .mockImplementation(async (_sessionId, payload): Promise<AttemptResultDTO> => {
        if (payload.puzzle_id === 'TH-HOLD-1') {
          return {
            puzzle_id: 'TH-HOLD-1',
            solved: payload.solved,
            global_rating_before: 1740,
            global_rating_after: 1752.4,
            global_rating_delta: 12.4,
            scope_deltas: [],
            woodpecker: { action: 'graduated', streak: 3 },
            session: createSessionSummary({
              current_index: 1,
              solved_count: 1,
              failed_count: 0,
              is_completed: false,
            }),
          }
        }
        return {
          puzzle_id: 'TH-WIN-2',
          solved: payload.solved,
          global_rating_before: 1752.4,
          global_rating_after: 1765.0,
          global_rating_delta: 12.6,
          scope_deltas: [],
          woodpecker: { action: 'none', streak: 0 },
          session: createSessionSummary({
            current_index: 2,
            solved_count: 2,
            failed_count: 0,
            is_completed: true,
          }),
          promoted_to_tier: 'Master',
        }
      })

    await store.startWarmupSession({
      discipline: 'theoretical_endgames',
      difficulty: 'Pro',
      count: 10,
      focus_group: 'objective',
      focus_key: 'hold_draw',
    })

    expect(store.viewState).toBe('playing')
    expect(gameStore.botEngineId).toBe('maia-2200')
    expect(store.activeBotEngine).toBe('maia-2200')
    expect(store.currentPuzzle?.objective).toBe('hold_draw')

    // Solve Puzzle 1 via FIDE stalemate (f7g6)
    await gameStore.handleUserMove('f7', 'g6')

    expect(submitSpy).toHaveBeenCalledTimes(1)
    expect(submitSpy.mock.calls[0]?.[1]).toMatchObject({
      puzzle_id: 'TH-HOLD-1',
      solved: true,
      first_move_failed: false,
      fail_stage: 'none',
    })
    expect(store.viewState).toBe('playing')
    expect(store.currentItem?.status).toBe('solved')

    // Enter board analysis, then exit to advance to Puzzle 2
    store.enterPuzzleAnalysis()
    expect(store.viewState).toBe('analyzing')
    expect(gameStore.gamePhase).toBe('ANALYSIS')

    store.exitPuzzleAnalysis()
    expect(store.viewState).toBe('playing')
    expect(store.currentItemIndex).toBe(1)
    expect(store.currentPuzzle?.puzzle_id).toBe('TH-WIN-2')
    expect(store.currentPuzzle?.objective).toBe('win')

    // Solve Puzzle 2 via checkmate (f7g7#)
    await gameStore.handleUserMove('f7', 'g7')

    expect(submitSpy).toHaveBeenCalledTimes(2)
    expect(store.promotionBannerTier).toBe('Master')
    expect(store.viewState).toBe('playing')

    // Advance after final puzzle -> transitions to Session Report!
    store.advanceAfterAttempt()
    expect(store.viewState).toBe('report')
    expect(store.sessionReportSummary).toMatchObject({
      totalCount: 2,
      solvedCount: 2,
      failedCount: 0,
      pendingCount: 0,
      accuracyPercent: 100,
      netGlobalRatingDelta: 25,
      woodpeckerCount: 1,
      woodpeckerSolvedCount: 1,
      woodpeckerGraduatedCount: 1,
    })
  })

  it('auto-advances on solved puzzle, pauses on failed puzzle in normal mode, and auto-advances on failed puzzle in Crashtest mode with selectable engines', async () => {
    vi.useFakeTimers()
    try {
      const store = useTrainingSessionStore()
      const gameStore = useGameStore()
      const boardStore = useBoardStore()
      const preferencesStore = usePreferencesStore()
      boardStore.animationDurationMs = 0

      // Verify the 3 Crashtest engines are registered
      expect(CRASHTEST_ENGINES).toEqual([
        'stockfish',
        'maia-2200',
        't1000',
      ])
      expect(preferencesStore.preferences.gameplay.crashtestEngine).toBe('stockfish')

      const sessionDto: HydratedSessionDTO = {
        session: createSessionSummary({
          discipline: 'tactics',
          difficulty: 'Novice',
          bot_engine: 'maia-1500',
          total_count: 3,
        }),
        items: [
          {
            index: 0,
            puzzle_id: 'TAC-1',
            is_woodpecker: false,
            woodpecker_streak: 0,
            status: 'pending',
            tactical: {
              puzzle_id: 'TAC-1',
              discipline: 'tactics',
              strategy: 'scenarioOnly',
              first_move: 'user',
              user_color: 'white',
              difficulty: 'Novice',
              phase: 'endgame',
              length: 'short',
              goal: 'mate',
              master_game: false,
              course_eligible: true,
              cognitive_profile: 'geometry_only',
              geometry_motifs: ['backRankMate'],
              operator_motifs: [],
              concept_motifs: [],
              trigger_motifs: [],
              meta_themes: ['mate'],
              tactical_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
              tactical_solution: 'e1e8',
              rating: 1200,
              popularity: 95,
              nb_plays: 500,
            },
          },
          {
            index: 1,
            puzzle_id: 'TAC-2',
            is_woodpecker: false,
            woodpecker_streak: 0,
            status: 'pending',
            tactical: {
              puzzle_id: 'TAC-2',
              discipline: 'tactics',
              strategy: 'scenarioOnly',
              first_move: 'user',
              user_color: 'white',
              difficulty: 'Novice',
              phase: 'endgame',
              length: 'short',
              goal: 'mate',
              master_game: false,
              course_eligible: true,
              cognitive_profile: 'geometry_only',
              geometry_motifs: ['backRankMate'],
              operator_motifs: [],
              concept_motifs: [],
              trigger_motifs: [],
              meta_themes: ['mate'],
              tactical_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
              tactical_solution: 'e1e8',
              rating: 1210,
              popularity: 95,
              nb_plays: 500,
            },
          },
          {
            index: 2,
            puzzle_id: 'TAC-3',
            is_woodpecker: false,
            woodpecker_streak: 0,
            status: 'pending',
            tactical: {
              puzzle_id: 'TAC-3',
              discipline: 'tactics',
              strategy: 'scenarioOnly',
              first_move: 'user',
              user_color: 'white',
              difficulty: 'Novice',
              phase: 'endgame',
              length: 'short',
              goal: 'mate',
              master_game: false,
              course_eligible: true,
              cognitive_profile: 'geometry_only',
              geometry_motifs: ['backRankMate'],
              operator_motifs: [],
              concept_motifs: [],
              trigger_motifs: [],
              meta_themes: ['mate'],
              tactical_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
              tactical_solution: 'e1e8',
              rating: 1220,
              popularity: 95,
              nb_plays: 500,
            },
          },
        ],
      }

      vi.spyOn(trainingApi, 'composeWarmupSession').mockResolvedValue(sessionDto)
      vi.spyOn(trainingApi, 'getOverview').mockResolvedValue({
        user: {
          user_id: 'u1',
          last_solved_at: '2026-11-01T15:00:00Z',
          tactics_tier: 'Novice',
          theoretical_tier: 'Pro',
          practical_tier: 'Novice',
          finishhim_tier: 'Novice',
          woodpecker_mastered_total: 4,
        },
        bot_engines: {
          Novice: 'maia-1500',
          Pro: 'maia-2200',
          Master: 't1000',
        },
        disciplines: {
          tactics: {
            discipline: 'tactics',
            unlocked_tier: 'Novice',
            global_rating: 1500,
            global_rd: 350,
            ema_accuracy: 0.5,
            solved_total: 0,
            failed_total: 0,
            warmup_allowed_sizes: [50, 100, 200],
            course_batch_sizes: [25, 50, 100],
            default_course_batch: 50,
          },
          tactics_course: {
            discipline: 'tactics_course',
            unlocked_tier: 'Novice',
            global_rating: 1500,
            global_rd: 350,
            ema_accuracy: 0.5,
            solved_total: 0,
            failed_total: 0,
            warmup_allowed_sizes: [25, 50, 100],
            course_batch_sizes: [150, 3822],
            default_course_batch: 150,
          },
          theoretical_endgames: {
            discipline: 'theoretical_endgames',
            unlocked_tier: 'Pro',
            global_rating: 1740,
            global_rd: 120,
            ema_accuracy: 0.78,
            solved_total: 40,
            failed_total: 10,
            warmup_allowed_sizes: [10, 25, 50],
            course_batch_sizes: [10, 20, 30],
            default_course_batch: 20,
          },
          practical_chess: {
            discipline: 'practical_chess',
            unlocked_tier: 'Novice',
            global_rating: 1500,
            global_rd: 350,
            ema_accuracy: 0.5,
            solved_total: 0,
            failed_total: 0,
            warmup_allowed_sizes: [10, 25, 50],
            course_batch_sizes: [10, 20, 30],
            default_course_batch: 20,
          },
          finishhim: {
            discipline: 'finishhim',
            unlocked_tier: 'Novice',
            global_rating: 1500,
            global_rd: 350,
            ema_accuracy: 0.5,
            solved_total: 0,
            failed_total: 0,
            warmup_allowed_sizes: [10, 25, 50],
            course_batch_sizes: [10, 20, 30],
            default_course_batch: 20,
          },
        },
        woodpecker: {
          due_now: 1,
          on_cooldown: 0,
          mastered_total: 4,
          by_discipline: {
            tactics: { due_now: 0, on_cooldown: 0 },
            tactics_course: { due_now: 0, on_cooldown: 0 },
            theoretical_endgames: { due_now: 1, on_cooldown: 0 },
            practical_chess: { due_now: 0, on_cooldown: 0 },
            finishhim: { due_now: 0, on_cooldown: 0 },
          },
        },
      })
      vi.spyOn(trainingApi, 'submitAttempt').mockImplementation(
        async (_sessionId, payload): Promise<AttemptResultDTO> => ({
          puzzle_id: payload.puzzle_id,
          solved: payload.solved,
          global_rating_before: 1500,
          global_rating_after: payload.solved ? 1510 : 1490,
          global_rating_delta: payload.solved ? 10 : -10,
          scope_deltas: [],
          woodpecker: { action: payload.solved ? 'none' : 'queued', streak: 0 },
          session: createSessionSummary({
            discipline: 'tactics',
            total_count: 3,
            current_index: payload.puzzle_id === 'TAC-1' ? 1 : payload.puzzle_id === 'TAC-2' ? 2 : 3,
            solved_count: payload.solved ? 1 : 0,
            failed_count: payload.solved ? 0 : 1,
            is_completed: payload.puzzle_id === 'TAC-3',
          }),
        }),
      )

      await store.startWarmupSession({
        discipline: 'tactics',
        difficulty: 'Novice',
        count: 50,
      })

      expect(store.currentItemIndex).toBe(0)

      // 1. Solve TAC-1 -> should stay in 'playing' (no 'awaiting_next' flash) and auto-advance to TAC-2 after nextPuzzleDelayMs (100ms)
      await gameStore.handleUserMove('e1', 'e8')
      expect(store.viewState).toBe('playing')
      expect(store.isAwaitingNext).toBe(false)
      vi.advanceTimersByTime(100)
      expect(store.viewState).toBe('playing')
      expect(store.currentItemIndex).toBe(1)
      expect(store.currentPuzzle?.puzzle_id).toBe('TAC-2')

      // 2. Fail TAC-2 in normal mode -> should pause in awaiting_next even after timer
      await gameStore.handleUserMove('e1', 'e2')
      expect(store.viewState).toBe('awaiting_next')
      expect(store.isAwaitingNext).toBe(true)
      expect(store.currentItem?.status).toBe('failed')
      vi.advanceTimersByTime(2000)
      expect(store.viewState).toBe('awaiting_next')
      expect(store.currentItemIndex).toBe(1)

      // Manually advance to TAC-3
      store.advanceAfterAttempt()
      expect(store.currentItemIndex).toBe(2)
      expect(store.currentPuzzle?.puzzle_id).toBe('TAC-3')

      // 3. Verify non-developer cannot enable global_crashtest or start Crash-Test session,
      //    but CAN configure unified nextPuzzleDelayMs across [0, 100, 500, 1000, 2000, 3000]
      const authStore = useAuthStore()
      authStore.userProfile = {
        id: 'other_user',
        username: 'OtherUser',
        base_puzzle_rating: 1500,
      }
      preferencesStore.preferences.gameplay.global_crashtest = true
      expect(preferencesStore.preferences.gameplay.global_crashtest).toBe(false)
      await preferencesStore.updatePreferences({ delays: { nextPuzzleDelayMs: 500 } })
      expect(preferencesStore.preferences.delays.nextPuzzleDelayMs).toBe(500)
      await expect(store.startCrashTestSession(false)).rejects.toThrow(/restricted to developer/)

      // 4. Enable Developer Crashtest (as developer mo3ep) with T1000 neural network and fail TAC-3 ->
      //    should auto-advance to Report after the unified nextPuzzleDelayMs (500ms), NOT crashtestDelayMs
      authStore.userProfile = {
        id: 'mo3ep',
        username: 'MO3EP',
        base_puzzle_rating: 2000,
      }
      await preferencesStore.updatePreferences({
        gameplay: { global_crashtest: true, crashtestEngine: 't1000' },
        delays: { crashtestDelayMs: 100, nextPuzzleDelayMs: 500 },
      })

      await gameStore.handleUserMove('e1', 'e2')
      expect(store.viewState).toBe('playing')
      expect(store.isAwaitingNext).toBe(false)
      vi.advanceTimersByTime(499)
      expect(store.viewState).toBe('playing')
      vi.advanceTimersByTime(1)
      expect(store.viewState).toBe('report')
    } finally {
      vi.useRealTimers()
    }
  })
})
