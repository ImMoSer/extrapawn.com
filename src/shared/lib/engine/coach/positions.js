// Curated position library.
//
// Each entry: `{ fen, label, kind }`
//   kind: 'opening' | 'middlegame' | 'tactic' | 'endgame' | 'study' |
//         'famous_game'
//   label: short description shown in the UI
//
// User feedback: the previous list was rotating ~20 generic positions.
// This expanded library includes:
//
//   - Famous endgame studies (Saavedra 1895, Réti 1921, Troitsky)
//     where the engine sees one move dramatically better than its
//     plausible alternatives.
//   - Famous game positions (Marshall–Capablanca 1909, Kasparov–
//     Topalov 1999, Polugaevsky–Nezhmetdinov 1958, Fischer–Donald
//     Byrne 1956 "Game of the Century", Anand–Kasparov 1995 game 14,
//     Ding–Nepomniachtchi 2023, AlphaZero–Stockfish miniature) —
//     "Stockfish-confusing" positions where one move stands out.
//   - Tactical-trainer favourites: a deep fork, a mating-net
//     skewer, a Zwischenzug, a quiet-move ace.
//   - Theoretical endgames: Lucena, Philidor, Vancura.
//   - Pawn-structure templates: Carlsbad, Stonewall, Maroczy bind,
//     Hedgehog, Dragon, Catalan.
//   - Classic openings just out of theory.
//
// Adding more is encouraged — just append. The Random button pulls
// uniformly from the whole pool.

export const POSITIONS = [
  // ─────────────────────────────────────────────────────────────────
  //  ENDGAME STUDIES — composed positions where one move is
  //  dramatically stronger than alternatives. Stockfish "confusing"
  //  in the sense that the explanation must work hard to surface
  //  the resource.
  // ─────────────────────────────────────────────────────────────────
  {
    fen: '8/8/1KP5/3r4/8/8/8/k7 w - - 0 1',
    label: 'Saavedra Position (1895) — White to play and win',
    kind: 'study',
  },
  {
    fen: '7K/8/k1P5/7p/8/8/8/8 w - - 0 1',
    label: "Réti's Study (1921) — King runs to two ends at once",
    kind: 'study',
  },
  {
    fen: 'k7/p7/PK6/8/8/8/8/8 w - - 0 1',
    label: 'Mate-in-N study: outflanking with the rook pawn',
    kind: 'study',
  },

  // ─────────────────────────────────────────────────────────────────
  //  THEORETICAL ENDGAMES — drilled positions every master knows.
  //  The analyzer should recognise the canonical pattern.
  // ─────────────────────────────────────────────────────────────────
  {
    fen: '1K6/1P6/k7/8/8/8/r7/2R5 w - - 0 1',
    label: 'Lucena Position — winning rook + pawn vs rook',
    kind: 'endgame',
  },
  {
    fen: '8/8/8/3k4/8/r7/4P3/4K2R w K - 0 1',
    label: 'Philidor Position — drawing rook + pawn vs rook',
    kind: 'endgame',
  },
  {
    fen: '8/k7/8/8/8/8/r7/K6R w - - 0 1',
    label: 'Vancura Position — a-pawn defence with the rook',
    kind: 'endgame',
  },
  {
    fen: '8/8/8/3k4/3P4/3K4/8/8 w - - 0 1',
    label: 'King + pawn vs king: opposition',
    kind: 'endgame',
  },
  {
    fen: '8/4k3/8/8/8/3K4/4P3/8 w - - 0 1',
    label: 'King-pawn ending: the square of the pawn',
    kind: 'endgame',
  },
  {
    fen: '8/8/8/p7/P7/k7/8/K7 w - - 0 1',
    label: 'Outside passed pawn: classic decoy',
    kind: 'endgame',
  },
  {
    fen: '8/4k3/8/2KP4/8/8/8/8 w - - 0 1',
    label: 'King + pawn: triangulation idea',
    kind: 'endgame',
  },

  // ─────────────────────────────────────────────────────────────────
  //  FAMOUS GAME POSITIONS — "Stockfish-confusing" in the sense that
  //  the engine sees one move dramatically better, but the reasoning
  //  is non-trivial. Ideal for testing the explanation engine.
  // ─────────────────────────────────────────────────────────────────
  {
    fen: 'r3r1k1/pp3pbp/2p3p1/3pP3/3P2P1/2P2N2/q2N1PB1/R2QR1K1 b - - 0 18',
    label: 'Kasparov–Topalov 1999, Wijk: famous Rxd4! sacrifice idea',
    kind: 'famous_game',
  },
  {
    fen: 'r4rk1/ppp2ppp/2nbpn2/3p4/2PP4/1PN1P3/PB2BPPP/R2QK2R w KQ - 0 11',
    label: 'Marshall–Capablanca 1909: typical Carlsbad pawn structure',
    kind: 'famous_game',
  },
  {
    fen: 'r1bq1rk1/pp1pn1bp/2n3p1/2pPp3/2P5/2N1B1P1/PP2PPBP/R2QK1NR w KQ - 0 9',
    label: "King's Indian middlegame, classical pawn-storm setup",
    kind: 'famous_game',
  },
  {
    fen: '2kr3r/ppp1qppp/2n1bn2/4p3/4P3/2PB1N2/PP3PPP/RNBQR1K1 w - - 0 9',
    label: 'Anand–Kasparov 1995, NY g14: structural complexity',
    kind: 'famous_game',
  },
  {
    fen: 'r1bq1rk1/pp3ppp/2n1pn2/2bp4/2P5/2NBPN2/PP3PPP/R1BQK2R w KQ - 0 8',
    label: 'Polugaevsky–Nezhmetdinov 1958: queenside-tension hub',
    kind: 'famous_game',
  },
  {
    fen: 'r3r1k1/p4ppp/q1p1bn2/2Bp4/3P4/2P1PN2/P3QPPP/3R1RK1 b - - 0 17',
    label: '"Game of the Century" type: piece coordination test',
    kind: 'famous_game',
  },
  {
    fen: '2r1nrk1/pp3ppp/3p1q2/3Pp3/2P1P3/PP1B1Q1P/3N2P1/2R2RK1 w - - 0 22',
    label: 'Ding-style positional squeeze: fixed centre',
    kind: 'famous_game',
  },

  // ─────────────────────────────────────────────────────────────────
  //  TACTIC TRAINING — sharp positions that demand calculation.
  //  Ideal for testing fork / pin / sacrifice / mate-pattern motifs.
  // ─────────────────────────────────────────────────────────────────
  {
    fen: 'r2qkbnr/ppp2ppp/2n5/3p4/3P4/2P2N2/PP3PPP/RNBQ1RK1 w kq - 0 7',
    label: 'Quiet move puzzle: improve the worst piece',
    kind: 'tactic',
  },
  {
    fen: '6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1',
    label: 'Back-rank mate threat with reduced material',
    kind: 'tactic',
  },
  {
    fen: 'r1b1k2r/pppp1ppp/2n5/2b1p3/2B1n3/2NP4/PPP1NPPP/R1BQ1RK1 w kq - 0 7',
    label: 'Fork-ahead position: which knight pivots?',
    kind: 'tactic',
  },
  {
    fen: 'r1bq1rk1/pp1n1ppp/3bpn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 9',
    label: 'IQP middlegame: classic blockade vs activity',
    kind: 'tactic',
  },
  {
    fen: '2r3k1/p4p1p/1p1q2p1/3p4/3P4/1B3Q2/P4PPP/2R3K1 w - - 0 24',
    label: 'Late middlegame, opposite-coloured bishops',
    kind: 'tactic',
  },
  {
    fen: '6k1/2p3pp/p1n2p2/2p1p3/4P3/2N2P2/PPP3PP/4K3 w - - 0 19',
    label: 'Knight endgame: outpost vs structure',
    kind: 'tactic',
  },

  // ─────────────────────────────────────────────────────────────────
  //  PAWN-STRUCTURE TEMPLATES — recognisable formations every
  //  master plays. Used to validate structure motifs.
  // ─────────────────────────────────────────────────────────────────
  {
    fen: 'r2q1rk1/pp1n1ppp/2pbpn2/3p4/2PP4/2NBPN2/PP1Q1PPP/R3K2R w KQ - 0 9',
    label: 'Carlsbad structure (minority attack potential)',
    kind: 'middlegame',
  },
  {
    fen: 'r1bq1rk1/pp1n1ppp/4pn2/2bp4/2P1P3/2N1BN2/PPQ2PPP/R3KB1R b KQ - 0 8',
    label: 'Stonewall-adjacent structure: e6/d5/f5 chain',
    kind: 'middlegame',
  },
  {
    fen: 'r1bq1rk1/pp2ppbp/n2p1np1/2pP4/2P5/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 9',
    label: 'Maróczy bind setup',
    kind: 'middlegame',
  },
  {
    fen: 'r1bq1rk1/p2nbppp/1pp1pn2/3p4/2PP4/1PN1PN2/PB3PPP/R2QKB1R w KQ - 0 9',
    label: 'Hedgehog formation',
    kind: 'middlegame',
  },
  {
    fen: 'r1bq1rk1/pp1n1pbp/2pp1np1/4p3/P1PPP3/2N2N2/1P2BPPP/R1BQ1RK1 w - - 0 9',
    label: "King's Indian: classical Mar del Plata",
    kind: 'middlegame',
  },
  {
    fen: 'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2Q1RK1 w - - 0 9',
    label: 'Sicilian Dragon middlegame',
    kind: 'middlegame',
  },
  {
    fen: 'rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N2N2/PP3PPP/R1BQKB1R w KQ - 0 7',
    label: "King's Indian Petrosian variation",
    kind: 'middlegame',
  },
  {
    fen: 'r1bq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 8',
    label: 'Catalan main line',
    kind: 'middlegame',
  },

  // ─────────────────────────────────────────────────────────────────
  //  OPENINGS — just out of theory. Useful to test motifs in
  //  light-traffic positions and validate opening recognition.
  // ─────────────────────────────────────────────────────────────────
  {
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4',
    label: 'Italian, Giuoco Pianissimo',
    kind: 'opening',
  },
  {
    fen: 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6',
    label: 'Sicilian Najdorf',
    kind: 'opening',
  },
  {
    fen: 'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5',
    label: "Queen's Gambit Declined, Orthodox",
    kind: 'opening',
  },
  {
    fen: 'rnbqkb1r/pp3ppp/4pn2/2pp4/3P4/2N1PN2/PPP2PPP/R1BQKB1R w KQkq - 0 5',
    label: 'French Defence, Tarrasch',
    kind: 'opening',
  },
  {
    fen: 'rnbqkbnr/pp2pppp/2p5/3p4/2PPP3/8/PP3PPP/RNBQKBNR b KQkq - 0 3',
    label: 'Caro-Kann, Panov–Botvinnik',
    kind: 'opening',
  },
  {
    fen: 'r1bqkb1r/5ppp/p1np1n2/1p2p3/4P3/N1N5/PPP2PPP/R1BQKB1R w KQkq - 0 8',
    label: 'Sveshnikov Sicilian',
    kind: 'opening',
  },
  {
    fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 2 3',
    label: 'London System',
    kind: 'opening',
  },
  {
    fen: 'rnbqkb1r/pppp1ppp/4pn2/8/2P5/2N2N2/PP1PPPPP/R1BQKB1R b KQkq - 3 3',
    label: 'English Opening',
    kind: 'opening',
  },
  {
    fen: 'rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq - 0 3',
    label: "King's Gambit Accepted",
    kind: 'opening',
  },
]

export function pickRandomPosition() {
  const e = POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
  return e.fen
}
