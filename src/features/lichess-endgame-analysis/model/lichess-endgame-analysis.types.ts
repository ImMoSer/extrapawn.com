export interface EndgameCategoryStats {
  total: number;
  win_perfect?: number;
  win_lucky?: number;
  win_dropped_draw?: number;
  win_dropped_loss?: number;
  draw_clean?: number;
  draw_exploited_win?: number;
  draw_missed_win?: number;
  draw_saved_loss?: number;
  draw_dropped_loss?: number;
  loss_hopeless?: number;
  loss_saved?: number;
  loss_missed_save?: number;
  [key: string]: number | undefined; // Index Signatur für dynamischen Zugriff
}

export interface EndgameStats {
  [endgameType: string]: EndgameCategoryStats;
}

export interface EndgamePuzzle {
  puzzle_id: string;
  game_id: string;
  puzzle_type: 'my_dropps' | 'opp_blunders';
  category: string;
  strategy: 'playOutOnly';
  first_move: 'user' | 'bot';
  user_target: 'win' | 'draw';
  ply: number;
  correct_move_san: string;
  correct_move_uci: string;
  // Für my_dropps
  dropped_fen?: string;
  dropped_move_san?: string;
  dropped_move_uci?: string;
  // Für opp_blunders
  opp_blunder_fen?: string;
  opp_blunder_move_san?: string;
  opp_blunder_move_uci?: string;
  // Debug / Zusatzinfo
  chance_fen?: string;
  user_played_move_san?: string;
  user_played_move_uci?: string;
  white_player?: string;
  black_player?: string;
  speed?: string;
}

export interface EndgameAnalysisResponse {
  total_games: number;
  games_with_endings: number;
  total_endings: number;
  stats: EndgameStats;
  puzzles: EndgamePuzzle[];
}

