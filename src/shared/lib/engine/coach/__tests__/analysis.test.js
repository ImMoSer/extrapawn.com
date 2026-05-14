import { describe, it, expect, vi, beforeEach } from 'vitest'

// We mock the Stockfish singleton at module-load time so we never spawn
// a worker. The terminal-position branch in `getTopMoves` doesn't touch
// the engine — that's what these tests cover.
vi.mock('../engine.js', () => {
  const fakeEngine = {
    init: vi.fn(() => Promise.resolve()),
    evaluate: vi.fn(),
    analyzeMultiPV: vi.fn(),
    getBestMove: vi.fn(),
  }
  return {
    default: fakeEngine,
    getEngineDefaults: () => ({ depth: 12, multipv: 5 }),
    setEngineDefaults: vi.fn(),
  }
})

// Mock the WASM analyzer-rs so taglines.js / explainer.js can load
// without trying to instantiate WebAssembly.
vi.mock('../analyzer-rs.js', () => ({
  ensureReady: vi.fn(() => Promise.resolve(true)),
  isReady: vi.fn(() => false),
  analyzeMove: vi.fn(() => null),
  analyzePv: vi.fn(() => null),
  composeTagline: vi.fn(() => ({ tagline: '', motifs: [] })),
  evaluateFen: vi.fn(() => null),
  pieceContributionsForFen: vi.fn(() => null),
  pieceValueAt: vi.fn(() => null),
  explainPosition: vi.fn(() => null),
}))

const { getTopMoves } = await import('../analysis.js')

const CHECKMATE_FEN = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'

describe('getTopMoves — terminal-position short-circuit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 1-0 for a black-to-move checkmate (white wins)', async () => {
    // The classic Fool's Mate position: white is mated. Side-to-move = w
    // (checkmated), winner = black → expect "0-1".
    const r = await getTopMoves(CHECKMATE_FEN)
    expect(r.gameOver).toBe('checkmate')
    expect(r.result).toBe('0-1')
    expect(r.moves).toEqual([])
  })

  it('returns ½-½ for stalemate', async () => {
    const r = await getTopMoves(STALEMATE_FEN)
    expect(r.gameOver).toBe('stalemate')
    expect(r.result).toBe('½-½')
    expect(r.moves).toEqual([])
  })
})
