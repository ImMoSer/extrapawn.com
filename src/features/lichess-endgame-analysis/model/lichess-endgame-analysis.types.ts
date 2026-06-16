export interface EndgameDetail {
  fen: string;
  playedMove: string;
  pieceType: string;
  classification: string;
  gaviota_result: "win" | "loss" | "draw";
  gaviota_dtm: number;
}

export interface CheckedGame {
  game_id: string;
  userResult: "win" | "loss" | "draw";
  userColor: "white" | "black";
  founded_endings: EndgameDetail[];
}

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

export type TaskType = 
  | "dropped_win_to_draw"
  | "dropped_win_to_loss"
  | "dropped_draw_to_loss"
  | "missed_winning_chance"
  | "missed_saving_chance";

export interface MissedChance {
  task_type: TaskType;
  classification: string;
  chance_fen: string;
  user_played_move: string;
  correct_move: string;
  target_eval: "win" | "draw" | "loss";
  game_id: string;
  opp_blunder_fen?: string;
  opp_blunder_move?: string;
}

export interface EndgameAnalysisResponse {
  total_games?: number;
  stats: EndgameStats;
  checked_games: CheckedGame[];
  missed_chances: MissedChance[];
}
