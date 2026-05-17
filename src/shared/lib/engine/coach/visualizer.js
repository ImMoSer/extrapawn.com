import { analyzeMove } from './analyzer-rs'

/**
 * Centralized Color Design System for Visualizer Marks.
 * Maps semantic chess concepts to Chessground brush color names.
 */
const COLORS = {
  BEST_MOVE: 'bestmove',
  MANEUVER: 'blue',
  DIRECT_TACTIC: 'red',
  TACTIC_GEOMETRY: 'cyan',
  PAWN_RACE: 'yellow',
  STRATEGIC_SQUARE: 'green',
  STRUCTURE_WHITE: 'green',
  STRUCTURE_BLACK: 'red',
}

/**
 * Dedicated visual translator for engine-coach explanations.
 *
 * This module converts structured engine data (opposition, pawn structure,
 * maneuvers, etc.) and raw Rust targets into visual commands for the UI.
 * It completely replaces the fragile regex-based parsing.
 */
export function generateVisualCommands(
  blob,
  fen,
  attackingSide,
  planSteps,
  keySquares,
  bestMoveUci
) {
  const visual_commands = {}

  // 1. Best Move (Immediate Action)
  mapBestMove(visual_commands, planSteps)

  // 1.5 Maneuvers (Piece Journeys)
  mapManeuvers(visual_commands, planSteps, attackingSide)

  // 2. Passed Pawns (Static Structure)
  mapPawnRace(visual_commands, blob, attackingSide)

  // 3. Key Squares & Outposts
  mapKeySquares(visual_commands, blob, keySquares)

  // 4. Opposition
  mapOpposition(visual_commands, blob)

  // 5. Structure (Pawn positions)
  mapStructure(visual_commands, blob, fen)

  // 6. Tactics (Precise Geometry from Rust)
  mapTactics(visual_commands, fen, bestMoveUci)

  return visual_commands
}

function mapBestMove(cmds, planSteps) {
  if (planSteps && planSteps.length > 0 && planSteps[0].from && planSteps[0].to) {
    const bestMove = planSteps[0]
    cmds.best_move = `[mark:${bestMove.to}:${COLORS.BEST_MOVE};route:${bestMove.from}->${bestMove.to}:${COLORS.BEST_MOVE}]`
  }
}

function mapManeuvers(cmds, planSteps, attackingSide) {
  if (!planSteps) return

  const rootIsWhite = attackingSide === 'white'
  const journeys = new Map()

  planSteps.forEach((s, i) => {
    const isOurMove = i % 2 === 0
    const side = isOurMove ? (rootIsWhite ? 'white' : 'black') : rootIsWhite ? 'black' : 'white'

    // Track non-pawn pieces of the attacking side
    if (side === attackingSide && s.role && s.role !== 'p') {
      let chain = null
      for (const [, c] of journeys) {
        if (c.lastSquare === s.from) {
          chain = c
          break
        }
      }
      if (chain) {
        chain.path.push(s.to)
        chain.lastSquare = s.to
      } else {
        journeys.set(s.from, { originalFrom: s.from, path: [s.to], lastSquare: s.to })
      }
    }
  })

  let leadJourney = null
  for (const c of journeys.values()) {
    if (!leadJourney || c.path.length > leadJourney.path.length) leadJourney = c
  }

  // Only add maneuver if it's different/longer than just the immediate best move
  if (leadJourney && leadJourney.path.length >= 2) {
    cmds.maneuver = `[mark:${leadJourney.lastSquare}:${COLORS.MANEUVER};route:${leadJourney.originalFrom}->${leadJourney.path.join('->')}:${COLORS.MANEUVER}]`
  }
}

function mapPawnRace(cmds, blob, attackingSide) {
  const passedPawns = []
  if (blob.pawn_structure && blob.pawn_structure[attackingSide]?.passed) {
    passedPawns.push(...blob.pawn_structure[attackingSide].passed)
  }

  if (passedPawns.length > 0) {
    const promoRank = attackingSide === 'white' ? 8 : 1
    const tags = passedPawns
      .map((sq) => {
        const file = sq.charAt(0)
        const rank = parseInt(sq.charAt(1), 10)
        if (isNaN(rank)) return ''

        const route = []
        const step = attackingSide === 'white' ? 1 : -1
        for (let r = rank; r !== promoRank + step; r += step) {
          route.push(`${file}${r}`)
        }
        if (route.length >= 2) {
          return `[mark:${file}${promoRank}:${COLORS.PAWN_RACE};route:${route.join('->')}:${COLORS.PAWN_RACE}]`
        }
        return ''
      })
      .filter(Boolean)

    if (tags.length > 0) {
      cmds.pawn_race = tags.join(';')
    }
  }
}

function mapKeySquares(cmds, blob, keySquares) {
  const markedSquares = new Set()
  if (keySquares && keySquares.length > 0) {
    keySquares.forEach((sq) => markedSquares.add(sq))
  }

  if (blob.activity) {
    if (blob.activity.white?.outposts) {
      blob.activity.white.outposts.forEach((o) => markedSquares.add(o.square))
    }
    if (blob.activity.black?.outposts) {
      blob.activity.black.outposts.forEach((o) => markedSquares.add(o.square))
    }
  }

  if (markedSquares.size > 0) {
    cmds.key_squares = `[mark:${[...markedSquares].join(',')}:${COLORS.STRATEGIC_SQUARE}]`
  }
}

function mapOpposition(cmds, blob) {
  if (blob.endgame?.opposition) {
    const opp = blob.endgame.opposition
    if (opp.from && opp.to) {
      cmds.opposition = `[arrow:${opp.from}->${opp.to}:${COLORS.MANEUVER}]`
    }
  }
}

function mapStructure(cmds, blob, fen) {
  const hasStructureTheme = (blob.themes || []).some(
    (t) => t.id.includes('pawn') || t.id.includes('structure') || t.id.includes('isolated'),
  )

  if (hasStructureTheme) {
    const wPawns = getPawnsFromFen(fen, 'white')
    const bPawns = getPawnsFromFen(fen, 'black')
    if (wPawns.length) cmds.structure_white = `[mark:${wPawns.join(',')}:${COLORS.STRUCTURE_WHITE}]`
    if (bPawns.length) cmds.structure_black = `[mark:${bPawns.join(',')}:${COLORS.STRUCTURE_BLACK}]`
  }
}

function mapTactics(cmds, fen, bestMoveUci) {
  if (!bestMoveUci) return

  const rawRustResult = analyzeMove(fen, bestMoveUci)
  if (!rawRustResult || !rawRustResult.motifs) return

  const marks = new Set()
  const arrows = new Set()
  const routes = new Set()

  rawRustResult.motifs.forEach((motif) => {
    const t = motif.targets || []
    if (t.length === 0) return

    switch (motif.id) {
      // 1. Lineare Strahlen (Durchschlagende Geometrie)
      case 'pin':
      case 'skewer':
        if (t.length >= 3) routes.add(`[route:${t[0]}->${t[1]}->${t[2]}:${COLORS.TACTIC_GEOMETRY}]`)
        break
      case 'battery':
        if (t.length >= 3) routes.add(`[route:${t[1]}->${t[0]}->${t[2]}:${COLORS.TACTIC_GEOMETRY}]`)
        break
      case 'discovered_check':
        if (t.length >= 3) arrows.add(`[arrow:${t[0]}->${t[2]}:${COLORS.DIRECT_TACTIC}]`)
        break

      // 2. Direkte Angriffe & Pfeile
      case 'check':
      case 'threatens':
      case 'attacks_pawn':
        if (t.length >= 2) arrows.add(`[arrow:${t[0]}->${t[1]}:${COLORS.DIRECT_TACTIC}]`)
        break
      case 'fork':
      case 'attacks_king':
      case 'eyes_king_zone':
        if (t.length >= 2) {
          for (let i = 1; i < t.length; i++) {
            arrows.add(`[arrow:${t[0]}->${t[i]}:${COLORS.DIRECT_TACTIC}]`)
          }
        }
        break

      // 3. Statische Highlights (Warnungen & Markierungen)
      case 'creates_threat':
      case 'traps_piece':
      case 'removes_defender':
        marks.add(t[0])
        break

      // 4. Spezielle & Komplexe Geometrie
      case 'overloaded':
        if (t.length >= 2) {
          marks.add(t[0])
          for (let i = 1; i < t.length; i++) {
            arrows.add(`[arrow:${t[0]}->${t[i]}:${COLORS.TACTIC_GEOMETRY}]`)
          }
        }
        break
      case 'opens_file_for':
      case 'opens_diagonal_for':
        if (t.length >= 2) routes.add(`[route:${t[0]}->${t[1]}:${COLORS.TACTIC_GEOMETRY}]`)
        break
      case 'defends':
        if (t.length >= 2) marks.add(t[1]) // Nur das Gedeckte Ziel markieren (über DIRECT_TACTIC)
        break
    }
  })

  // Add the gathered shapes to cmds without overriding existing keys
  // For tactics, we combine them into a single string
  const tacticsCmds = []
  if (marks.size > 0) tacticsCmds.push(`[mark:${[...marks].join(',')}:${COLORS.DIRECT_TACTIC}]`)
  if (arrows.size > 0) tacticsCmds.push(...arrows)
  if (routes.size > 0) tacticsCmds.push(...routes)

  if (tacticsCmds.length > 0) {
    cmds.tactics = tacticsCmds.join(';')
  }
}

function getPawnsFromFen(fenStr, color) {
  const board = fenStr.split(' ')[0]
  const ranks = board.split('/')
  const pawns = []
  const target = color === 'white' ? 'P' : 'p'
  for (let r = 0; r < 8; r++) {
    let f = 0
    for (const char of ranks[r]) {
      if (!isNaN(parseInt(char, 10))) {
        f += parseInt(char, 10)
      } else {
        if (char === target) {
          pawns.push(String.fromCharCode(97 + f) + (8 - r))
        }
        f++
      }
    }
  }
  return pawns
}
