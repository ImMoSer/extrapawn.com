export const QUALITY_COLOR: Record<string, string> = {
  brilliant: '#22d3ee',
  great: '#34d399',
  best: '#4ade80',
  excellent: '#86efac',
  good: '#a7f3d0',
  neutral: '#a1a1aa',
  inaccuracy: '#fbbf24',
  mistake: '#fb923c',
  blunder: '#ef4444',
  missed_mate: '#dc2626',
}

export const QUALITY_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  neutral: 'Neutral',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  missed_mate: 'Missed mate',
}

export interface CoachTheme {
  id: string
  side: 'white' | 'black'
  strength: number
  description: string
}

export interface OpeningInfo {
  name: string
  eco: string
  theoretical_fen?: string | null
  theoretical_string?: string | null
  wikibooks_url?: string | null
  node_id?: number | null
  canonical_uci_path?: string[]
  canonical_san_path?: string[]
}

export interface StructuredMove {
  rank: number
  san: string
  uci: string
  name?: string | null
  eco?: string | null
  theoretical_fen?: string | null
  theoretical_string?: string | null
  win_p?: number | null
  draw_p?: number | null
  loss_p?: number | null
  total?: number | null
  cp?: number | null
  mate?: number | null
  pv?: string[]
  wdl?: { win: number; draw: number; loss: number } | null
}

export interface CoachEngineAnalyzeResponse {
  mode: 'theory' | 'engine'
  opening_info?: OpeningInfo | null
  structured_moves: StructuredMove[]
  lines?: string[]
  coach_move?: [string, string] | string[]
  stokfisch_lines?: string[]
  gaviota_lines?: string[]
}

export interface CoachTopMove {
  rank: number
  uci: string
  move?: string
  quality?: string
  san: string
  name?: string | null
  eco?: string | null
  ecoName?: string | null
  theoretical_fen?: string | null
  theoretical_string?: string | null
  win_p?: number | null
  draw_p?: number | null
  loss_p?: number | null
  winP?: number | null
  drawP?: number | null
  lossP?: number | null
  popularity?: number | null
  totalGames?: number | null
  total?: number | null
  tts?: string
  score?: number
  eval_cp?: number
  eval_pawns: number
  mate: number | null
  isMate: boolean
  mateIn: number | null
  motifs: string[]
  targetsKing: boolean
  headline: string | null
  tagline: string | null
  plan_theme: string | null
  plan_brief: string | null
  plan_pv?: string[]
  rawPv?: string[]
  pv?: string[]
  theoreticalContinuations?: Array<Record<string, unknown>>

  pvLine?: { san: string; tts?: string; tagline?: string }[]
  character: string
  character_reason: string
  explanation?: {
    quality: string
    summary: string
    details: string
    best_move_san: string
    is_best_move: boolean
    winRateLoss?: number
  }
  wdl?: { win: number; draw: number; loss: number }
}


export interface CoachVisualCommands {
  best_move?: string | string[]
  maneuver?: string | string[]
  pawn_race?: string | string[]
  key_squares?: string | string[]
  diagonals?: string | string[]
  structure_white?: string | string[]
  structure_black?: string | string[]
  _logs?: VisualizerLogItem[]
  _input_sources?: VisualizerInputSources
  [key: string]: unknown
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
    moves: {
      san: string
      uci: string
      tts?: string
      role?: string
      motifs?: string[]
      headline?: string
      to?: string
      from?: string
    }[]
    key_squares: string[]
    theme: string | null
    description: string
    tts_string?: string
    zwischenzug?: Record<string, unknown>
  }
  engine_top_moves: CoachTopMove[]
  visual_commands: CoachVisualCommands
  tactics?: Record<string, unknown>
  endgame?: Record<string, unknown>
  summary_text: string
  concrete_facts?: { text: string; side?: string; importance?: number }[]
}

export interface CoachOpeningMoveInfo {
  name?: string | null
  eco?: string | null
  win_p?: number | null
  draw_p?: number | null
  loss_p?: number | null
  total?: number | null
  popularity_p?: number | null
}

export interface CoachLastMoveAnalysis {
  loading?: boolean
  san: string
  tts?: string
  fen?: string // The FEN BEFORE the move was played
  quality?: string
  summary?: string
  details?: string
  motifs?: string[]
  bestMove?: string
  bestMoveSan?: string
  best_move_tts?: string
  eval_cp?: number
  winRateLoss?: number
  is_best_move?: boolean
  isBestMove?: boolean
  wdl?: { win: number; draw: number; loss: number }
  opening?: CoachOpeningMoveInfo | null
  [key: string]: unknown
}

export interface CoachBookInfo {
  name: string
  eco: string
  canonicalPathSan: string
  isOutOfBook: boolean
  wikibooksUrl?: string
  wikibooksContent?: string | null
  forwardMoves?: { san: string; name: string | null }[]
}

export interface CoachHistoryItem {
  role: 'user' | 'coach' | 'referee'
  type: string
  text?: string
  notation?: string
  move?: string
}

export interface VisualizerLogItem {
  category?: string
  title?: string
  reason?: string
  command?: string
  squares?: string[]
}

export interface VisualizerInputPlanStep {
  san?: string
  uci?: string
  from?: string
  to?: string
  quality?: string | null
  motifs?: string[]
  headline?: string | null
}

export interface VisualizerInputPawnStruct {
  summary?: string | null
  darkComplexWeak?: string | null
  whiteIsolated?: string[]
  blackIsolated?: string[]
  whiteBackward?: string[]
  blackBackward?: string[]
  whiteHoles?: string[]
  blackHoles?: string[]
}

export interface VisualizerInputTheme {
  id: string
  side?: string
  strength?: number
  description?: string
}

export interface VisualizerInputEngineMove {
  san?: string
  uci?: string
  score?: number | null
  mate?: number | null
  character?: string | null
  headline?: string | null
  planBrief?: string | null
  motifs?: string[]
}

export interface VisualizerInputPosSummary {
  evalPawns?: number | null
  evalMate?: number | null
  phase?: string | null
  verdict?: string | null
  materialSummary?: string | null
}

export interface VisualizerInputSources {
  fen?: string
  attackingSide?: 'w' | 'b' | string
  positionSummary?: VisualizerInputPosSummary | null
  lastMoveAnalysis?: {
    san?: string | null
    quality?: string | null
    summary?: string | null
    details?: string | null
    consequence?: string | null
  } | null
  tactics?: unknown[]
  planSteps?: VisualizerInputPlanStep[]
  principalPlan?: {
    theme?: string | null
    description?: string | null
    evalCp?: number | null
    depth?: number | null
  } | null
  pawnStructure?: VisualizerInputPawnStruct | null
  themes?: VisualizerInputTheme[]
  passedPawns?: string[]
  weakPawns?: string[]
  engineTopMoves?: VisualizerInputEngineMove[]
  [key: string]: unknown
}


