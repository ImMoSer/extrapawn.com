export interface CoachTheme {
  id: string
  side: 'white' | 'black'
  strength: number
  description: string
}

export interface CoachTopMove {
  rank: number
  uci: string
  san: string
  score: number
  mate: number | null
  eval_pawns: number
  isMate: boolean
  mateIn: number | null
  motifs: string[]
  targetsKing: boolean
  headline: string | null
  tagline: string | null
  plan_theme: string | null
  plan_brief: string | null
  plan_pv: string[]
  character: string
  character_reason: string
  explanation: {
    quality: string
    summary: string
    details: string
    best_move_san: string
    is_best_move: boolean
    winRateLoss?: number
  }
  pvLine?: { san: string; tagline?: string }[]
}

export interface CoachVisualCommands {
  best_move?: string
  maneuver?: string
  pawn_race?: string
  key_squares?: string
  diagonals?: string
  structure_white?: string
  structure_black?: string
  [key: string]: string | undefined
}

export interface CoachExplanation {
  fen: string
  side_to_move: 'white' | 'black'
  eval_cp: number
  eval_pawns: number
  verdict?: string
  static_eval_cp?: number
  eval_mate?: number | null
  phase: 'opening' | 'middlegame' | 'endgame'
  move_number: number
  king_safety: {
    white: Record<string, unknown>
    black: Record<string, unknown>
    engine_attack_potential?: Record<string, unknown>
  }
  material: {
    material_delta_cp: number
    bishop_pair_white: boolean
    bishop_pair_black: boolean
    opposite_color_bishops: boolean
  }
  activity: {
    white: Record<string, unknown>
    black: Record<string, unknown>
  }
  pawn_structure: {
    white: Record<string, unknown>
    black: Record<string, unknown>
    iqp_white?: boolean
    iqp_black?: boolean
    hanging_pawns_white?: boolean
    hanging_pawns_black?: boolean
    light_complex_weak?: string
    dark_complex_weak?: string
  }
  themes: CoachTheme[]
  principal_plan: {
    eval_cp: number
    eval_mate: number | null
    depth: number
    moves: { san: string; uci: string }[]
    key_squares: string[]
    theme: string | null
    description: string
    zwischenzug?: Record<string, unknown>
  }
  engine_top_moves: CoachTopMove[]
  visual_commands: CoachVisualCommands
  llm_payload: Record<string, unknown>
  summary_text: string
  concrete_facts?: { text: string; side?: string; importance?: number }[]
}

export interface CoachLastMoveAnalysis {
  loading?: boolean
  san: string
  quality?: string
  summary?: string
  details?: string
  motifs?: string[]
  bestMove?: string
  bestMoveSan?: string
  eval_cp?: number
  winRateLoss?: number
  is_best_move?: boolean
  isBestMove?: boolean
  [key: string]: unknown
}
