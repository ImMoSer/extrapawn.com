export interface OpenCheckTheoretical {
  label: string
}

export interface OpenCheckRecommendation {
  move_san: string
  llm_says: string
}

export interface OpenCheckTreeNode {
  fen?: string
  move_uci?: string
  move_san?: string
  games_count?: number
  popularity_pct?: number
  user_score_pct?: number
  theoretical?: OpenCheckTheoretical
  theory_data?: OpenCheckTheoretical
  user_moves?: OpenCheckTreeNode[]
  opponent_moves?: Record<string, OpenCheckTreeNode>
  eco?: string
  variability?: number
  opening_name?: string
  recommendations?: Record<string, OpenCheckRecommendation>
}
