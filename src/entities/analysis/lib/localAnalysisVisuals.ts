import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { isNormal, opposite, type Color, type Role, type Square } from 'chessops'
import { Chess, normalizeMove } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { parseSquare, parseUci } from 'chessops/util'

export type LocalArrowOutcomeBrush = 'green' | 'blue' | 'red'
export type LocalMarchBrush = 'coachgreen' | 'coachblue' | 'coachred'

export type LocalMoveQuality =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'neutral'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_mate'

export type LocalNagQuality = Exclude<LocalMoveQuality, 'neutral'>

export interface LocalScoreMoverPov {
  type: 'cp' | 'mate'
  value: number
}

export interface LocalWdlMoverPov {
  win: number
  draw: number
  loss: number
}

export interface LocalEngineLineInput {
  id: number
  depth: number
  moverScore: LocalScoreMoverPov
  wdl?: LocalWdlMoverPov
  pvUci: string[]
  isTablebase?: boolean
}

export interface MarchStep {
  orig: Key
  dest: Key
}

export interface ClassifiedEngineLine {
  id: number
  depth: number
  moveUci: string
  orig: Key
  dest: Key
  expectedScore: number
  outcomeBrush: LocalArrowOutcomeBrush
  quality: LocalMoveQuality
  nagQuality: LocalNagQuality | null
  isSacrifice: boolean
  marchSteps: MarchStep[]
}

export type LocalAnalysisShape = DrawShape & {
  customNag?: LocalNagQuality
}

const PIECE_VALUES: Record<Role, number> = {
  pawn: 100,
  knight: 300,
  bishop: 320,
  rook: 500,
  queen: 900,
  king: 20000,
}

const MIN_STABLE_DEPTH = 6
const MAX_SEE_DEPTH = 16
const PRIMARY_LINE_WIDTHS = [10, 8, 7, 6, 5] as const
const HIGHLIGHTED_LINE_WIDTH = 12
const MARCH_LINE_WIDTH = 4

const NAG_SYMBOLS: Record<LocalNagQuality, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '✓',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  missed_mate: '✕',
}

export function getNagSymbolForQuality(quality: LocalMoveQuality): string | null {
  if (quality === 'neutral') return null
  return NAG_SYMBOLS[quality]
}

export function getQualityTextClass(quality: LocalMoveQuality): string {
  switch (quality) {
    case 'brilliant':
      return 'text-mint'
    case 'great':
    case 'best':
    case 'excellent':
      return 'text-success'
    case 'good':
      return 'text-info'
    case 'neutral':
      return 'text-text-secondary'
    case 'inaccuracy':
      return 'text-warning'
    case 'mistake':
      return 'text-orange'
    case 'blunder':
    case 'missed_mate':
      return 'text-danger'
  }
}

export function computeExpectedScore(
  moverScore: LocalScoreMoverPov,
  wdl?: LocalWdlMoverPov,
): number {
  if (moverScore.type === 'mate') {
    if (moverScore.value > 0) return 100
    if (moverScore.value < 0) return 0
    return 50
  }

  if (wdl) {
    const total = wdl.win + wdl.draw + wdl.loss
    if (total > 0) {
      return ((wdl.win + 0.5 * wdl.draw) / total) * 100
    }
  }

  const clampedCp = Math.max(-1000, Math.min(1000, moverScore.value))
  return 100 / (1 + Math.exp(-0.00368208 * clampedCp))
}

export function classifyOutcomeBrush(
  moverScore: LocalScoreMoverPov,
  wdl?: LocalWdlMoverPov,
): LocalArrowOutcomeBrush {
  if (moverScore.type === 'mate') {
    if (moverScore.value > 0) return 'green'
    if (moverScore.value < 0) return 'red'
    return 'blue'
  }

  if (wdl) {
    const total = wdl.win + wdl.draw + wdl.loss
    if (total > 0) {
      const winPct = (wdl.win / total) * 100
      const lossPct = (wdl.loss / total) * 100
      const expected = ((wdl.win + 0.5 * wdl.draw) / total) * 100
      if (winPct >= 50 || expected >= 70) return 'green'
      if (lossPct >= 50 || expected <= 30) return 'red'
      return 'blue'
    }
  }

  if (moverScore.value >= 100) return 'green'
  if (moverScore.value <= -100) return 'red'
  return 'blue'
}

function parsePositionOrNull(fen: string): Chess | null {
  const setupRes = parseFen(fen)
  if (setupRes.isErr) return null
  const posRes = Chess.fromSetup(setupRes.unwrap())
  if (posRes.isErr) return null
  return posRes.unwrap()
}

function countLegalMoves(pos: Chess): number {
  let total = 0
  for (const destSet of pos.allDests().values()) {
    total += destSet.size()
  }
  return total
}

function getCapturedValue(pos: Chess, moveUci: string): number {
  const parsed = parseUci(moveUci)
  if (!parsed || !isNormal(parsed)) return 0
  const move = normalizeMove(pos, parsed)
  if (!isNormal(move)) return 0

  const movingPiece = pos.board.get(move.from)
  const targetPiece = pos.board.get(move.to)
  if (targetPiece && movingPiece && targetPiece.color !== movingPiece.color) {
    return PIECE_VALUES[targetPiece.role]
  }
  if (movingPiece?.role === 'pawn' && pos.epSquare === move.to) {
    return PIECE_VALUES.pawn
  }
  return 0
}

function simpleSee(pos: Chess, sq: Square, attackerColor: Color, depth: number): number {
  if (depth >= MAX_SEE_DEPTH) return 0
  const attackers = pos.kingAttackers(sq, attackerColor, pos.board.occupied)
  if (attackers.isEmpty()) return 0

  let cheapestSq: Square | undefined
  let cheapestVal = Number.POSITIVE_INFINITY
  for (const aSq of attackers) {
    const piece = pos.board.get(aSq)
    if (!piece) continue
    const val = PIECE_VALUES[piece.role]
    if (val < cheapestVal) {
      cheapestVal = val
      cheapestSq = aSq
    }
  }
  if (cheapestSq === undefined) return 0

  const targetPiece = pos.board.get(sq)
  const capVal = targetPiece ? PIECE_VALUES[targetPiece.role] : 0

  const nextPos = pos.clone()
  const attackerPiece = nextPos.board.take(cheapestSq)
  if (attackerPiece) {
    nextPos.board.set(sq, attackerPiece)
  }

  const oppGain = simpleSee(nextPos, sq, opposite(attackerColor), depth + 1)
  return Math.max(0, capVal - oppGain)
}

function checkMoveGuards(
  pos: Chess,
  moveUci: string,
  legalMovesCount: number,
): { isObviousRecapture: boolean; onlyLegalMove: boolean; isCheckmate: boolean } {
  const onlyLegalMove = legalMovesCount === 1
  const parsed = parseUci(moveUci)
  if (!parsed || !isNormal(parsed)) {
    return { isObviousRecapture: false, onlyLegalMove, isCheckmate: false }
  }
  const move = normalizeMove(pos, parsed)
  if (!isNormal(move) || !pos.isLegal(move)) {
    return { isObviousRecapture: false, onlyLegalMove, isCheckmate: false }
  }

  const movingPiece = pos.board.get(move.from)
  const capturedVal = getCapturedValue(pos, moveUci)
  const movedVal = movingPiece ? PIECE_VALUES[movingPiece.role] : 0
  const isObviousRecapture = capturedVal > 0 && capturedVal >= movedVal - 50

  const nextPos = pos.clone()
  nextPos.play(move)
  const isCheckmate = nextPos.isCheckmate()

  return { isObviousRecapture, onlyLegalMove, isCheckmate }
}

function detectRealSacrifice(
  pos: Chess,
  pvUci: string[],
  isTerminalMate: boolean,
  expectedScore: number,
): boolean {
  if (isTerminalMate || expectedScore < 40) return false
  const moveUci = pvUci[0]
  if (!moveUci || moveUci.length < 4) return false

  const parsed = parseUci(moveUci)
  if (!parsed || !isNormal(parsed)) return false
  const move = normalizeMove(pos, parsed)
  if (!isNormal(move) || !pos.isLegal(move)) return false

  const capturedMove1Val = getCapturedValue(pos, moveUci)
  const posAfter = pos.clone()
  posAfter.play(move)

  // 1. Direct SEE sacrifice on landing square
  const landingSq = parseSquare(moveUci.slice(2, 4))
  if (landingSq !== undefined) {
    const oppGain = simpleSee(posAfter, landingSq, posAfter.turn, 0)
    if (capturedMove1Val - oppGain <= -100) {
      return true
    }
  }

  // 2. PV-abandonment sacrifice (desperado / leaving another piece hanging)
  const oppReplyUci = pvUci[1]
  if (oppReplyUci && oppReplyUci.length >= 4) {
    const oppParsed = parseUci(oppReplyUci)
    if (oppParsed && isNormal(oppParsed)) {
      const oppMove = normalizeMove(posAfter, oppParsed)
      if (isNormal(oppMove) && posAfter.isLegal(oppMove)) {
        const capturedMove2Val = getCapturedValue(posAfter, oppReplyUci)
        if (capturedMove1Val - capturedMove2Val <= -100) {
          return true
        }
      }
    }
  }

  return false
}

function extractPieceMarchSteps(pos: Chess, pvUci: string[]): MarchStep[] {
  if (pvUci.length < 3) return []
  const firstUci = pvUci[0]
  if (!firstUci || firstUci.length < 4) return []

  const firstParsed = parseUci(firstUci)
  if (!firstParsed || !isNormal(firstParsed)) return []
  const firstMove = normalizeMove(pos, firstParsed)
  if (!isNormal(firstMove) || !pos.isLegal(firstMove)) return []

  const simPos = pos.clone()
  simPos.play(firstMove)

  const orig0 = firstUci.slice(0, 2) as Key
  let prevDest = firstUci.slice(2, 4) as Key
  const visited = new Set<Key>([orig0, prevDest])
  const steps: MarchStep[] = []

  for (const ourPly of [2, 4]) {
    const oppUci = pvUci[ourPly - 1]
    const ourUci = pvUci[ourPly]
    if (!oppUci || oppUci.length < 4 || !ourUci || ourUci.length < 4) break

    const oppParsed = parseUci(oppUci)
    if (!oppParsed || !isNormal(oppParsed)) break
    const oppMove = normalizeMove(simPos, oppParsed)
    if (!isNormal(oppMove) || !simPos.isLegal(oppMove)) break
    simPos.play(oppMove)

    const nextOrig = ourUci.slice(0, 2) as Key
    const nextDest = ourUci.slice(2, 4) as Key
    if (nextOrig !== prevDest || visited.has(nextDest)) break

    const ourParsed = parseUci(ourUci)
    if (!ourParsed || !isNormal(ourParsed)) break
    const ourMove = normalizeMove(simPos, ourParsed)
    if (!isNormal(ourMove) || !simPos.isLegal(ourMove)) break
    simPos.play(ourMove)

    steps.push({ orig: nextOrig, dest: nextDest })
    visited.add(nextDest)
    prevDest = nextDest
  }

  return steps
}

function classifyByExpectedLoss(loss: number): LocalMoveQuality {
  if (loss < 4) return 'excellent'
  if (loss < 8) return 'good'
  if (loss < 12) return 'neutral'
  if (loss < 20) return 'inaccuracy'
  if (loss < 30) return 'mistake'
  return 'blunder'
}

export function classifyLocalEngineLines(
  fen: string,
  lines: LocalEngineLineInput[],
): ClassifiedEngineLine[] {
  if (lines.length === 0) return []

  const pos = parsePositionOrNull(fen)
  const legalMovesCount = pos ? countLegalMoves(pos) : 0

  const validLines = lines
    .filter((line) => line.pvUci.length > 0 && (line.pvUci[0]?.length ?? 0) >= 4)
    .slice()
    .sort((a, b) => a.id - b.id)

  if (validLines.length === 0) return []

  const scoredLines = validLines.map((line) => ({
    line,
    expectedScore: computeExpectedScore(line.moverScore, line.wdl),
    outcomeBrush: classifyOutcomeBrush(line.moverScore, line.wdl),
  }))

  const bestEntry = scoredLines[0]!
  const secondEntry = scoredLines[1] ?? null
  const isStable = Boolean(bestEntry.line.isTablebase) || bestEntry.line.depth >= MIN_STABLE_DEPTH
  const isPv2Synced =
    secondEntry !== null &&
    (Boolean(bestEntry.line.isTablebase && secondEntry.line.isTablebase) ||
      Math.abs(bestEntry.line.depth - secondEntry.line.depth) <= 2)

  const onlyMoveGap =
    isStable && isPv2Synced && secondEntry
      ? Math.max(0, bestEntry.expectedScore - secondEntry.expectedScore)
      : 0

  return scoredLines.map(({ line, expectedScore, outcomeBrush }, index) => {
    const moveUci = line.pvUci[0]!
    const orig = moveUci.slice(0, 2) as Key
    const dest = moveUci.slice(2, 4) as Key

    const guards = pos
      ? checkMoveGuards(pos, moveUci, legalMovesCount)
      : { isObviousRecapture: false, onlyLegalMove: false, isCheckmate: false }

    const isTerminalMate =
      (line.moverScore.type === 'mate' && line.moverScore.value === 1) || guards.isCheckmate

    const isSacrifice =
      pos && isStable
        ? detectRealSacrifice(pos, line.pvUci, isTerminalMate, expectedScore)
        : false

    const loss = index === 0 ? 0 : Math.max(0, bestEntry.expectedScore - expectedScore)
    const lostWin = bestEntry.expectedScore >= 75 && expectedScore <= 35
    const isMissedMate =
      index > 0 &&
      bestEntry.line.moverScore.type === 'mate' &&
      bestEntry.line.moverScore.value > 0 &&
      !(line.moverScore.type === 'mate' && line.moverScore.value > 0) &&
      expectedScore < 85

    const isFasterSelfMate =
      index > 0 &&
      bestEntry.line.moverScore.type === 'mate' &&
      bestEntry.line.moverScore.value < 0 &&
      line.moverScore.type === 'mate' &&
      line.moverScore.value < 0 &&
      Math.abs(line.moverScore.value) < Math.abs(bestEntry.line.moverScore.value)

    let quality: LocalMoveQuality
    if (isTerminalMate) {
      quality = index === 0 ? 'best' : 'good'
    } else if (index === 0) {
      if (isSacrifice && isStable) {
        quality = 'brilliant'
      } else if (
        onlyMoveGap >= 10 &&
        !guards.isObviousRecapture &&
        !guards.onlyLegalMove &&
        isStable
      ) {
        quality = 'great'
      } else {
        quality = 'best'
      }
    } else if (!isStable) {
      quality = 'neutral'
    } else if (isMissedMate) {
      quality = 'missed_mate'
    } else if (lostWin) {
      quality = 'blunder'
    } else if (isFasterSelfMate) {
      quality = Math.abs(line.moverScore.value) === 1 ? 'inaccuracy' : 'neutral'
    } else {
      quality = classifyByExpectedLoss(loss)
    }

    const lineStableForMarch = Boolean(line.isTablebase) || line.depth >= MIN_STABLE_DEPTH
    const marchSteps =
      pos && lineStableForMarch ? extractPieceMarchSteps(pos, line.pvUci) : []

    return {
      id: line.id,
      depth: line.depth,
      moveUci,
      orig,
      dest,
      expectedScore,
      outcomeBrush,
      quality,
      nagQuality: quality === 'neutral' ? null : quality,
      isSacrifice,
      marchSteps,
    }
  })
}

export function buildLocalAnalysisShapes(
  classifiedLines: ClassifiedEngineLine[],
  options?: { highlightedLineId?: number | null },
): LocalAnalysisShape[] {
  if (classifiedLines.length === 0) return []

  const highlightedId = options?.highlightedLineId ?? null
  const shapes: LocalAnalysisShape[] = []

  // 1. Piece / King / Pawn march continuation arrows underneath primary arrows
  const marchSeen = new Set<string>()
  for (const line of classifiedLines) {
    const marchBrush: LocalMarchBrush = `coach${line.outcomeBrush}`
    for (const step of line.marchSteps) {
      const key = `${step.orig}-${step.dest}-${marchBrush}`
      if (marchSeen.has(key)) continue
      marchSeen.add(key)
      shapes.push({
        orig: step.orig,
        dest: step.dest,
        brush: marchBrush,
        modifiers: { lineWidth: MARCH_LINE_WIDTH },
      })
    }
  }

  // 2. Primary arrows (lowest priority first so PV1 / highlighted line renders cleanly on top)
  const orderedPrimary = classifiedLines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => {
      const aHighlighted = a.line.id === highlightedId ? 1 : 0
      const bHighlighted = b.line.id === highlightedId ? 1 : 0
      if (aHighlighted !== bHighlighted) return aHighlighted - bHighlighted
      return b.index - a.index
    })

  for (const { line, index } of orderedPrimary) {
    const baseWidth =
      PRIMARY_LINE_WIDTHS[index] ?? PRIMARY_LINE_WIDTHS[PRIMARY_LINE_WIDTHS.length - 1]
    const lineWidth = line.id === highlightedId ? HIGHLIGHTED_LINE_WIDTH : baseWidth
    shapes.push({
      orig: line.orig,
      dest: line.dest,
      brush: line.outcomeBrush,
      modifiers: { lineWidth },
    })
  }

  // 3. NAG badges in rank order (PV1 wins if two candidates share a destination square)
  for (const line of classifiedLines) {
    if (!line.nagQuality) continue
    shapes.push({
      orig: line.dest,
      customNag: line.nagQuality,
    })
  }

  return shapes
}

export function getLocalAnalysisSignature(
  classifiedLines: ClassifiedEngineLine[],
  highlightedLineId?: number | null,
): string {
  const linePart = classifiedLines
    .map((line) => {
      const march = line.marchSteps.map((s) => `${s.orig}>${s.dest}`).join('.')
      return `${line.id}:${line.moveUci}:${line.outcomeBrush}:${line.nagQuality ?? ''}:${march}`
    })
    .join('|')
  return `${linePart}#${highlightedLineId ?? ''}`
}
