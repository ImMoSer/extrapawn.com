import { getEngineDefaults } from './engine'

/**
 * Centralized Color Design System for Visualizer Marks.
 * Maps semantic chess concepts to Chessground brush color names.
 */
const COLORS = {
  ENGINE_PLAN: 'enginePlan',
  BEST_MOVE: 'enginePlan',
  NEXT_MOVE: 'enginePlan',
  LAST_MOVE: 'enginePlan',
  MANEUVER: 'enginePlan',
  OPPOSITION: 'purple',
  DIRECT_TACTIC: 'red',
  TACTIC_GEOMETRY: 'cyan',
  PAWN_RACE: 'yellow',
  STRATEGIC_SQUARE: 'green',
  STRUCTURE_WHITE: 'green',
  STRUCTURE_BLACK: 'red',
}

function formatFallbackVerdict(evalCp, mate = null) {
  if (mate !== null && mate !== undefined) {
    const side = mate > 0 ? 'White' : 'Black';
    return `${side} mate (M${Math.abs(mate)})`;
  }
  if (typeof evalCp !== 'number') return null;
  const absCp = Math.abs(evalCp);
  if (absCp < 25) return 'Roughly equal';
  const side = evalCp > 0 ? 'White' : 'Black';
  const pawns = (absCp / 100).toFixed(1);
  if (absCp < 75) return `${side} has a slight edge (+${pawns})`;
  if (absCp < 200) return `${side} is better (+${pawns})`;
  if (absCp < 500) return `${side} is winning (+${pawns})`;
  return `${side} is clearly winning (+${pawns})`;
}

/**
 * Dedicated visual translator for engine-coach explanations.
 */
export function generateVisualCommands(
  blob,
  fen,
  attackingSide,
  planSteps,
  keySquares
) {
  const visual_commands = {}
  const logs = []

  // Capture structured input sources for debugging & inspection
  const input_sources = {
    fen,
    attackingSide,
    positionSummary: {
      evalPawns: blob?.eval_pawns ?? (typeof blob?.eval_cp === 'number' ? parseFloat((blob.eval_cp / 100).toFixed(2)) : null),
      evalMate: blob?.eval_mate ?? null,
      phase: blob?.phase || null,
      verdict: blob?.verdict || formatFallbackVerdict(blob?.eval_cp, blob?.eval_mate),
      materialSummary: blob?.material?.summary || null
    },
    lastMoveAnalysis: blob?.lastMoveAnalysis ? {
      uci: blob.lastMoveAnalysis.uci || blob.lastMoveAnalysis.move || null,
      san: blob.lastMoveAnalysis.san || null,
      quality: blob.lastMoveAnalysis.quality || null,
      summary: blob.lastMoveAnalysis.summary || null,
      details: blob.lastMoveAnalysis.details || null,
      consequence: blob?.lastMoveConsequence || null,
      win_rate_loss: blob.lastMoveAnalysis.winRateLoss ?? blob.lastMoveAnalysis.win_rate_loss ?? null,
      best_move_san: blob.lastMoveAnalysis.bestMoveSan ?? blob.lastMoveAnalysis.best_move_san ?? null
    } : null,
    tactics: extractTacticsSources(blob, planSteps),
    planSteps: (planSteps || []).slice(0, 5).map(s => ({
      san: s.san || '',
      from: s.from || (s.move ? s.move.slice(0, 2) : ''),
      to: s.to || (s.move ? s.move.slice(2, 4) : ''),
      quality: s.quality || null,
      motifs: s.motifs || [],
      headline: s.headline || null
    })),
    principalPlan: blob?.principal_plan ? {
      theme: blob.principal_plan.theme || null,
      description: blob.principal_plan.description || null,
      evalCp: blob.principal_plan.eval_cp ?? null,
      depth: blob.principal_plan.depth ?? null
    } : null,
    engineTopMoves: (blob?.engine_top_moves || []).slice(0, getEngineDefaults().multipv).map(m => ({
      san: m.san || m.uci || '',
      uci: m.uci || '',
      score: m.score ?? null,
      mate: m.mate ?? null,
      character: m.character || null,
      headline: m.headline || null,
      planTheme: m.plan_theme || null,
      planBrief: m.plan_brief || null,
      motifs: m.motifs || []
    })),
    keySquares: keySquares || [],
    outposts: Array.from(new Set([
      ...(blob?.activity?.white?.outposts || []),
      ...(blob?.activity?.black?.outposts || [])
    ].map(o => typeof o === 'string' ? o : o.square))),
    passedPawns: Array.from(new Set([
      ...(blob?.pawn_structure?.white?.passed || []),
      ...(blob?.pawn_structure?.black?.passed || [])
    ])),
    weakPawns: Array.from(new Set([
      ...(blob?.pawn_structure?.white?.isolated || []),
      ...(blob?.pawn_structure?.white?.doubled_files || []),
      ...(blob?.pawn_structure?.black?.isolated || []),
      ...(blob?.pawn_structure?.black?.doubled_files || [])
    ])),
    pawnStructure: {
      summary: blob?.pawn_structure?.summary || '',
      darkComplexWeak: blob?.pawn_structure?.dark_complex_weak || null,
      whiteIsolated: blob?.pawn_structure?.white?.isolated || [],
      blackIsolated: blob?.pawn_structure?.black?.isolated || [],
      whiteBackward: blob?.pawn_structure?.white?.backward || [],
      blackBackward: blob?.pawn_structure?.black?.backward || [],
      whitePassed: blob?.pawn_structure?.white?.passed || [],
      blackPassed: blob?.pawn_structure?.black?.passed || [],
      whiteHoles: blob?.pawn_structure?.white?.holes || [],
      blackHoles: blob?.pawn_structure?.black?.holes || []
    },
    themes: (blob?.themes || []).map(t => ({
      id: t.id,
      side: t.side,
      strength: t.strength,
      description: t.description
    })),
    pawnChains: blob?.pawn_structure?.pawn_chains || [],
    kingSafety: {
      whiteAttackers: blob?.king_safety?.white_attackers || [],
      blackAttackers: blob?.king_safety?.black_attackers || [],
      exposures: blob?.king_safety?.king_exposures || []
    }
  }

  // 1. Engine Plan Sequence & Piece Maneuvers (Single color enginePlan)
  mapPlanSequence(visual_commands, planSteps, logs)

  // 2. Passed Pawns (Static Structure)
  mapPawnRace(visual_commands, blob, attackingSide, logs)

  // 3. Opposition
  mapOpposition(visual_commands, blob, logs)

  // 5. Structure (Pawn positions)
  mapStructure(visual_commands, blob, fen, logs)

  // 6. Tactics (Precise Geometry from Rust)
  mapTactics(visual_commands, planSteps, logs)

  Object.defineProperty(visual_commands, '_logs', {
    value: logs,
    enumerable: true,
    writable: true,
  })

  Object.defineProperty(visual_commands, '_input_sources', {
    value: input_sources,
    enumerable: true,
    writable: true,
  })

  return visual_commands
}

function extractTacticsSources(blob, planSteps) {
  const items = []
  if (blob?.tactics) {
    if (Array.isArray(blob.tactics.forks)) {
      blob.tactics.forks.forEach(f => items.push({ type: 'fork', detail: typeof f === 'string' ? f : `${f.attacker || 'Piece'} forks ${Array.isArray(f.targets) ? f.targets.join(', ') : f.target || ''}` }))
    }
    if (Array.isArray(blob.tactics.pins)) {
      blob.tactics.pins.forEach(p => items.push({ type: 'pin', detail: typeof p === 'string' ? p : `${p.pinned || 'Piece'} pinned by ${p.pinner || ''}` }))
    }
    if (Array.isArray(blob.tactics.skewers)) {
      blob.tactics.skewers.forEach(s => items.push({ type: 'skewer', detail: typeof s === 'string' ? s : `${s.skewerer || 'Piece'} skewers target` }))
    }
    if (Array.isArray(blob.tactics.hanging_pieces)) {
      blob.tactics.hanging_pieces.forEach(h => items.push({ type: 'hanging', detail: typeof h === 'string' ? `Hanging on ${h}` : `Hanging piece on ${h.square || ''}` }))
    }
  }

  if (Array.isArray(planSteps)) {
    planSteps.forEach(step => {
      if (Array.isArray(step.motifs)) {
        step.motifs.forEach(m => {
          items.push({ type: m, detail: `Motif '${m}' on move ${step.san || step.from + '->' + step.to}` })
        })
      }
    })
  }

  return items
}

function mapPlanSequence(cmds, planSteps, logs) {
  if (!planSteps || planSteps.length === 0) return

  // Filter our side's moves from plan (indices 0, 2, 4...)
  const ourMoves = planSteps.filter((s, i) => i % 2 === 0 && (s.from || (s.move && s.move.length >= 4)))
    .map((s, idx) => ({
      from: s.from || s.move.slice(0, 2),
      to: s.to || s.move.slice(2, 4),
      san: s.san || '',
      label: `${idx + 1}`
    }))

  if (ourMoves.length === 0) return

  // Verify that all moves of our side form a continuous route of the same piece
  // (i.e. move i's 'from' must equal move i-1's 'to')
  for (let i = 1; i < ourMoves.length; i++) {
    if (ourMoves[i].from !== ourMoves[i - 1].to) {
      return // Not a continuous single-piece route -> no arrows
    }
  }

  ourMoves.forEach((m, idx) => {
    const cmdKey = `plan_step_${idx + 1}`
    cmds[cmdKey] = `[mark:${m.to}:${COLORS.ENGINE_PLAN};route:${m.from}->${m.to}:${COLORS.ENGINE_PLAN}]`

    logs.push({
      category: 'Plan',
      title: `Piece Route Step ${m.label}`,
      squares: [m.from, m.to],
      color: COLORS.ENGINE_PLAN,
      command: cmds[cmdKey],
      reason: `Piece route step ${m.label}: ${m.san ? m.san + ' ' : ''}(${m.from} -> ${m.to})`
    })
  })
}

function mapPawnRace(cmds, blob, attackingSide, logs) {
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
      logs.push({
        category: 'Pawn Race',
        title: 'Passed Pawn Promotion March',
        squares: passedPawns,
        color: COLORS.PAWN_RACE,
        command: cmds.pawn_race,
        reason: `Passed pawn(s) on [${passedPawns.join(', ')}] marching towards promotion rank ${promoRank}`
      })
    }
  }
}

function mapOpposition(cmds, blob, logs) {
  if (blob.endgame?.opposition) {
    const opp = blob.endgame.opposition
    const wKing = blob.king_safety?.white?.king_square
    const bKing = blob.king_safety?.black?.king_square
    if (wKing && bKing) {
      const fromSq = opp.holder === 'white' ? wKing : bKing
      const toSq = opp.holder === 'white' ? bKing : wKing
      cmds.opposition = `[arrow:${fromSq}->${toSq}:${COLORS.OPPOSITION}]`
      logs.push({
        category: 'Opposition',
        title: `King Opposition Vector (${opp.kind || 'direct'})`,
        squares: [wKing, bKing],
        color: COLORS.OPPOSITION,
        command: cmds.opposition,
        reason: opp.description || `Endgame king opposition control vector: ${fromSq} -> ${toSq}`
      })
    }
  }
}

function mapStructure(cmds, blob, fen, logs) {
  const hasStructureTheme = (blob.themes || []).some(
    (t) => t.id.includes('pawn') || t.id.includes('structure') || t.id.includes('isolated'),
  )

  if (hasStructureTheme) {
    const wPawns = getPawnsFromFen(fen, 'white')
    const bPawns = getPawnsFromFen(fen, 'black')
    if (wPawns.length) cmds.structure_white = `[mark:${wPawns.join(',')}:${COLORS.STRUCTURE_WHITE}]`
    if (bPawns.length) cmds.structure_black = `[mark:${bPawns.join(',')}:${COLORS.STRUCTURE_BLACK}]`
    logs.push({
      category: 'Structure',
      title: 'Pawn Skeleton Highlight',
      squares: [...wPawns, ...bPawns],
      color: COLORS.STRUCTURE_WHITE,
      command: `${cmds.structure_white || ''};${cmds.structure_black || ''}`,
      reason: `Pawn structure theme active in current position`
    })
  }
}

function mapTactics(cmds, planSteps, logs) {
  if (!planSteps || planSteps.length === 0) return

  const marks = new Set()
  const arrows = new Set()
  const routes = new Set()

  planSteps.forEach((step, index) => {
    if (index % 2 !== 0) return
    if (!step.raw_motifs) return

    step.raw_motifs.forEach((motif) => {
      const t = motif.targets || []
      if (t.length === 0) return

      let motifCmd = ''
      switch (motif.id) {
        case 'pin':
        case 'skewer':
          if (t.length >= 3) {
            motifCmd = `[route:${t[0]}->${t[1]}->${t[2]}:${COLORS.TACTIC_GEOMETRY}]`
            routes.add(motifCmd)
          }
          break
        case 'battery':
          if (t.length >= 3) {
            motifCmd = `[route:${t[1]}->${t[0]}->${t[2]}:${COLORS.TACTIC_GEOMETRY}]`
            routes.add(motifCmd)
          }
          break
        case 'rook_lift':
          if (t.length >= 3) {
            motifCmd = `[route:${t[0]}->${t[1]}->${t[2]}:${COLORS.TACTIC_GEOMETRY}]`
            routes.add(motifCmd)
          }
          break
        case 'discovered_check':
          if (t.length >= 3) {
            motifCmd = `[arrow:${t[0]}->${t[2]}:${COLORS.DIRECT_TACTIC}]`
            arrows.add(motifCmd)
          }
          break

        case 'check':
        case 'threatens':
        case 'attacks_pawn':
        case 'greek_gift':
        case 'back_rank_mate_threat':
          if (t.length >= 2) {
            motifCmd = `[arrow:${t[0]}->${t[1]}:${COLORS.DIRECT_TACTIC}]`
            arrows.add(motifCmd)
          }
          break
        case 'double_check':
          if (t.length >= 2) {
            for (let i = 0; i < t.length - 1; i++) {
              arrows.add(`[arrow:${t[i]}->${t[t.length - 1]}:${COLORS.DIRECT_TACTIC}]`)
            }
          }
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

        case 'creates_threat':
        case 'traps_piece':
        case 'removes_defender':
        case 'outpost':
        case 'knight_invasion':
        case 'pawn_breakthrough':
          marks.add(t[0])
          break

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
          if (t.length >= 2) {
            motifCmd = `[route:${t[0]}->${t[1]}:${COLORS.TACTIC_GEOMETRY}]`
            routes.add(motifCmd)
          }
          break
        case 'defends':
          if (t.length >= 2) marks.add(t[1])
          break
      }

      logs.push({
        category: 'Tactics',
        title: `Motif: ${motif.id.replace(/_/g, ' ')}`,
        squares: t,
        color: COLORS.DIRECT_TACTIC,
        command: motifCmd || `[tactic:${motif.id}]`,
        reason: `Rust motif engine identified [${motif.id}] involving squares [${t.join(', ')}]`
      })
    })
  })

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

/**
 * Parse visual commands string into Chessground DrawShapes
 */
export function parseVisualCommands(actionStr) {
  if (!actionStr) return []
  const subActions = actionStr.split(';')
  const allShapes = []
  const VALID_BRUSHES = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'gray', 'bestmove', 'enginePlan', 'paleBlue', 'paleGreen']

  for (const sub of subActions) {
    if (!sub.trim()) continue

    const cleanSub = sub.replace(/[\[\]]/g, '').trim()
    const parts = cleanSub.split(':')
    const cmd = parts[0]?.trim()
    const data = parts[1]?.trim()
    let brush = parts[2]?.trim() || 'green'

    if (!VALID_BRUSHES.includes(brush)) {
      brush = 'green'
    }

    const coachBrush = (brush === 'bestmove' || brush === 'enginePlan') ? 'enginePlan' : `coach${brush}`

    if (cmd === 'clear') {
      return []
    }

    if (!data) continue

    if (cmd === 'arrow' || cmd === 'route' || cmd === 'root') {
      const squares = data.split('->')
      for (let i = 0; i < squares.length - 1; i++) {
        const orig = squares[i]?.trim()
        const dest = squares[i + 1]?.trim()

        if (orig && dest && orig.length === 2 && dest.length === 2) {
          allShapes.push({
            orig: orig,
            dest: dest,
            brush: coachBrush,
            modifiers: { lineWidth: 3 }
          })
        }
      }
    } else if (cmd === 'mark') {
      const squares = data.split(',')
      squares.forEach(sq => {
        const cleanSq = sq.trim()
        if (cleanSq && cleanSq.length === 2) {
          allShapes.push({
            orig: cleanSq,
            brush: coachBrush
          })
        }
      })
    } else if (cmd === 'nag') {
      const squares = data.split(',')
      const quality = parts[2]?.trim() || 'brilliant'
      squares.forEach(sq => {
        const cleanSq = sq.trim()
        if (cleanSq && cleanSq.length === 2) {
          allShapes.push({
            orig: cleanSq,
            nag: quality
          })
        }
      })
    } else if (cmd === 'step_badge' || cmd === 'badge') {
      const squares = data.split(',')
      const label = parts[2]?.trim() || 'A1'
      const bColor = parts[3]?.trim() || coachBrush
      squares.forEach(sq => {
        const cleanSq = sq.trim()
        if (cleanSq && cleanSq.length === 2) {
          allShapes.push({
            orig: cleanSq,
            stepBadge: label,
            brush: bColor
          })
        }
      })
    }
  }

  const COLOR_PRIORITY = {
    coachgray: 0, coachbrown: 1, coachyellow: 2, coachgreen: 3, coachcyan: 4, coachblue: 5, coachpurple: 6, coachpink: 7, coachorange: 8, coachred: 9, bestmove: 10, enginePlan: 10
  }
  allShapes.sort((a, b) => {
    const pA = COLOR_PRIORITY[a.brush] || 0
    const pB = COLOR_PRIORITY[b.brush] || 0
    return pA - pB
  })

  return allShapes
}
