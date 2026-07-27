// Tiny ECO-like opening database. Each entry's FEN is matched by its first
// four space-delimited fields (placement / turn / castling / en-passant), so
// move-counter differences don't break the lookup.
//
// Coverage: the openings most beginners and intermediate players will see.
// For a real ECO database, swap this for a full JSON file at runtime.

const RAW = [
  // Move 1
  ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -', "King's Pawn"],
  ['rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq -', "Queen's Pawn"],
  ['rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -', 'English Opening'],
  ['rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq -', 'Réti Opening'],
  ['rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq -', "Bird's Opening"],

  // 1. e4 …
  ['rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'Open Game'],
  ['rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'Sicilian Defense'],
  ['rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -', 'Sicilian Defense'],
  ['rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -', 'Sicilian Defense'],
  ['rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'French Defense'],
  ['rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq -', 'Caro-Kann Defense'],
  ['rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'Caro-Kann Defense'],
  ['rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'Scandinavian Defense'],
  ['rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -', 'Alekhine Defense'],
  ['rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -', "King's Knight Opening"],
  ['r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -', "King's Knight Opening"],
  ['r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'Italian Game'],
  ['r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -', 'Italian Game: Two Knights'],
  ['r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'Ruy López'],
  ['r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -', 'Ruy López'],
  ['rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -', "King's Gambit"],
  ['rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR w KQkq -', "King's Gambit Accepted"],
  ['rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -', 'Philidor Defense'],
  ['rnbqkbnr/pp1ppppp/8/2p5/8/2N5/PPPPPPPP/R1BQKBNR b KQkq -', "Closed Sicilian"],
  ['rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq -', "Sicilian: Open"],
  ['rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -', 'Sicilian Najdorf'],
  ['rnbqkb1r/pp2pppp/3p1n2/2p5/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -', 'Sicilian: Closed Najdorf line'],

  // 1. d4 …
  ['rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', 'Closed Game'],
  ['rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq -', "Queen's Gambit"],
  ['rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', "Queen's Gambit Declined"],
  ['rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', 'Slav Defense'],
  ['rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq -', "Queen's Gambit Accepted"],
  ['rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', 'Indian Defense'],
  ['rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq -', "King's Indian Defense"],
  ['rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq -', "King's Indian Defense (Classical)"],
  ['rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq -', 'Nimzo-Indian / Queen\'s Indian'],
  ['rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq -', 'Nimzo-Indian Defense'],
  ['rnbqkb1r/pppppp1p/5np1/8/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq -', 'Indian Defense (Fianchetto)'],

  // 1. c4 …
  ['rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -', 'English: Reversed Sicilian'],
  ['rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq -', 'English: Symmetrical'],

  // Dutch
  ['rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq -', 'Dutch Defense'],
];

const OPENINGS = RAW.map(([fen, name]) => {
  const key = fen.split(' ').slice(0, 4).join(' ');
  return { key, name };
});

// Match the position by board / turn / castling / en-passant.
export function findOpening(fen) {
  if (!fen) return null;
  const key = fen.split(' ').slice(0, 4).join(' ');
  const hit = OPENINGS.find(o => o.key === key);
  return hit ? hit.name : null;
}

// Walk a history backwards and return the most recent opening match.
// Useful so the panel keeps showing "Italian Game" once you're out of book.
export function findOpeningFromHistory(historyFens) {
  for (let i = historyFens.length - 1; i >= 0; i--) {
    const o = findOpening(historyFens[i]);
    if (o) return o;
  }
  return null;
}
