export type SparringGameStatus = 'setup' | 'playing' | 'analysis'

export interface SparringGameParams {
  gameId: string
  userColor: 'white' | 'black'
  startPosition: string
  userId: string
}

export interface OpeningPreset {
  id: string
  name: string
  fen: string
  eco?: string
  description?: string
}
