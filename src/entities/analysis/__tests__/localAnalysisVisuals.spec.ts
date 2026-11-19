import { describe, expect, it } from 'vitest'
import {
  buildLocalAnalysisShapes,
  classifyLocalEngineLines,
  classifyOutcomeBrush,
  computeExpectedScore,
  getLocalAnalysisSignature,
  getNagSymbolForQuality,
  type LocalEngineLineInput,
} from '../lib/localAnalysisVisuals'

describe('localAnalysisVisuals', () => {
  it('classifies outcome brush strictly from side-to-move POV using WDL, mate, and cp fallback', () => {
    // Winning WDL for side to move
    expect(classifyOutcomeBrush({ type: 'cp', value: 120 }, { win: 620, draw: 370, loss: 10 })).toBe('green')
    // Drawn / equal WDL
    expect(classifyOutcomeBrush({ type: 'cp', value: 15 }, { win: 80, draw: 860, loss: 60 })).toBe('blue')
    // Losing WDL for side to move
    expect(classifyOutcomeBrush({ type: 'cp', value: -140 }, { win: 10, draw: 340, loss: 650 })).toBe('red')
    // Mate scores (positive = mover mates, negative = mover gets mated)
    expect(classifyOutcomeBrush({ type: 'mate', value: 3 })).toBe('green')
    expect(classifyOutcomeBrush({ type: 'mate', value: -2 })).toBe('red')
    // CP fallback without WDL
    expect(classifyOutcomeBrush({ type: 'cp', value: 150 })).toBe('green')
    expect(classifyOutcomeBrush({ type: 'cp', value: 0 })).toBe('blue')
    expect(classifyOutcomeBrush({ type: 'cp', value: -150 })).toBe('red')
  })

  it('computes expected score W + 0.5*D so only-move saving draws get Great (!) and losing alternatives get Blunder (??)', () => {
    // Black to move: Kf7 holds draw (W=0, D=1000, L=0 -> E=50), Kh8 loses (W=0, D=0, L=1000 -> E=0)
    const fenBlackToMove = '6k1/8/5KP1/8/8/8/8/8 b - - 0 1'
    const lines: LocalEngineLineInput[] = [
      {
        id: 1,
        depth: 16,
        moverScore: { type: 'cp', value: 0 },
        wdl: { win: 0, draw: 1000, loss: 0 },
        pvUci: ['g8f8', 'g6g7', 'f8g8'],
      },
      {
        id: 2,
        depth: 16,
        moverScore: { type: 'mate', value: -8 },
        wdl: { win: 0, draw: 0, loss: 1000 },
        pvUci: ['g8h8', 'f6f7'],
      },
    ]

    const classified = classifyLocalEngineLines(fenBlackToMove, lines)
    expect(classified).toHaveLength(2)
    expect(classified[0]!.outcomeBrush).toBe('blue')
    expect(classified[0]!.expectedScore).toBeCloseTo(50)
    expect(classified[0]!.quality).toBe('great')
    expect(classified[0]!.nagQuality).toBe('great')
    expect(getNagSymbolForQuality(classified[0]!.quality)).toBe('!')

    expect(classified[1]!.outcomeBrush).toBe('red')
    expect(classified[1]!.quality).toBe('blunder')
    expect(classified[1]!.nagQuality).toBe('blunder')
    expect(getNagSymbolForQuality(classified[1]!.quality)).toBe('??')
  })

  it('detects direct SEE sacrifice as Brilliant (!!) when top move stays viable', () => {
    // White sacrifices rook on e7 (Rxe7? defended by black rook on e8 & pawn f8? Use clean knight sacrifice Bxh7+ style!)
    // White bishop on d3 captures pawn on h7 defended by black king on g8 -> direct SEE loss: captured pawn(100) - bishop(320) = -220 <= -100
    const greekGiftFen = 'r1bq1rk1/pppn1ppp/4pn2/3p4/3P4/2PBPN2/PP3PPP/R1BQ1RK1 w - - 0 1'
    const lines: LocalEngineLineInput[] = [
      {
        id: 1,
        depth: 14,
        moverScore: { type: 'cp', value: 260 },
        wdl: { win: 860, draw: 130, loss: 10 },
        pvUci: ['d3h7', 'g8h7', 'f3g5', 'h7g8'],
      },
      {
        id: 2,
        depth: 14,
        moverScore: { type: 'cp', value: 40 },
        wdl: { win: 200, draw: 720, loss: 80 },
        pvUci: ['b2b3', 'c7c5'],
      },
    ]

    const classified = classifyLocalEngineLines(greekGiftFen, lines)
    expect(classified[0]!.isSacrifice).toBe(true)
    expect(classified[0]!.quality).toBe('brilliant')
    expect(classified[0]!.outcomeBrush).toBe('green')
    expect(getNagSymbolForQuality(classified[0]!.quality)).toBe('!!')
    expect(classified[1]!.outcomeBrush).toBe('blue')
    expect(classified[1]!.quality).toBe('blunder')
  })

  it('never classifies terminal mate-in-1 as Brilliant (always Best ★) and marks non-mate alternative as Missed Mate (✕)', () => {
    const realMateIn1Fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'
    const mateLines: LocalEngineLineInput[] = [
      {
        id: 1,
        depth: 12,
        moverScore: { type: 'mate', value: 1 },
        pvUci: ['d1d8'],
      },
      {
        id: 2,
        depth: 12,
        moverScore: { type: 'cp', value: 20 },
        wdl: { win: 100, draw: 820, loss: 80 },
        pvUci: ['g1f1'],
      },
    ]
    const classified = classifyLocalEngineLines(realMateIn1Fen, mateLines)
    expect(classified[0]!.quality).toBe('best')
    expect(classified[0]!.outcomeBrush).toBe('green')
    expect(classified[1]!.quality).toBe('missed_mate')
    expect(classified[1]!.outcomeBrush).toBe('blue')
    expect(computeExpectedScore(mateLines[0]!.moverScore)).toBe(100)
  })

  it('guards Great (!) against obvious recaptures and single legal move', () => {
    // Only legal move: White king in check on a1 from black rook on h1, pawn on b2 blocks -> Ka2 is only legal move
    const onlyLegalFen = '6k1/8/8/8/8/8/1P6/K6r w - - 0 1'
    const onlyMoveLines: LocalEngineLineInput[] = [
      {
        id: 1,
        depth: 14,
        moverScore: { type: 'cp', value: -500 },
        wdl: { win: 0, draw: 0, loss: 1000 },
        pvUci: ['a1a2'],
      },
    ]
    const onlyClassified = classifyLocalEngineLines(onlyLegalFen, onlyMoveLines)
    expect(onlyClassified[0]!.quality).toBe('best')
    expect(onlyClassified[0]!.outcomeBrush).toBe('red')

    // Obvious recapture: Black queen on d5 can be captured by White queen on d1 (Qxd5)
    const recaptureFen = '6k1/5ppp/8/3q4/8/8/5PPP/3Q2K1 w - - 0 1'
    const recapLines: LocalEngineLineInput[] = [
      {
        id: 1,
        depth: 14,
        moverScore: { type: 'cp', value: 0 },
        wdl: { win: 50, draw: 900, loss: 50 },
        pvUci: ['d1d5'],
      },
      {
        id: 2,
        depth: 14,
        moverScore: { type: 'cp', value: -900 },
        wdl: { win: 0, draw: 0, loss: 1000 },
        pvUci: ['g1f1'],
      },
    ]
    const recapClassified = classifyLocalEngineLines(recaptureFen, recapLines)
    expect(recapClassified[0]!.quality).toBe('best')
    expect(recapClassified[0]!.outcomeBrush).toBe('blue')
    expect(recapClassified[1]!.quality).toBe('blunder')
    expect(recapClassified[1]!.outcomeBrush).toBe('red')
  })

  it('extracts multi-step king and pawn marches for ALL MultiPV variants in each variant own color', () => {
    // White king on g1 can march Kf2 -> Ke3 -> Kd4 (winning), while pawn on a3 can march a4 -> a5 -> a6 (draw)
    const endgameFen = '6k1/8/8/8/8/P7/8/6K1 w - - 0 1'
    const lines: LocalEngineLineInput[] = [
      {
        id: 1,
        depth: 15,
        moverScore: { type: 'cp', value: 220 },
        wdl: { win: 800, draw: 190, loss: 10 },
        pvUci: ['g1f2', 'g8f7', 'f2e3', 'f7e6', 'e3d4'],
      },
      {
        id: 2,
        depth: 15,
        moverScore: { type: 'cp', value: 10 },
        wdl: { win: 100, draw: 840, loss: 60 },
        pvUci: ['a3a4', 'g8f7', 'a4a5', 'f7e7', 'a5a6'],
      },
      {
        id: 3,
        depth: 15,
        moverScore: { type: 'cp', value: -250 },
        wdl: { win: 0, draw: 150, loss: 850 },
        pvUci: ['g1h1', 'g8f7', 'h1g1', 'f7e6'], // back-and-forth repetition -> must NOT draw loop march
      },
    ]

    const classified = classifyLocalEngineLines(endgameFen, lines)
    expect(classified[0]!.outcomeBrush).toBe('green')
    expect(classified[0]!.marchSteps).toEqual([
      { orig: 'f2', dest: 'e3' },
      { orig: 'e3', dest: 'd4' },
    ])

    expect(classified[1]!.outcomeBrush).toBe('blue')
    expect(classified[1]!.marchSteps).toEqual([
      { orig: 'a4', dest: 'a5' },
      { orig: 'a5', dest: 'a6' },
    ])

    expect(classified[2]!.outcomeBrush).toBe('red')
    expect(classified[2]!.marchSteps).toEqual([])

    const shapes = buildLocalAnalysisShapes(classified)
    // March arrows come first in coach<outcomeBrush>
    expect(shapes.slice(0, 4)).toEqual([
      { orig: 'f2', dest: 'e3', brush: 'coachgreen', modifiers: { lineWidth: 4 } },
      { orig: 'e3', dest: 'd4', brush: 'coachgreen', modifiers: { lineWidth: 4 } },
      { orig: 'a4', dest: 'a5', brush: 'coachblue', modifiers: { lineWidth: 4 } },
      { orig: 'a5', dest: 'a6', brush: 'coachblue', modifiers: { lineWidth: 4 } },
    ])

    // Primary arrows follow in reverse rank order so PV1 sits on top
    const primaryArrows = shapes.filter((s) => s.dest && !String(s.brush).startsWith('coach'))
    expect(primaryArrows.map((s) => `${s.orig}${s.dest}:${s.brush}`)).toEqual([
      'g1h1:red',
      'a3a4:blue',
      'g1f2:green',
    ])

    // NAG badges follow in rank order (PV1 -> PV2 -> PV3)
    const nagShapes = shapes.filter((s) => s.customNag !== undefined)
    expect(nagShapes.map((s) => `${s.orig}:${s.customNag}`)).toEqual([
      'f2:great',
      'a4:blunder',
      'h1:blunder',
    ])

    // Signature changes when highlightedLineId changes
    expect(getLocalAnalysisSignature(classified, null)).not.toBe(
      getLocalAnalysisSignature(classified, 2),
    )
  })
})
