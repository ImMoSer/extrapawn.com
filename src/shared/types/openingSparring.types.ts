export interface TheoryMove {
  uci: string
  san: string
  total: number
  w_pct: number // Win percentage (0-100)
  d_pct: number // Draw percentage (0-100)
  l_pct: number // Loss percentage (0-100)
}

export interface SessionMove {
  fen: string
  moveUci: string
  san: string
  phase: 'theory' | 'playout'

  // PGN Context
  ply?: number
  turn?: 'w' | 'b'
  moveNumber?: number

  stats?: TheoryMove

  // Session metrics
  winRate?: number
  popularity?: number
  accuracy?: number // Used by playout engine analysis

  // Client-side move assessment
  quality?:
    | 'blunder'
    | 'mistake'
    | 'inaccuracy'
    | 'good'
    | 'great'
    | 'best'
    | 'brilliant'
    | 'interesting'
  nag?: string
  tags?: string[]

  // Playout evaluation (Simplified for new nags_eval_service)
  evaluation?: {
    score_cp: number
    win_prob: number
    best_move: string
    depth: number
    delta_wp?: number
    delta_cp?: number
  }
  chaos_index?: number
  is_sacrifice?: boolean
}
