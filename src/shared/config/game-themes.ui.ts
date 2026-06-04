export interface ChessCategoryUi {
  icon?: string
  svg?: string
}

export const CHESS_CATEGORY_UI: Record<string, ChessCategoryUi> = {
  // Common Endgames
  pawn: { icon: '♔♙' },
  bishop: { icon: '♗♙' },
  knight: { icon: '♘♙' },
  queen: { icon: '♕♙' },
  rookPawn: { icon: '♖♙' },
  knightBishop: { icon: '♘↔♗' },
  rookPieces: { icon: '♖♘♗' },
  queenPieces: { icon: '♕♘♗' },

  // Finish Him Specific / Fallbacks
  auto: { icon: '✨' },
  expert: { svg: '/svg/crown-svgrepo-com.svg' },

  // === 1. Basic Tier ===
  pawnEnding: { icon: '♔♙' },
  rookEnding: { icon: '♖♖' },
  bishopVsPawns: { icon: '♗♙' },
  knightVsPawns: { icon: '♘♙' },
  rookVsPawns: { icon: '♖♙' },
  extraPawn: { icon: '+♙' },
  extrapawn: { icon: '+♙' },

  // === 2. Premium Tier ===
  sameColorBishops: { icon: '♗♗' },
  oppositeColorBishops: { icon: '♗↔♗' },
  knightEnding: { icon: '♘♘' },
  bishopVsKnight: { icon: '♗♘' },
  doubleRookEnding: { icon: '♖♖♖' },
  rookVsMinor: { icon: '♖↔♘' },
  queenEnding: { icon: '♕♕' },

  // === 3. Premium Plus Tier ===
  queenVsRook: { icon: '♕↔♖' },
  rookVsTwoMinors: { icon: '♖↔♗♘' },
  queenVsMinors: { icon: '♕↔♗♘' },
  queenVsRookMinor: { icon: '♕↔♖♘' },
  queenMinorVsQueenMinor: { icon: '♕♗♘' },
  rookMinorVsRook: { icon: '♘♖↔♖' },
  rookMinorVsRookMinor: { icon: '♘♖↔♖♘' },
}
