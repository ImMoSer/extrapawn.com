
/**
 * fact-extractor.js
 * 
 * Extrahiert konkrete, menschlich lesbare Fakten aus einem Explanation-Blob.
 * Diese Logik wird sowohl für die UI (CoachPositionSummary) als auch für
 * das LLM (Bridge) verwendet, um Konsistenz zu garantieren.
 */

export function extractConcreteFacts(blob) {
  if (!blob) return [];
  const facts = [];

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // 1. Material
  const mat = blob.material || {};
  if (mat.bishop_pair_white && !mat.bishop_pair_black)
    facts.push({ side: 'white', importance: 60, text: 'White has the bishop pair' });
  if (mat.bishop_pair_black && !mat.bishop_pair_white)
    facts.push({ side: 'black', importance: 60, text: 'Black has the bishop pair' });
  if (mat.opposite_color_bishops)
    facts.push({ side: 'both', importance: 50, text: 'Opposite-coloured bishops on the board' });
  if (Math.abs(mat.material_delta_cp || 0) >= 100) {
    const pawns = (Math.abs(mat.material_delta_cp) / 100).toFixed(1);
    const side = mat.material_delta_cp > 0 ? 'White' : 'Black';
    facts.push({
      side: side.toLowerCase(),
      importance: Math.min(95, 60 + Math.round(Math.abs(mat.material_delta_cp) / 50)),
      text: `${side} is up ${pawns} ${pawns === '1.0' ? 'pawn' : 'pawns'} of material`,
    });
  }

  // 2. Pawn structure
  const ps = blob.pawn_structure || {};
  if (ps.iqp_white)
    facts.push({ side: 'black', importance: 55, text: 'White has an isolated d-pawn (IQP)' });
  if (ps.iqp_black)
    facts.push({ side: 'white', importance: 55, text: 'Black has an isolated d-pawn (IQP)' });
  if (ps.hanging_pawns_white)
    facts.push({
      side: 'black',
      importance: 50,
      text: 'White has hanging pawns (no flank support)',
    });
  if (ps.hanging_pawns_black)
    facts.push({
      side: 'white',
      importance: 50,
      text: 'Black has hanging pawns (no flank support)',
    });
  if (ps.light_complex_weak)
    facts.push({
      side: ps.light_complex_weak === 'white' ? 'black' : 'white',
      importance: 65,
      text: `${capitalize(ps.light_complex_weak)}'s light squares are weak`,
    });
  if (ps.dark_complex_weak)
    facts.push({
      side: ps.dark_complex_weak === 'white' ? 'black' : 'white',
      importance: 65,
      text: `${capitalize(ps.dark_complex_weak)}'s dark squares are weak`,
    });
  
  for (const sq of ps.white?.passed || [])
    facts.push({ side: 'white', importance: 70, text: `White has a passed pawn on ${sq}` });
  for (const sq of ps.black?.passed || [])
    facts.push({ side: 'black', importance: 70, text: `Black has a passed pawn on ${sq}` });
  for (const sq of ps.white?.isolated || [])
    facts.push({ side: 'black', importance: 35, text: `White's pawn on ${sq} is isolated` });
  for (const sq of ps.black?.isolated || [])
    facts.push({ side: 'white', importance: 35, text: `Black's pawn on ${sq} is isolated` });
  for (const sq of ps.white?.backward || [])
    facts.push({ side: 'black', importance: 35, text: `White's pawn on ${sq} is backward` });
  for (const sq of ps.black?.backward || [])
    facts.push({ side: 'white', importance: 35, text: `Black's pawn on ${sq} is backward` });

  // 3. Activity
  const act = blob.activity || {};
  for (const o of act.white?.outposts || [])
    facts.push({
      side: 'white',
      importance: 55,
      text: `White's ${o.piece} on ${o.square} is an outpost`,
    });
  for (const o of act.black?.outposts || [])
    facts.push({
      side: 'black',
      importance: 55,
      text: `Black's ${o.piece} on ${o.square} is an outpost`,
    });
  if (act.white?.bad_bishop)
    facts.push({
      side: 'black',
      importance: 40,
      text: `White's bishop on ${act.white.bad_bishop} is hemmed in by its own pawns`,
    });
  if (act.black?.bad_bishop)
    facts.push({
      side: 'white',
      importance: 40,
      text: `Black's bishop on ${act.black.bad_bishop} is hemmed in by its own pawns`,
    });
  for (const d of act.white?.long_diagonals_controlled || [])
    facts.push({ side: 'white', importance: 45, text: `White controls the long ${d} diagonal` });
  for (const d of act.black?.long_diagonals_controlled || [])
    facts.push({ side: 'black', importance: 45, text: `Black controls the long ${d} diagonal` });

  const mw = act.white?.total_mobility || 0;
  const mb = act.black?.total_mobility || 0;
  if (Math.abs(mw - mb) >= 10) {
    const side = mw > mb ? 'White' : 'Black';
    facts.push({
      side: side.toLowerCase(),
      importance: 35,
      text: `${side}'s pieces have ${Math.max(mw, mb) - Math.min(mw, mb)} more squares of mobility`,
    });
  }
  const sw = act.white?.squares_in_enemy_half || 0;
  const sb = act.black?.squares_in_enemy_half || 0;
  if (Math.abs(sw - sb) >= 8) {
    const side = sw > sb ? 'White' : 'Black';
    facts.push({
      side: side.toLowerCase(),
      importance: 35,
      text: `${side} controls more space in the enemy half`,
    });
  }

  // 4. Line control
  const lc = blob.line_control || {};
  for (const f of lc.open_files || []) {
    if (f.controlling_side)
      facts.push({
        side: f.controlling_side,
        importance: 50,
        text: `${capitalize(f.controlling_side)} controls the open ${f.file}-file`,
      });
  }
  if (lc.long_diagonal_a1h8 && !act.white?.long_diagonals_controlled?.includes('a1-h8') && !act.black?.long_diagonals_controlled?.includes('a1-h8')) {
    facts.push({
      side: lc.long_diagonal_a1h8,
      importance: 40,
      text: `${capitalize(lc.long_diagonal_a1h8)} eyes the long a1-h8 diagonal`,
    });
  }
  if (lc.long_diagonal_h1a8 && !act.white?.long_diagonals_controlled?.includes('h1-a8') && !act.black?.long_diagonals_controlled?.includes('h1-a8')) {
    facts.push({
      side: lc.long_diagonal_h1a8,
      importance: 40,
      text: `${capitalize(lc.long_diagonal_h1a8)} eyes the long h1-a8 diagonal`,
    });
  }
  if (lc.seventh_rank_dominant) {
    const rank = lc.seventh_rank_dominant === 'white' ? '7th' : '2nd';
    facts.push({
      side: lc.seventh_rank_dominant,
      importance: 60,
      text: `${capitalize(lc.seventh_rank_dominant)} has rook(s) on the ${rank} rank — pigs on the ${rank}`,
    });
  }

  // 5. King safety
  const ks = blob.king_safety || {};
  for (const f of ks.white?.open_files_to_king || [])
    facts.push({ side: 'black', importance: 60, text: `White's king is exposed on the ${f}-file` });
  for (const f of ks.black?.open_files_to_king || [])
    facts.push({ side: 'white', importance: 60, text: `Black's king is exposed on the ${f}-file` });
  if ((ks.white?.attacker_count || 0) >= 3)
    facts.push({
      side: 'black',
      importance: 70,
      text: `White's king is under attack — ${ks.white.attacker_count} enemy pieces in the king zone`,
    });
  if ((ks.black?.attacker_count || 0) >= 3)
    facts.push({
      side: 'white',
      importance: 70,
      text: `Black's king is under attack — ${ks.black.attacker_count} enemy pieces in the king zone`,
    });

  const eap = ks.engine_attack_potential;
  if (eap && eap.ratio >= 0.5) {
    facts.push({
      side: eap.attacking_side,
      importance: 75,
      text: `${capitalize(eap.attacking_side)} has strong attacking chances — ${eap.moves_targeting_king} of the engine's top ${eap.total_moves} moves target the enemy king`,
    });
  }

  // 6. Tactics
  const tac = blob.tactics || {};
  for (const h of tac.hanging_white || [])
    facts.push({
      side: 'black',
      importance: 90,
      text: `White's ${h.role} on ${h.square} is hanging`,
    });
  for (const h of tac.hanging_black || [])
    facts.push({
      side: 'white',
      importance: 90,
      text: `Black's ${h.role} on ${h.square} is hanging`,
    });
  for (const p of tac.pinned_pieces || [])
    facts.push({
      side: 'both',
      importance: 60,
      text: `${p.role} on ${p.square} is pinned${p.absolute ? ' to the king' : ''}`,
    });

  // 7. Endgame concepts
  const eg = blob.endgame || {};
  if (eg.opposition)
    facts.push({ side: eg.opposition.holder, importance: 88, text: eg.opposition.description });
  for (const k of eg.key_squares || []) {
    if (k.controlled_by === k.pawn_color) {
      facts.push({
        side: k.pawn_color,
        importance: 92,
        text: `${capitalize(k.pawn_color)}'s king occupies a key square for the ${k.pawn_square} pawn — winning K+P ending`,
      });
    } else if (k.controlled_by) {
      facts.push({
        side: k.controlled_by,
        importance: 80,
        text: `${capitalize(k.controlled_by)}'s king holds a key square against the ${k.pawn_square} pawn — denies the win`,
      });
    }
  }
  for (const sp of eg.square_of_pawn || []) {
    if (!sp.defender_in_square)
      facts.push({
        side: sp.pawn_color,
        importance: 95,
        text: `The ${sp.pawn_square} pawn races free — defender's king is outside the square of the pawn`,
      });
  }

  const seen = new Set();
  return facts
    .sort((a, b) => b.importance - a.importance)
    .filter((f) => {
      if (seen.has(f.text)) return false;
      seen.add(f.text);
      return true;
    });
}
