// Full explanation builder.
//
// Combines:
//   1. Static blob from the Rust analyzer (engine-rs).
//   2. Stockfish multi-PV results.
//   3. WASM-annotated motifs for each top move.
//   4. PV-walked plan extraction for the principal variation.
//
// Output: an augmented `Explanation` blob with new sections:
//   - `engine_attack_potential` — attached to king_safety; how easy is
//     it to attack the enemy king based on what fraction of the engine's
//     top moves target the king zone (or contain a tactical motif).
//   - `principal_plan` — the engine's PV walked move-by-move, each
//     annotated with its motifs and a one-line headline. Plus the
//     "key squares" (squares visited 2+ times) and a derived theme.
//   - extra `themes` synthesised from these signals.
//
// This is the LLM-ready blob: deeply structured, attribution-aware,
// suitable for prompting a model to write a paragraph about the
// position.

import engine, { getEngineDefaults } from './engine'
import { explainPosition, analyzeMove, isReady as wasmReady } from './analyzer-rs'
import { getSideToMove } from './chess'
import { extractLlmPayload } from './llm-bridge'

// The plan walker needs enough breadth to compare alternative continuations
// when classifying the move's character. Bump below this floor.
const PLAN_MIN_MULTIPV = 5
const PLAN_PLIES = 6 // walk the principal variation up to this many plies

// Motif IDs that count as "targeting the king" — used to score how much
// the engine's preferred moves are king-attacking.
const KING_ATTACK_MOTIFS = new Set([
  'attacks_king',
  'eyes_king_zone',
  'check',
  'discovered_check',
  'double_check',
  'greek_gift',
  'back_rank_mate_threat',
  'smothered_hint',
  'fork',
  'pin',
  'skewer', // tactics that often involve the king
  'sacrifice',
  'decisive_combination',
])

// Build the full blob asynchronously. Returns null if WASM isn't ready
// or the engine fails. Callers should fall back to the static blob.
export async function buildFullExplanation(fen, opts = {}) {
  if (!wasmReady() || !fen) return null

  // ── Static layer ────────────────────────────────────────────────────
  const staticBlob = explainPosition(fen)
  if (!staticBlob || staticBlob.error) return staticBlob || null

  // ── Engine layer ────────────────────────────────────────────────────
  const defaults = getEngineDefaults()
  const planDepth = opts.depth || defaults.depth
  const planMultiPV = Math.max(opts.multipv || defaults.multipv, PLAN_MIN_MULTIPV)
  let engineRes
  try {
    engineRes = await engine.analyzeMultiPV(fen, planMultiPV, planDepth)
  } catch {
    return staticBlob // engine failed; static is still useful
  }
  if (!engineRes || !Array.isArray(engineRes.moves)) return staticBlob

  // ── Annotate each top move with motifs + a per-move plan brief ─────
  //
  // For each top engine move, we walk its principal variation (the
  // engine's preferred continuation for THIS specific candidate) and
  // produce:
  //   - `plan_theme`: dominant motif category across the PV
  //     (kingside_attack / simplification / piece_activity / pawn_advance
  //      / tactics / consolidation / structural)
  //   - `plan_brief`: a one-line forward-looking description showing
  //     what THIS move sets up over the next few plies
  //   - `character`: the move's tone — "Aggressive" / "Combative" /
  //     "Positional" / "Solid" / "Risky" / "Forcing" / "Drawish".
  //     A label answering "what kind of move is this?"
  //
  // The character classification combines the move's own motifs with
  // the engine's view of the opponent's reply (multi-PV[0] vs the
  // current eval) — a move whose best opp reply still leaves us much
  // better is forcing; a sharp tactical with a real swing is
  // aggressive; a quiet structural is positional.
  const annotatedMoves = engineRes.moves.map((m, idx) => {
    const result = analyzeMove(fen, m.move)
    const motifIds = (result?.motifs || []).map((x) => x.id)
    const planBrief = inferPlanBrief(fen, m.pv || [], motifIds, attackingSideOf(fen))
    const character = classifyCharacter(motifIds, m, idx, engineRes.moves)
    return {
      uci: m.move,
      san: result?.san || m.move,
      score: m.score,
      mate: m.mate,
      motifs: motifIds,
      // Targets-king flag: any motif that's a king-attack signal.
      targetsKing: motifIds.some((id) => KING_ATTACK_MOTIFS.has(id)),
      headline: result?.motifs?.[0]?.phrase || null,
      plan_theme: planBrief.theme,
      plan_brief: planBrief.text,
      plan_pv: planBrief.pv,
      character: character.label,
      character_reason: character.reason,
    }
  })

  // ── Engine-driven attack potential ──────────────────────────────────
  const targeters = annotatedMoves.filter((m) => m.targetsKing).length
  const total = annotatedMoves.length || 1
  const ratio = targeters / total
  const stm = getSideToMove(fen)
  const attackingSide = stm === 'w' ? 'white' : 'black'
  const defendingSide = stm === 'w' ? 'black' : 'white'
  const attackPotential = {
    attacking_side: attackingSide,
    defending_side: defendingSide,
    moves_targeting_king: targeters,
    total_moves: total,
    ratio,
    summary:
      ratio >= 0.6
        ? `Strong attack potential against the ${defendingSide} king (${targeters}/${total} engine moves target the king)`
        : ratio >= 0.3
          ? `Some attack potential against the ${defendingSide} king`
          : `Low king-attack potential — engine prefers positional play`,
  }

  // Augment the static king_safety section with this signal.
  staticBlob.king_safety.engine_attack_potential = attackPotential

  // ── Plan extraction: walk the principal variation ───────────────────
  const principalPv = (engineRes.moves[0] && engineRes.moves[0].pv) || []
  const planSteps = []
  let curFen = fen
  for (let i = 0; i < Math.min(principalPv.length, PLAN_PLIES); i++) {
    const uci = principalPv[i]
    if (!uci) break
    const result = analyzeMove(curFen, uci)
    if (!result) break
    planSteps.push({
      uci,
      san: result.san,
      motifs: (result.motifs || []).map((m) => m.id),
      headline: result.motifs?.[0]?.phrase || null,
      to: uci.slice(2, 4),
      from: uci.slice(0, 2),
    })
    if (!result.fen_after) break
    curFen = result.fen_after
  }

  // Key squares: any square visited (or arrived at) ≥ 2 times in the PV.
  const squareVisits = new Map()
  planSteps.forEach((step) => {
    ;[step.from, step.to].forEach((sq) => {
      squareVisits.set(sq, (squareVisits.get(sq) || 0) + 1)
    })
  })
  const keySquares = [...squareVisits.entries()]
    .filter(([, n]) => n >= 2)
    .map(([sq]) => sq)
    .sort()

  // Theme inference: which motif category dominates?
  const motifFreq = new Map()
  planSteps.forEach((step) => {
    step.motifs.forEach((m) => motifFreq.set(m, (motifFreq.get(m) || 0) + 1))
  })
  const topMotif = [...motifFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  let planTheme = null
  if (topMotif) {
    if (KING_ATTACK_MOTIFS.has(topMotif)) {
      planTheme = `kingside_attack_${attackingSide}`
    } else if (
      ['simplifies', 'queen_trade', 'piece_trade', 'trades_into_endgame'].includes(topMotif)
    ) {
      planTheme = 'simplification'
    } else if (
      ['outpost', 'centralizes', 'activates', 'knight_invasion', 'rook_lift'].includes(topMotif)
    ) {
      planTheme = 'piece_activity'
    } else if (['passed_pawn', 'pawn_breakthrough', 'promotion'].includes(topMotif)) {
      planTheme = 'pawn_advance'
    } else if (
      ['pin', 'skewer', 'fork', 'discovered_check', 'sacrifice', 'greek_gift'].includes(topMotif)
    ) {
      planTheme = 'tactics'
    } else {
      planTheme = topMotif.replace(/_/g, '_')
    }
  }

  // ── Eval reconciliation ─────────────────────────────────────────────
  //
  // The static-blob field `eval_cp` was computed by the Rust HCE
  // evaluator (no search). At depth-14 Stockfish frequently sees a
  // very different value — sometimes by hundreds of cp — because it
  // resolves tactics the HCE doesn't. The eval bar uses Stockfish's
  // value (authoritative); the AboutPosition verdict was using the
  // HCE value, so the two could disagree by 300+ cp.
  //
  // Fix: keep both, but the canonical `eval_cp` becomes the engine's.
  // AboutPosition's verdict will now match the eval bar exactly.
  // CRITICAL: Stockfish's UCI score is from the SIDE-TO-MOVE'S perspective
  // (positive = good for whoever's about to play), NOT white-POV. The
  // Rust HCE's `final_cp` IS white-POV. The eval bar normalises to
  // white-POV via `normalizeToWhite(score, turn)` in analysis.js — here
  // we must do the same flip, otherwise the verdict reads "Black is
  // clearly winning" on a +5.55 white position. (The user reported
  // exactly this.)
  if (typeof engineRes.score === 'number') {
    const stmIsWhite_ = stm === 'w'
    const whitePovScore = stmIsWhite_ ? engineRes.score : -engineRes.score
    staticBlob.static_eval_cp = staticBlob.eval_cp
    staticBlob.eval_cp = whitePovScore
    staticBlob.eval_pawns = whitePovScore / 100
    if (engineRes.mate !== null && engineRes.mate !== undefined) {
      // Mate scores share the same convention.
      staticBlob.eval_mate = stmIsWhite_ ? engineRes.mate : -engineRes.mate
    }
  }

  // ── Plan description rewrite: piece journeys + target squares ─────
  //
  // The previous version emitted generic prose like "White's plan is
  // a kingside attack" — useless. Now we walk the PV ply-by-ply and
  // name:
  //
  //   1. The PRINCIPAL PIECE — the one that does most of the work
  //      (multiple moves, or a piece that lands on a key square).
  //   2. The DESTINATION squares — where pieces end up.
  //   3. The TARGET — a recurring attacked square or captured piece.
  //   4. The CHARACTER — kingside attack / simplification / structural
  //      / pawn advance.
  //
  // Generated prose looks like:
  //   "After Bb3, White routes the knight to f5 then g5, building
  //    threats around h7. Engine line: Nf5 Bd6 Bb3 Re8 Ng5 Re7 Qh5."
  // or:
  //   "Trades the knights and heads into a pawn-up rook ending."
  //   "Pushes the d5 pawn through to promote."
  const description = composePlanDescription(planSteps, planTheme, attackingSide, fen, engineRes)

  staticBlob.principal_plan = {
    eval_cp: engineRes.score ?? 0,
    eval_mate: engineRes.mate ?? null,
    depth: planDepth,
    moves: planSteps,
    key_squares: keySquares,
    theme: planTheme,
    description,
  }

  staticBlob.engine_top_moves = annotatedMoves

  // ── Zugzwang detection (engine-aware) ───────────────────────────────
  //
  // Zugzwang = side-to-move would prefer to pass; every legal move
  // worsens their position. We approximate by comparing:
  //   - engine's score for STM's BEST move (score after that move,
  //     from STM's POV)
  //   - the position's static eval (what STM had right now, before
  //     they had to commit to a move)
  //
  // If the best-move's score is meaningfully WORSE for STM than the
  // current static eval (≥ 50 cp drop), it indicates the move
  // requirement itself is the problem — i.e., zugzwang.
  //
  // We only fire when the position is also low-piece (endgame) since
  // zugzwang in middlegames is rare and harder to verify statically.
  // Zugzwang detection — uses the HCE static eval (preserved as
  // `static_eval_cp`) as the "free-move" approximation, vs the engine's
  // best-move score. Both converted to STM-POV.
  //
  // Stockfish's `info score cp` is ALREADY STM-POV at the search root,
  // so `bestRaw` needs no flip. The HCE blob field is white-POV; flip
  // to STM-POV for the comparison.
  const stmIsWhite = stm === 'w'
  const stmStaticCp = stmIsWhite
    ? (staticBlob.static_eval_cp ?? staticBlob.eval_cp ?? 0)
    : -(staticBlob.static_eval_cp ?? staticBlob.eval_cp ?? 0)
  const bestStmCp = annotatedMoves[0]?.score ?? null // already STM-POV
  // Require a meaningful gap (≥ 200 cp) AND endgame phase — middlegame
  // zugzwang is rare and the HCE-vs-engine gap inflates the signal in
  // tactical positions.
  if (bestStmCp !== null && stmStaticCp - bestStmCp >= 200 && staticBlob.phase === 'endgame') {
    const stmCap = stmIsWhite ? 'White' : 'Black'
    const drop = ((stmStaticCp - bestStmCp) / 100).toFixed(2)
    staticBlob.themes.push({
      id: 'zugzwang',
      side: stmIsWhite ? 'black' : 'white',
      strength: 80,
      description: `${stmCap} is in zugzwang — every move concedes (best move drops ${drop} pawns)`,
    })
  }

  // ── Zwischenzug detection ───────────────────────────────────────────
  //
  // A Zwischenzug ("in-between move") is an intermediate move — usually
  // a check, a heavier capture, or a stronger threat — inserted into
  // what looked like a forced sequence. Classic case: side captures
  // expecting recapture, but opponent plays a check first.
  //
  // We flag the principal plan's PV[1] as a Zwischenzug iff:
  //   - PV[0] (our move) was a CAPTURE, and
  //   - PV[1] (opp's response) is NOT the recapture on PV[0].to,
  //     but instead a check / capture / discovered_check.
  //
  // This is heuristic — only fires when both conditions clearly hold.
  if (planSteps.length >= 2) {
    const ourMove = planSteps[0]
    const oppReply = planSteps[1]
    const ourMoveIsCapture = (ourMove?.motifs || []).some((m) =>
      ['capture', 'piece_trade', 'queen_trade', 'simplifies', 'exchange_sacrifice'].includes(m),
    )
    const oppRecaptured = oppReply?.to === ourMove?.to
    const oppIntermezzo = (oppReply?.motifs || []).some((m) =>
      [
        'check',
        'discovered_check',
        'double_check',
        'capture',
        'threatens',
        'fork',
        'pin',
        'skewer',
        'removes_defender',
      ].includes(m),
    )
    if (ourMoveIsCapture && !oppRecaptured && oppIntermezzo) {
      staticBlob.principal_plan.zwischenzug = {
        ply: 2,
        san: oppReply.san,
        description: `Zwischenzug — ${oppReply.san} is an in-between move that gains time before the recapture`,
      }
      staticBlob.themes.push({
        id: 'zwischenzug',
        side: stmIsWhite ? 'black' : 'white',
        strength: 70,
        description: `Watch for the Zwischenzug ${oppReply.san} — opponent inserts ${oppReply.san} before recapturing`,
      })
    }
  }

  // ── GM-style narrative ──────────────────────────────────────────────
  // Compose a structured paragraph from the now-complete blob. This is
  // the LLM-ready handoff: a baseline narrative an LLM can refine.
  staticBlob.summary_text = composeNarrative(staticBlob)

  // ── New themes ──────────────────────────────────────────────────────
  if (ratio >= 0.6) {
    staticBlob.themes.push({
      id: 'engine_attack_potential',
      side: attackingSide,
      strength: Math.round(ratio * 100),
      description: attackPotential.summary,
    })
  }
  if (planTheme) {
    staticBlob.themes.push({
      id: 'engine_plan',
      side: attackingSide,
      strength: 60,
      description: staticBlob.principal_plan.description || `Plan: ${planTheme}`,
    })
  }

  // ── LLM Bridge ──────────────────────────────────────────────────────
  // Extract a token-efficient DTO for the LLM mentor.
  staticBlob.llm_payload = extractLlmPayload(staticBlob)

  return staticBlob
}

// ───────────────────────────────────────────────────────────────────────────
// composeNarrative — synthesise a GM-style paragraph from the blob.
//
// The output is a multi-line string. Each "paragraph" is one structural
// observation: verdict, material, king safety, activity, structure,
// tactics, plan. Empty sections are skipped.
//
// This is intentionally formulaic — it's the *baseline* an LLM would
// enhance. We ground every claim in the blob so an LLM can verify and
// embellish without inventing facts.
// ───────────────────────────────────────────────────────────────────────────

function pawns(cp) {
  return (cp / 100).toFixed(2)
}
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function composeNarrative(blob) {
  const lines = []
  const stm = blob.side_to_move // "white" / "black"
  const evalCp = blob.eval_cp

  // ── 1. Verdict opening — read like a game annotator ────────────────
  if (Math.abs(evalCp) < 25) {
    lines.push(`The position is roughly equal. ${cap(stm)} to move.`)
  } else {
    const side = evalCp > 0 ? 'White' : 'Black'
    const mag = Math.abs(evalCp)
    const adj =
      mag < 75
        ? 'a slight edge'
        : mag < 200
          ? 'a clear edge'
          : mag < 500
            ? 'a winning advantage'
            : 'a decisive advantage'
    // Pair the magnitude verdict with the move-number context for grounding.
    const moveCtx = blob.move_number ? `Move ${blob.move_number}` : ''
    const phaseCtx = blob.phase ? `; ${blob.phase}` : ''
    const ctx = moveCtx || phaseCtx ? ` ${moveCtx}${phaseCtx}.` : ''
    lines.push(
      `${side} has ${adj} of ${pawns(mag)} (engine eval ${evalCp > 0 ? '+' : ''}${pawns(evalCp)}). ${cap(stm)} to move.${ctx}`,
    )
  }

  // ── 2. Leading factor + breakdown ──────────────────────────────────
  const leading = (blob.themes || [])
    .filter((t) => t.id !== 'leading_factor')
    .sort((a, b) => b.strength - a.strength)[0]
  if (leading) {
    lines.push(`The leading factor: ${leading.description.toLowerCase()}.`)
  }

  // Eval breakdown — name the heads with the biggest contribution.
  if (blob.eval_breakdown) {
    const eb = blob.eval_breakdown
    const heads = [
      ['psqt_cp', 'piece placement'],
      ['mobility_cp', 'piece mobility'],
      ['king_safety_cp', 'king safety'],
      ['threats_cp', 'threat creation'],
      ['pawns_cp', 'pawn structure'],
      ['imbalance_cp', 'imbalance (e.g. bishop pair)'],
    ]
    const ranked = heads
      .map(([k, n]) => ({ key: k, name: n, value: eb[k] || 0 }))
      .filter((x) => Math.abs(x.value) >= 30)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    if (ranked.length > 0) {
      const phr = ranked
        .slice(0, 2)
        .map(
          (r) =>
            `${r.value > 0 ? 'White' : 'Black'} ${r.name} (${r.value > 0 ? '+' : ''}${pawns(r.value)})`,
        )
      lines.push(`The score breaks down to: ${phr.join('; ')}.`)
    }
  }

  // ── 3. Material ─────────────────────────────────────────────────────
  if (blob.material) {
    const m = blob.material
    const mat_lines = []
    if (Math.abs(m.material_delta_cp) >= 100) {
      const side = m.material_delta_cp > 0 ? 'White' : 'Black'
      mat_lines.push(
        `${side} is ahead in material (${pawns(Math.abs(m.material_delta_cp))} pawns).`,
      )
    } else {
      mat_lines.push('Material is roughly even.')
    }
    if (m.bishop_pair_white && !m.bishop_pair_black) mat_lines.push('White holds the bishop pair.')
    if (m.bishop_pair_black && !m.bishop_pair_white) mat_lines.push('Black holds the bishop pair.')
    if (m.opposite_color_bishops)
      mat_lines.push(
        'Opposite-coloured bishops on the board (drawish in pure endings; sharp with extra attackers).',
      )
    lines.push(mat_lines.join(' '))
  }

  // ── 4. King safety ─────────────────────────────────────────────────
  if (blob.king_safety) {
    const ks = blob.king_safety
    const ks_lines = []
    const dw = ks.white?.danger_score || 0
    const db = ks.black?.danger_score || 0
    if (Math.abs(dw - db) >= 80) {
      const safer = dw < db ? 'white' : 'black'
      const exposed = safer === 'white' ? 'black' : 'white'
      ks_lines.push(`${cap(safer)}'s king is meaningfully safer than ${cap(exposed)}'s.`)
    }
    if (ks.white?.open_files_to_king?.length) {
      ks_lines.push(
        `White's king is exposed on the ${ks.white.open_files_to_king.join('-, ')}-file(s).`,
      )
    }
    if (ks.black?.open_files_to_king?.length) {
      ks_lines.push(
        `Black's king is exposed on the ${ks.black.open_files_to_king.join('-, ')}-file(s).`,
      )
    }
    if (ks.white?.attacker_count >= 3) {
      ks_lines.push(`White has ${ks.white.attacker_count} pieces in the black king's zone.`)
    }
    if (ks.black?.attacker_count >= 3) {
      ks_lines.push(`Black has ${ks.black.attacker_count} pieces in the white king's zone.`)
    }
    if (ks.engine_attack_potential && ks.engine_attack_potential.ratio >= 0.4) {
      ks_lines.push(ks.engine_attack_potential.summary + '.')
    }
    if (ks_lines.length) lines.push(ks_lines.join(' '))
  }

  // ── 5. Activity / space ─────────────────────────────────────────────
  if (blob.activity) {
    const a = blob.activity
    const a_lines = []
    const mw = a.white?.total_mobility || 0
    const mb = a.black?.total_mobility || 0
    if (Math.abs(mw - mb) >= 8) {
      const side = mw > mb ? 'White' : 'Black'
      a_lines.push(
        `${side} has more piece activity (${Math.max(mw, mb)} vs ${Math.min(mw, mb)} squares of mobility).`,
      )
    }
    const sw = a.white?.squares_in_enemy_half || 0
    const sb = a.black?.squares_in_enemy_half || 0
    if (Math.abs(sw - sb) >= 6) {
      const side = sw > sb ? 'White' : 'Black'
      a_lines.push(`${side} controls more space in the enemy half.`)
    }
    if ((a.white?.outposts?.length || 0) > 0) {
      a_lines.push(
        `White has outposts on ${a.white.outposts.map((o) => `${o.piece}/${o.square}`).join(', ')}.`,
      )
    }
    if ((a.black?.outposts?.length || 0) > 0) {
      a_lines.push(
        `Black has outposts on ${a.black.outposts.map((o) => `${o.piece}/${o.square}`).join(', ')}.`,
      )
    }
    if (a.white?.bad_bishop)
      a_lines.push(`White's bishop on ${a.white.bad_bishop} is hemmed in by its own pawns.`)
    if (a.black?.bad_bishop)
      a_lines.push(`Black's bishop on ${a.black.bad_bishop} is hemmed in by its own pawns.`)
    if (a_lines.length) lines.push(a_lines.join(' '))
  }

  // ── 6. Pawn structure ──────────────────────────────────────────────
  if (blob.pawn_structure) {
    const ps = blob.pawn_structure
    const ps_lines = []
    if (ps.iqp_white && !ps.iqp_black)
      ps_lines.push(
        'White has an isolated queen pawn — long-term weakness in exchange for active piece play.',
      )
    if (ps.iqp_black && !ps.iqp_white)
      ps_lines.push(
        'Black has an isolated queen pawn — long-term weakness in exchange for active piece play.',
      )
    if (ps.hanging_pawns_white)
      ps_lines.push('White has hanging pawns (a c+d or d+e pawn pair without flanking support).')
    if (ps.hanging_pawns_black) ps_lines.push('Black has hanging pawns.')
    if (ps.light_complex_weak)
      ps_lines.push(`${cap(ps.light_complex_weak)}'s light squares are weak.`)
    if (ps.dark_complex_weak) ps_lines.push(`${cap(ps.dark_complex_weak)}'s dark squares are weak.`)
    if (ps.white?.passed?.length)
      ps_lines.push(`White has passed pawns: ${ps.white.passed.join(', ')}.`)
    if (ps.black?.passed?.length)
      ps_lines.push(`Black has passed pawns: ${ps.black.passed.join(', ')}.`)
    if (ps.white?.isolated?.length)
      ps_lines.push(`White isolated: ${ps.white.isolated.join(', ')}.`)
    if (ps.black?.isolated?.length)
      ps_lines.push(`Black isolated: ${ps.black.isolated.join(', ')}.`)
    if (ps_lines.length) lines.push(ps_lines.join(' '))
  }

  // ── 7. Line control ────────────────────────────────────────────────
  if (blob.line_control) {
    const lc = blob.line_control
    const l_lines = []
    const controlled = (lc.open_files || []).filter((f) => f.controlling_side)
    if (controlled.length) {
      const phr = controlled.map((f) => `${cap(f.controlling_side)} controls the ${f.file}-file`)
      l_lines.push(phr.join('; ') + '.')
    }
    if (lc.long_diagonal_a1h8)
      l_lines.push(`${cap(lc.long_diagonal_a1h8)} controls the long a1-h8 diagonal.`)
    if (lc.long_diagonal_h1a8)
      l_lines.push(`${cap(lc.long_diagonal_h1a8)} controls the long h1-a8 diagonal.`)
    if (lc.seventh_rank_dominant)
      l_lines.push(`${cap(lc.seventh_rank_dominant)} has rook(s) on the seventh — pigs on the 7th.`)
    if (l_lines.length) lines.push(l_lines.join(' '))
  }

  // ── 8. Tactics ─────────────────────────────────────────────────────
  if (blob.tactics) {
    const t = blob.tactics
    const t_lines = []
    if (t.hanging_white?.length) {
      t_lines.push(
        `White has hanging material: ${t.hanging_white.map((h) => `${h.role} on ${h.square}`).join(', ')}.`,
      )
    }
    if (t.hanging_black?.length) {
      t_lines.push(
        `Black has hanging material: ${t.hanging_black.map((h) => `${h.role} on ${h.square}`).join(', ')}.`,
      )
    }
    if (t.pinned_pieces?.length) {
      const phr = t.pinned_pieces.map(
        (p) => `${p.role} on ${p.square} pinned${p.absolute ? ' absolutely to the king' : ''}`,
      )
      t_lines.push(phr.join('; ') + '.')
    }
    if (t_lines.length) lines.push(t_lines.join(' '))
  }

  // ── 9. Engine plan ─────────────────────────────────────────────────
  if (blob.principal_plan && blob.principal_plan.description) {
    const p = blob.principal_plan
    let txt = p.description
    if (p.moves && p.moves.length > 0) {
      const sans = p.moves.map((m) => m.san).join(' ')
      txt += ` Engine PV: ${sans}.`
    }
    if (p.key_squares && p.key_squares.length > 0) {
      txt += ` Key squares: ${p.key_squares.join(', ')}.`
    }
    lines.push(txt)
  }

  return lines.filter((l) => l.trim().length > 0).join('\n').trim()
}

// ───────────────────────────────────────────────────────────────────────────
// composePlanDescription — concrete prose from the principal-PV walk.
//
// Tracks each piece's movements through the PV (a piece may move once,
// twice, three times during the line — that's a maneuver). Identifies
// the most-active piece per side, the destinations they reach, and any
// target square that gets attacked repeatedly. Returns a single sentence
// the user can read ("White routes the knight from b1 to f5"), backed
// by the SAN line the engine actually plans.
// ───────────────────────────────────────────────────────────────────────────

const ROLE_NAME_BY_LETTER = { N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' }
function roleNameFromSan(san) {
  if (!san) return null
  const head = san[0]
  return ROLE_NAME_BY_LETTER[head] || (head >= 'a' && head <= 'h' ? 'pawn' : null)
}

function composePlanDescription(planSteps, planTheme, attackingSide, rootFen, engineRes) {
  if (!planSteps || planSteps.length === 0) return null

  // Walk the PV by side. Pieces are tracked by (side, original-from-square)
  // so we can chain a maneuver like Nb1 → d2 → f1 → g3 → f5.
  // We don't have FENs per ply for free here, so we'll approximate
  // sides by parity (PV starts with the side-to-move at root).
  const rootIsWhite = attackingSide === 'white'
  // Each entry: { side, role, from, to, san, captured? }
  const moves = planSteps.map((s, i) => {
    const isOurMove = i % 2 === 0
    const side = isOurMove ? (rootIsWhite ? 'white' : 'black') : rootIsWhite ? 'black' : 'white'
    return {
      side,
      role: roleNameFromSan(s.san),
      from: s.from,
      to: s.to,
      san: s.san,
      motifs: s.motifs || [],
    }
  })

  // Track piece journeys (per-side). Key the chain on the FROM square
  // we first see for that side; subsequent moves of the same piece
  // (which start from the previous TO) get linked together.
  const journeys = { white: new Map(), black: new Map() }
  for (const m of moves) {
    if (!m.role || m.role === 'pawn') continue // pawns tracked separately
    const j = journeys[m.side]
    // Find an existing chain that ends at m.from
    let chain = null
    for (const [, c] of j) {
      if (c.lastSquare === m.from) {
        chain = c
        break
      }
    }
    if (chain) {
      chain.path.push(m.to)
      chain.lastSquare = m.to
    } else {
      j.set(m.from, { role: m.role, originalFrom: m.from, path: [m.to], lastSquare: m.to })
    }
  }

  // Identify the most-active piece per side.
  function leadJourney(j) {
    let best = null
    for (const c of j.values()) {
      const len = c.path.length
      if (!best || len > best.path.length) best = c
    }
    return best
  }
  const ourJourney = leadJourney(journeys[attackingSide])

  // Captured pieces (piece-trade type).
  const capturedTargets = []
  for (const m of moves) {
    if (
      m.motifs.some((id) => ['capture', 'piece_trade', 'queen_trade', 'simplifies'].includes(id))
    ) {
      capturedTargets.push({ side: m.side, square: m.to })
    }
  }

  // Pawn pushes (promotion / pawn breakthrough).
  const pawnPushes = moves.filter((m) => m.role === 'pawn' && m.side === attackingSide)

  const sideCap = attackingSide === 'white' ? 'White' : 'Black'
  const oppCap = attackingSide === 'white' ? 'Black' : 'White'

  // ── Compose the prose ───────────────────────────────────────────────
  // We pick ONE concrete observation. Priorities (high → low):
  //   1. Promotion / mate-in-N (engineRes.mate)
  //   2. Multi-step piece maneuver to a specific square
  //   3. Theme-based template (kingside attack / simplification / etc.)
  //   4. Just the SAN line.

  if (typeof engineRes.mate === 'number' && engineRes.mate !== 0) {
    const n = Math.abs(engineRes.mate)
    const winner = engineRes.mate > 0 ? 'White' : 'Black'
    return `${winner} mates in ${n}.`
  }

  if (ourJourney && ourJourney.path.length >= 2) {
    const role = ourJourney.role
    const start = ourJourney.originalFrom
    const dest = ourJourney.path[ourJourney.path.length - 1]
    const intermediate = ourJourney.path.slice(0, -1).join(' → ')
    if (planTheme && planTheme.startsWith('kingside_attack_')) {
      return `${sideCap} routes the ${role} from ${start} via ${intermediate} to ${dest}, building threats against the ${oppCap.toLowerCase()} king.`
    }
    return `${sideCap} maneuvers the ${role} from ${start} to ${dest} (via ${intermediate}).`
  }

  // Pure prose. Don't dump SAN sequences into the description — the
  // user reads English, not coordinate notation. Where we want to be
  // more specific, we describe what's happening (an exchange on a
  // particular square, a pawn pushed to a particular square, a piece
  // landing on a key square) but ALWAYS in natural language.
  if (planTheme && planTheme.startsWith('kingside_attack_')) {
    return `${sideCap} keeps pressing the ${oppCap.toLowerCase()} king with a sequence of attacking moves.`
  }
  if (planTheme === 'simplification') {
    if (capturedTargets.length > 0) {
      return `${sideCap} simplifies — exchanges pieces on ${capturedTargets[0].square} and steers into a clearer endgame.`
    }
    return `${sideCap} reduces the position by trading down.`
  }
  if (planTheme === 'pawn_advance') {
    if (pawnPushes.length > 0) {
      const finalPush = pawnPushes[pawnPushes.length - 1]
      return `${sideCap} pushes the pawn through to ${finalPush.to}, eyeing promotion.`
    }
    return `${sideCap} advances a passed pawn toward promotion.`
  }
  if (planTheme === 'piece_activity') {
    return `${sideCap} improves the worst piece and consolidates active squares.`
  }
  if (planTheme === 'tactics') {
    // Pull the most descriptive headline from the PV's motifs.
    const tacticalStep = planSteps.find((s) =>
      (s.motifs || []).some((id) =>
        ['fork', 'pin', 'skewer', 'discovered_check', 'greek_gift', 'sacrifice'].includes(id),
      ),
    )
    if (tacticalStep && tacticalStep.headline) {
      return `${sideCap} has a concrete tactical sequence: ${tacticalStep.headline.toLowerCase()}.`
    }
    return `${sideCap} sees a concrete tactical sequence in the next few moves.`
  }

  // Fallback — describe the very first ply in prose.
  if (planSteps.length > 0) {
    const first = planSteps[0]
    if (first.headline) {
      return `Engine continues with ${first.san} — ${first.headline.toLowerCase()}.`
    }
    return `Engine plays ${first.san} and continues for ${planSteps.length} more moves.`
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers — per-move plan briefs and character labels.
// ───────────────────────────────────────────────────────────────────────────

function attackingSideOf(fen) {
  const stm = getSideToMove(fen)
  return stm === 'w' ? 'white' : 'black'
}

// Walk a single candidate move's principal variation (its tail of
// engine-preferred continuations from THIS move) and infer:
//   - `theme`: dominant motif category across the PV ply-set
//   - `text`: a one-line forward-looking description
//   - `pv`: the SAN sequence (for display)
function inferPlanBrief(rootFen, pv, rootMotifIds, rootSide) {
  if (!Array.isArray(pv) || pv.length === 0) {
    return { theme: null, text: null, pv: [] }
  }
  // Walk up to PLAN_PLIES of the PV, accumulating motif IDs by category.
  let curFen = rootFen
  const planSteps = []
  const motifFreq = new Map()
  // Include the root move's motifs in the count so the plan reflects
  // what THIS candidate is doing, not just downstream consequences.
  for (const m of rootMotifIds) {
    motifFreq.set(m, (motifFreq.get(m) || 0) + 1)
  }
  for (let i = 0; i < Math.min(pv.length, PLAN_PLIES); i++) {
    const uci = pv[i]
    if (!uci) break
    const result = analyzeMove(curFen, uci)
    if (!result) break
    const ids = (result.motifs || []).map((m) => m.id)
    planSteps.push({ san: result.san, motifs: ids })
    for (const id of ids) motifFreq.set(id, (motifFreq.get(id) || 0) + 1)
    if (!result.fen_after) break
    curFen = result.fen_after
  }

  // Theme inference — same buckets used elsewhere.
  const buckets = {
    kingside_attack: [
      'attacks_king',
      'eyes_king_zone',
      'check',
      'discovered_check',
      'double_check',
      'greek_gift',
      'sacrifice',
      'smothered_hint',
      'back_rank_mate_threat',
      'anastasia_mate_threat',
      'bodens_mate_threat',
      'arabian_mate_threat',
      'decisive_combination',
      'fork',
      'pin',
      'skewer',
      'battery',
    ],
    simplification: [
      'simplifies',
      'queen_trade',
      'piece_trade',
      'trades_into_endgame',
      'exchange_sacrifice',
    ],
    piece_activity: [
      'outpost',
      'centralizes',
      'activates',
      'knight_invasion',
      'rook_lift',
      'rook_seventh',
      'open_file',
      'semi_open_file',
      'doubles_rooks',
      'opens_file_for',
      'opens_diagonal_for',
      'long_diagonal',
      'battery',
    ],
    pawn_advance: [
      'passed_pawn',
      'pawn_breakthrough',
      'promotion',
      'pawn_storm',
      'pawn_break',
      'pawn_lever',
    ],
    consolidation: [
      'defends',
      'prophylaxis',
      'prepares_castling_kingside',
      'prepares_castling_queenside',
      'castles_kingside',
      'castles_queenside',
      'luft',
      'connects_rooks',
    ],
    structural: [
      'iqp_them',
      'hanging_pawns_them',
      'doubled_pawns_them',
      'backward_pawn_them',
      'color_complex_them',
    ],
  }
  const tally = {}
  for (const [bucket, ids] of Object.entries(buckets)) {
    let n = 0
    for (const id of ids) if (motifFreq.has(id)) n += motifFreq.get(id)
    if (n > 0) tally[bucket] = n
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) {
    // No theme-bucketed motifs fired. Be honest — "no specific plan
    // beyond the immediate move" is more useful than dumping a SAN
    // string. Only return prose; the per-move plan brief is plural
    // by intent.
    return {
      theme: null,
      text:
        planSteps.length >= 2
          ? `quiet continuation, no specific tactical or structural theme`
          : null,
      pv: planSteps.map((s) => s.san),
    }
  }
  const [topBucket] = ranked[0]
  const sideCap = rootSide === 'white' ? 'White' : 'Black'
  const text = (() => {
    switch (topBucket) {
      case 'kingside_attack':
        return `Builds ${sideCap}'s attack on the enemy king`
      case 'simplification':
        return `Steers toward simplification — trades reduce material`
      case 'piece_activity':
        return `Improves piece activity — better squares for ${sideCap}'s pieces`
      case 'pawn_advance':
        return `Advances toward promotion — pushes a passed pawn`
      case 'consolidation':
        return `Consolidates ${sideCap}'s position — king safety + coordination`
      case 'structural':
        return `Targets the opponent's structural weaknesses`
      default:
        return null
    }
  })()
  return {
    theme: topBucket,
    text,
    pv: planSteps.map((s) => s.san),
  }
}

// Classify a move by its tone — the kind of game it sets up. Combines
// motifs (what the move IS) with engine signals (how forced /
// committal it is) to label every top-engine move with one of:
//
//   "Forcing"    — opp's best reply is significantly worse than their
//                   second-best (only one good answer)
//   "Aggressive" — clear king-attack / sacrifice motifs
//   "Combative"  — creates threats / forks / pins; sharp but not
//                   king-attack
//   "Risky"      — sacrifice without confirmed compensation
//   "Drawish"    — heads into simplification when already equal
//   "Positional" — outpost / centralization / structural / quiet
//   "Solid"      — castling / development / consolidation
//   "Quiet"      — none of the above signals fire
function classifyCharacter(motifIds, _ourMove, idx, allTopMoves) {
  const hasAny = (ids) => ids.some((id) => motifIds.includes(id))

  // Sacrifice + king attack → Aggressive.
  if (
    hasAny([
      'greek_gift',
      'sacrifice',
      'decisive_combination',
      'smothered_hint',
      'double_check',
      'back_rank_mate_threat',
      'anastasia_mate_threat',
      'bodens_mate_threat',
      'arabian_mate_threat',
    ])
  ) {
    return { label: 'Aggressive', reason: 'Sacrifice / direct king attack' }
  }

  // Strong threat-creating motifs → Combative.
  if (hasAny(['fork', 'pin', 'skewer', 'discovered_check', 'traps_piece', 'removes_defender'])) {
    return { label: 'Combative', reason: 'Creates a sharp threat the opponent must address' }
  }

  // Forcing — opp's #1 reply is significantly worse than their #2.
  // Only meaningful for the TOP engine move (idx 0). For other top
  // moves we rely on motifs alone.
  if (idx === 0 && Array.isArray(allTopMoves) && allTopMoves.length >= 2) {
    const a = allTopMoves[0]?.score ?? 0
    const b = allTopMoves[1]?.score ?? 0
    // Forcing if best is dramatically better than 2nd-best (≥ 200 cp gap).
    if (Math.abs(a - b) >= 200) {
      return { label: 'Forcing', reason: 'Best move dominates alternatives by 2 pawns or more' }
    }
  }

  // Simplification + already equal → Drawish.
  if (hasAny(['simplifies', 'queen_trade', 'piece_trade', 'trades_into_endgame'])) {
    return { label: 'Drawish', reason: 'Simplifies into an equal-or-clearer position' }
  }

  // Positional structural play.
  if (
    hasAny([
      'outpost',
      'knight_invasion',
      'rook_lift',
      'rook_seventh',
      'open_file',
      'semi_open_file',
      'opens_file_for',
      'opens_diagonal_for',
      'long_diagonal',
      'centralizes',
      'activates',
      'passed_pawn',
      'pawn_breakthrough',
      'battery',
      'fianchetto',
    ])
  ) {
    return { label: 'Positional', reason: 'Improves piece position / structural play' }
  }

  // Solid — castling, development, consolidation.
  if (
    hasAny([
      'castles_kingside',
      'castles_queenside',
      'prepares_castling_kingside',
      'prepares_castling_queenside',
      'connects_rooks',
      'luft',
      'prophylaxis',
      'defends',
      'develops',
    ])
  ) {
    return { label: 'Solid', reason: 'King safety / consolidation / development' }
  }

  // Risky — speculative sacrifice / hangs pieces (rare but possible).
  if (hasAny(['hangs', 'exchange_sacrifice'])) {
    return { label: 'Risky', reason: 'Speculative — gives material' }
  }

  return { label: 'Quiet', reason: 'No specific tactical or structural feature' }
}
