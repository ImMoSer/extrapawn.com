// Connectors — explain a move by what it ENABLES, DAMAGES, or PREVENTS,
// not just by its mechanics. Inspired by the user's directive:
//
//   "trading queens quenches an attack, sometimes harms mobility,
//    sometimes leaves your king in the center, worsens pawn
//    structures. connect EVERYTHING, 1 or even 5 moves in advance."
//
// Each connector is a pure function that compares the structured
// blob BEFORE and AFTER a move and emits a one-line consequence
// string when its specific signal fires. The composer (`extract` /
// `composeConsequences`) runs every connector, sorts by importance,
// and returns the top results.
//
// This sits ON TOP of the motif system: motifs say WHAT the move is
// ("Greek gift sacrifice"), connectors say what it CAUSES ("opens
// the long diagonal toward the king", "damages Black's queenside
// pawn structure"). Together they form the connected explanation
// the user asked for.
//
// Public API:
//   extractConsequences(blobBefore, blobAfter, opts) → [{ text, importance, tone }]
//
// `opts.movingSide`  : 'white' | 'black' — whose move just happened.
// `opts.motifs`      : the move's motif IDs (used to pick more specific
//                      phrasing — e.g. quenches_attack reads better
//                      after a queen trade).
// `opts.evalSwingCp` : (after − before) static eval, mover-POV; useful
//                      to colour the consequence's tone.

// ─── Helpers ────────────────────────────────────────────────────────────

function deltaSquares(beforeArr, afterArr) {
  // Set-difference helper for arrays of squares ('d5'), files ('e'), or
  // any string identifier. Returns the items added in `afterArr` and
  // those removed from `beforeArr`.
  const b = new Set(beforeArr || [])
  const a = new Set(afterArr || [])
  return {
    added: [...a].filter((x) => !b.has(x)),
    removed: [...b].filter((x) => !a.has(x)),
  }
}

// Side names from a side keyword ("white" / "black").
function sideCap(s) {
  return s === 'white' ? 'White' : 'Black'
}
function otherSide(s) {
  return s === 'white' ? 'black' : 'white'
}

// ─── Connectors ─────────────────────────────────────────────────────────
// Each connector pushes 0+ entries into `out`. Higher `importance` →
// surfaced first in the UI. Tone is pure semantic: 'good' (own side
// gains), 'bad' (own side loses), 'neutral' (descriptive).

function king_caught_in_centre(before, after, out, opts) {
  // Side just lost both castling rights AND the king is still on its
  // starting square. Mid-game (phase != endgame) only.
  if (after?.phase === 'endgame') return
  const sides = ['white', 'black']
  for (const s of sides) {
    const ksB = before?.king_safety?.[s]
    const ksA = after?.king_safety?.[s]
    if (!ksB || !ksA) continue
    const start = s === 'white' ? 'e1' : 'e8'
    if (ksA.king_square !== start) continue
    if (ksA.castled) continue
    const lostBoth =
      (ksB.castling_rights_kingside || ksB.castling_rights_queenside) &&
      !(ksA.castling_rights_kingside || ksA.castling_rights_queenside)
    if (lostBoth) {
      out.push({
        importance: 80,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Leaves ${sideCap(s)}'s king stuck in the centre — castling rights gone`,
      })
    }
  }
}

function quenches_attack(before, after, out, opts) {
  // engine_attack_potential — only present when the engine ran a
  // multi-PV pass on both blobs. Ratio drop ≥ 0.4 is meaningful.
  const eapB = before?.king_safety?.engine_attack_potential
  const eapA = after?.king_safety?.engine_attack_potential
  if (!eapB || !eapA) return
  const drop = (eapB.ratio || 0) - (eapA.ratio || 0)
  if (drop >= 0.4) {
    const attacker = eapB.attacking_side
    const defender = otherSide(attacker)
    const isOurAttack = attacker === opts.movingSide
    if (!isOurAttack) {
      out.push({
        importance: 75,
        tone: 'good',
        text: `Quenches ${sideCap(attacker)}'s attack on the ${defender} king (engine targeting dropped from ${eapB.moves_targeting_king}/${eapB.total_moves} to ${eapA.moves_targeting_king}/${eapA.total_moves})`,
      })
    } else {
      out.push({
        importance: 75,
        tone: 'bad',
        text: `Gives up the kingside initiative — engine no longer prioritises attacking moves`,
      })
    }
  }
  const rise = (eapA.ratio || 0) - (eapB.ratio || 0)
  if (rise >= 0.4) {
    const attacker = eapA.attacking_side
    const isOurAttack = attacker === opts.movingSide
    out.push({
      importance: 70,
      tone: isOurAttack ? 'good' : 'bad',
      text: `Opens up attacking chances against the ${otherSide(attacker)} king (${eapA.moves_targeting_king} of the engine's top ${eapA.total_moves} now target the king)`,
    })
  }
}

function damages_pawn_structure(before, after, out, opts) {
  const psB = before?.pawn_structure || {}
  const psA = after?.pawn_structure || {}

  // IQP creation
  if (!psB.iqp_white && psA.iqp_white) {
    const cause = opts.movingSide === 'white' ? 'self' : 'opp'
    out.push({
      importance: cause === 'opp' ? 65 : 45,
      tone: cause === 'opp' ? 'good' : 'bad',
      text: `Saddles White with an isolated d-pawn (long-term weakness)`,
    })
  }
  if (!psB.iqp_black && psA.iqp_black) {
    const cause = opts.movingSide === 'black' ? 'self' : 'opp'
    out.push({
      importance: cause === 'opp' ? 65 : 45,
      tone: cause === 'opp' ? 'good' : 'bad',
      text: `Saddles Black with an isolated d-pawn (long-term weakness)`,
    })
  }
  // Hanging pawns
  if (!psB.hanging_pawns_white && psA.hanging_pawns_white) {
    out.push({
      importance: 55,
      tone: opts.movingSide === 'white' ? 'bad' : 'good',
      text: `Creates hanging pawns in White's structure`,
    })
  }
  if (!psB.hanging_pawns_black && psA.hanging_pawns_black) {
    out.push({
      importance: 55,
      tone: opts.movingSide === 'black' ? 'bad' : 'good',
      text: `Creates hanging pawns in Black's structure`,
    })
  }
  // Color-complex weakness creation
  if (!psB.light_complex_weak && psA.light_complex_weak) {
    out.push({
      importance: 70,
      tone: psA.light_complex_weak === opts.movingSide ? 'bad' : 'good',
      text: `Permanently weakens ${sideCap(psA.light_complex_weak)}'s light squares`,
    })
  }
  if (!psB.dark_complex_weak && psA.dark_complex_weak) {
    out.push({
      importance: 70,
      tone: psA.dark_complex_weak === opts.movingSide ? 'bad' : 'good',
      text: `Permanently weakens ${sideCap(psA.dark_complex_weak)}'s dark squares`,
    })
  }
  // Backward / isolated pawns delta (per side)
  for (const s of ['white', 'black']) {
    const isoDelta = deltaSquares(psB[s]?.isolated, psA[s]?.isolated)
    for (const sq of isoDelta.added) {
      out.push({
        importance: 35,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Isolates ${sideCap(s)}'s pawn on ${sq}`,
      })
    }
    const backDelta = deltaSquares(psB[s]?.backward, psA[s]?.backward)
    for (const sq of backDelta.added) {
      out.push({
        importance: 35,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Leaves ${sideCap(s)}'s pawn on ${sq} backward`,
      })
    }
  }
}

function creates_passer(before, after, out, opts) {
  for (const s of ['white', 'black']) {
    const d = deltaSquares(before?.pawn_structure?.[s]?.passed, after?.pawn_structure?.[s]?.passed)
    for (const sq of d.added) {
      out.push({
        importance: 75,
        tone: s === opts.movingSide ? 'good' : 'bad',
        text: `Creates a passed pawn on ${sq} for ${sideCap(s)}`,
      })
    }
  }
}

function changes_outposts(before, after, out, opts) {
  for (const s of ['white', 'black']) {
    const beforeOps = (before?.activity?.[s]?.outposts || []).map((o) => o.square)
    const afterOps = (after?.activity?.[s]?.outposts || []).map((o) => o.square)
    const d = deltaSquares(beforeOps, afterOps)
    for (const sq of d.added) {
      out.push({
        importance: 50,
        tone: s === opts.movingSide ? 'good' : 'bad',
        text: `${sideCap(s)} establishes an outpost on ${sq}`,
      })
    }
    for (const sq of d.removed) {
      out.push({
        importance: 40,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `${sideCap(s)}'s outpost on ${sq} disappears`,
      })
    }
  }
}

function mobility_change(before, after, out, opts) {
  for (const s of ['white', 'black']) {
    const mB = before?.activity?.[s]?.total_mobility || 0
    const mA = after?.activity?.[s]?.total_mobility || 0
    const delta = mA - mB
    if (delta <= -8) {
      out.push({
        importance: 45,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Cramps ${sideCap(s)}'s pieces (${Math.abs(delta)} fewer squares of mobility)`,
      })
    } else if (delta >= 8) {
      out.push({
        importance: 40,
        tone: s === opts.movingSide ? 'good' : 'bad',
        text: `Frees ${sideCap(s)}'s pieces (${delta} more squares of mobility)`,
      })
    }
  }
}

function bishop_pair_change(before, after, out, opts) {
  const matB = before?.material || {}
  const matA = after?.material || {}
  if (matB.bishop_pair_white && !matA.bishop_pair_white) {
    out.push({
      importance: 65,
      tone: opts.movingSide === 'white' ? 'bad' : 'good',
      text: `Surrenders White's bishop pair`,
    })
  }
  if (matB.bishop_pair_black && !matA.bishop_pair_black) {
    out.push({
      importance: 65,
      tone: opts.movingSide === 'black' ? 'bad' : 'good',
      text: `Surrenders Black's bishop pair`,
    })
  }
}

function king_exposure_change(before, after, out, opts) {
  for (const s of ['white', 'black']) {
    const ksB = before?.king_safety?.[s]
    const ksA = after?.king_safety?.[s]
    if (!ksB || !ksA) continue

    // Open files toward the king — newly opened.
    const fileDelta = deltaSquares(ksB.open_files_to_king, ksA.open_files_to_king)
    for (const f of fileDelta.added) {
      out.push({
        importance: 65,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Opens the ${f}-file toward ${sideCap(s)}'s king`,
      })
    }
    // Attacker count jumps.
    const aB = ksB.attacker_count || 0
    const aA = ksA.attacker_count || 0
    if (aA - aB >= 2) {
      out.push({
        importance: 65,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Pulls ${aA - aB} more attackers into ${sideCap(s)}'s king zone`,
      })
    }
    // Pawn-shield collapse.
    const shieldB = ksB.pawn_shield_score || 0
    const shieldA = ksA.pawn_shield_score || 0
    if (shieldB - shieldA >= 33) {
      out.push({
        importance: 60,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Cracks ${sideCap(s)}'s pawn shield`,
      })
    }
  }
}

function hangs_change(before, after, out, opts) {
  // New hanging pieces on either side.
  for (const s of ['white', 'black']) {
    const beforeKey = s === 'white' ? 'hanging_white' : 'hanging_black'
    const beforeSqs = (before?.tactics?.[beforeKey] || []).map((h) => h.square)
    const afterSqs = (after?.tactics?.[beforeKey] || []).map((h) => h.square)
    const d = deltaSquares(beforeSqs, afterSqs)
    for (const sq of d.added) {
      const hangAfter = (after.tactics[beforeKey] || []).find((h) => h.square === sq)
      const role = hangAfter?.role || 'piece'
      out.push({
        importance: 90,
        tone: s === opts.movingSide ? 'bad' : 'good',
        text: `Leaves ${sideCap(s)}'s ${role} on ${sq} hanging`,
      })
    }
  }
}

function line_control_change(before, after, out, opts) {
  // Open files newly controlled.
  const filesBefore = (before?.line_control?.open_files || [])
    .filter((f) => f.controlling_side)
    .map((f) => `${f.controlling_side}/${f.file}`)
  const filesAfter = (after?.line_control?.open_files || [])
    .filter((f) => f.controlling_side)
    .map((f) => `${f.controlling_side}/${f.file}`)
  const d = deltaSquares(filesBefore, filesAfter)
  for (const k of d.added) {
    const [side, file] = k.split('/')
    out.push({
      importance: 50,
      tone: side === opts.movingSide ? 'good' : 'bad',
      text: `${sideCap(side)} seizes the ${file}-file`,
    })
  }
  // Long diagonals.
  const ldB1 = before?.line_control?.long_diagonal_a1h8
  const ldA1 = after?.line_control?.long_diagonal_a1h8
  if (ldA1 && ldA1 !== ldB1) {
    out.push({
      importance: 50,
      tone: ldA1 === opts.movingSide ? 'good' : 'bad',
      text: `${sideCap(ldA1)} takes the long a1-h8 diagonal`,
    })
  }
  const ldB2 = before?.line_control?.long_diagonal_h1a8
  const ldA2 = after?.line_control?.long_diagonal_h1a8
  if (ldA2 && ldA2 !== ldB2) {
    out.push({
      importance: 50,
      tone: ldA2 === opts.movingSide ? 'good' : 'bad',
      text: `${sideCap(ldA2)} takes the long h1-a8 diagonal`,
    })
  }
  // 7th-rank dominance.
  const r7B = before?.line_control?.seventh_rank_dominant
  const r7A = after?.line_control?.seventh_rank_dominant
  if (r7A && r7A !== r7B) {
    const rank = r7A === 'white' ? '7th' : '2nd'
    out.push({
      importance: 60,
      tone: r7A === opts.movingSide ? 'good' : 'bad',
      text: `${sideCap(r7A)} establishes a rook on the ${rank} rank`,
    })
  }
}

function plan_summary(before, after, out) {
  // Engine-derived: when after-blob has a principal_plan with a
  // recognised theme, surface it as a forward-looking consequence.
  const plan = after?.principal_plan
  if (!plan || !plan.theme) return
  const theme = plan.theme
  let text = null
  if (theme === 'kingside_attack_white')
    text = `Sets up White's kingside attack — engine plans ${
      plan.moves
        ?.slice(0, 3)
        .map((m) => m.san)
        .join(' ') || ''
    }`
  else if (theme === 'kingside_attack_black')
    text = `Sets up Black's kingside attack — engine plans ${
      plan.moves
        ?.slice(0, 3)
        .map((m) => m.san)
        .join(' ') || ''
    }`
  else if (theme === 'simplification')
    text = `Heads into simplification (engine prefers trades next)`
  else if (theme === 'piece_activity')
    text = `Engine aims to improve piece activity next: ${
      plan.moves
        ?.slice(0, 3)
        .map((m) => m.san)
        .join(' ') || ''
    }`
  else if (theme === 'pawn_advance') text = `Engine plans a pawn advance / promotion attempt`
  else if (theme === 'tactics')
    text = `Concrete tactical sequence available: ${
      plan.moves
        ?.slice(0, 3)
        .map((m) => m.san)
        .join(' ') || ''
    }`
  if (text) {
    out.push({ importance: 55, tone: 'neutral', text })
  }
}

const CONNECTORS = [
  king_caught_in_centre,
  quenches_attack,
  damages_pawn_structure,
  creates_passer,
  changes_outposts,
  mobility_change,
  bishop_pair_change,
  king_exposure_change,
  hangs_change,
  line_control_change,
  plan_summary,
]

// ─── Public composer ────────────────────────────────────────────────────

export function extractConsequences(blobBefore, blobAfter, opts = {}) {
  if (!blobBefore || !blobAfter) return []
  const movingSide = opts.movingSide || 'white'
  const out = []
  const ctx = {
    movingSide,
    motifs: opts.motifs || [],
    evalSwingCp: opts.evalSwingCp ?? 0,
  }
  for (const c of CONNECTORS) {
    try {
      c(blobBefore, blobAfter, out, ctx)
    } catch {
      /* connectors are best-effort */
    }
  }
  // Sort by importance descending, dedupe by text.
  const seen = new Set()
  return out
    .sort((a, b) => b.importance - a.importance)
    .filter((c) => {
      if (seen.has(c.text)) return false
      seen.add(c.text)
      return true
    })
}

// Convenience: a one-line "consequence string" suitable for showing
// directly under a move's tagline. Picks the highest-importance entry,
// optionally combining with the second when both are strong and have
// the same tone (e.g. two "bad for white" consequences chained).
export function topConsequenceLine(blobBefore, blobAfter, opts) {
  const cs = extractConsequences(blobBefore, blobAfter, opts)
  if (cs.length === 0) return null
  const top = cs[0]
  const second = cs[1]
  // Combine if both are similarly important AND share tone (good+good or
  // bad+bad). This produces the natural "X while Y" chained sentence
  // the user asked for.
  if (
    second &&
    Math.abs(top.importance - second.importance) <= 15 &&
    top.tone === second.tone &&
    top.tone !== 'neutral'
  ) {
    return `${top.text}; ${second.text.charAt(0).toLowerCase()}${second.text.slice(1)}`
  }
  return top.text
}
