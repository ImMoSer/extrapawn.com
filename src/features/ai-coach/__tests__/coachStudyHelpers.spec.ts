import { describe, expect, it } from 'vitest'
import { buildChapterSanPathIndex } from '@/shared/lib/markdown/renderCoachMarkdown'
import { parseLichessChapterPgn } from '@/shared/lib/pgn/lichessPgnParser'
import { STANDARD_START_FEN } from '@/shared/lib/pgn/pgnTypes'
import {
  estimateTurnCostUsd,
  formatDisplayChapterTitle,
  mapPlayerTablebaseToSignal,
  type StudyTurnRecord,
} from '../model/coachStudy.types'
import {
  buildChapterFen4PathIndex,
  buildDiscussedPathsMap,
  buildMainlinePathPlyMap,
  extractFen4,
  formatStudyAnchorMoveLabel,
  isNodeOnMainline,
} from '../model/coachStudyCanvas'

function makeTurn(overrides: Partial<StudyTurnRecord>): StudyTurnRecord {
  return {
    id: 1,
    session_id: 's1',
    user_id: 'u1',
    chapter_id: 'c1',
    role: 'assistant',
    content: '',
    board_fen: STANDARD_START_FEN,
    board_actions: [],
    model_id: 'gemini-4-hydrogen',
    input_tokens: 0,
    cached_tokens: 0,
    output_tokens: 0,
    latency_ms: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('coachStudy v3 helpers', () => {
  it('strips redundant leading chapter numbers across RU/EN/DE titles', () => {
    expect(formatDisplayChapterTitle('Глава 1: Оппозиция и ключевые поля')).toBe(
      'Оппозиция и ключевые поля',
    )
    expect(formatDisplayChapterTitle('1. Глава 2 — Ладейный эндшпиль')).toBe('Ладейный эндшпиль')
    expect(formatDisplayChapterTitle('Chapter 3: Lucena Bridge')).toBe('Lucena Bridge')
    expect(formatDisplayChapterTitle('Kapitel 4: Philidor')).toBe('Philidor')
    expect(formatDisplayChapterTitle('W-манёвр коня')).toBe('W-манёвр коня')
  })

  it('estimates per-turn USD cost accurately for Hydrogen and Flash-Lite with cache discount', () => {
    const lite = estimateTurnCostUsd('gemini-3.5-flash-lite', 1000, 0, 100)
    expect(lite).toBeCloseTo(0.00055, 6)

    const cachedHydrogen = estimateTurnCostUsd('gemini-4-hydrogen', 5000, 4000, 200)
    // uncached 1000 * 1.5 + cached 4000 * 0.075 + out 200 * 7.5 = 1500 + 300 + 1500 = 3300 / 1e6
    expect(cachedHydrogen).toBeCloseTo(0.0033, 6)
  })

  it('maps PlayerTablebaseDTO preserving camelCase fideLost for coach_ai backend', () => {
    const sig = mapPlayerTablebaseToSignal({
      wdl: -1,
      dtm: -14,
      fideLost: true,
      source: 'gaviota',
    })
    expect(sig).toEqual({
      wdl: -1,
      dtm: -14,
      fideLost: true,
      source: 'gaviota',
    })
    expect(mapPlayerTablebaseToSignal(null)).toBeUndefined()
  })
})

describe('coachStudyCanvas bidirectional linking & anchor labels', () => {
  const samplePgn = '1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 3. Bb5? *'
  const parsed = parseLichessChapterPgn(samplePgn, STANDARD_START_FEN, 'white')

  it('extracts 4-field FEN cleanly ignoring move clocks', () => {
    expect(extractFen4('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -',
    )
    expect(extractFen4('')).toBe('')
  })

  it('formats anchor labels and detects side variation branches accurately', () => {
    const root = parsed.rootNode
    expect(formatStudyAnchorMoveLabel(root, root)).toEqual({ moveLabel: '', isBranch: false })

    const e4 = root.children[0]!
    const e5 = e4.children[0]!
    const c5 = e4.children[1]!
    const nf3 = e5.children[0]!
    const nc6 = nf3.children[0]!
    const bb5 = nc6.children[0]!

    expect(isNodeOnMainline(e5)).toBe(true)
    expect(isNodeOnMainline(c5)).toBe(false)
    expect(formatStudyAnchorMoveLabel(e4, root)).toEqual({ moveLabel: '1.e4', isBranch: false })
    expect(formatStudyAnchorMoveLabel(e5, root)).toEqual({ moveLabel: '1...e5', isBranch: false })
    expect(formatStudyAnchorMoveLabel(c5, root)).toEqual({ moveLabel: '1...c5', isBranch: true })
    expect(formatStudyAnchorMoveLabel(bb5, root)).toEqual({ moveLabel: '3.Bb5?', isBranch: false })
  })

  it('maps discussed PGN nodes cleanly without opening-citation or side-variation spam', () => {
    const root = parsed.rootNode
    const sanIndex = buildChapterSanPathIndex(root)
    const fen4Index = buildChapterFen4PathIndex(root)
    const mainlinePlies = buildMainlinePathPlyMap(root)

    const e4 = root.children[0]!
    const e5 = e4.children[0]!
    const nf3 = e5.children[0]!
    const nc6 = nf3.children[0]!

    const turns: StudyTurnRecord[] = [
      makeTurn({
        id: 10,
        role: 'user',
        content: 'А что если так?',
        board_fen: nc6.fenAfter,
      }),
      makeTurn({
        id: 11,
        role: 'assistant',
        content:
          'В начале `1.e4` `1...e5` (вариант `1...c5`), а ключевой момент — `3.Bb5??`[draw: Gb5c6].',
      }),
      makeTurn({
        id: 12,
        role: 'user',
        content: 'Давай обсудим `1...e5` подробнее.',
        board_fen: '',
      }),
    ]

    const discussed = buildDiscussedPathsMap(turns, sanIndex, fen4Index, root.fenAfter, mainlinePlies)

    const e4Path = sanIndex.get('1.e4')!
    const e5Path = sanIndex.get('1...e5')!
    const c5Path = sanIndex.get('1...c5')!
    const nc6Path = sanIndex.get('2...Nc6')!
    const bb5Path = sanIndex.get('3.Bb5')!

    // Assistant opening citation `1.e4` (ply 1) and side variation `1...c5` are skipped;
    // user explicit mention `1...e5` (turn 12), anchored user question `2...Nc6` (turn 10),
    // and assistant mainline ply 5 (`3.Bb5`) (turn 11) ARE mapped cleanly!
    expect(discussed.get(e4Path)).toBeUndefined()
    expect(discussed.get(c5Path)).toBeUndefined()
    expect(discussed.get(e5Path)).toBe(12)
    expect(discussed.get(nc6Path)).toBe(10)
    expect(discussed.get(bb5Path)).toBe(11)
  })
})
