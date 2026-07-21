import { userGamesRepository, type LichessGameEntity } from '@/entities/game'
import logger from '@/shared/lib/logger'

export interface LichessGameResponse {
  id?: string
  variant?: string
  speed?: string
  perf?: string
  createdAt?: number
  lastMoveAt?: number
  status?: string
  winner?: 'white' | 'black'
  players?: {
    white?: { user?: { id?: string; name?: string }; rating?: number; ratingDiff?: number }
    black?: { user?: { id?: string; name?: string }; rating?: number; ratingDiff?: number }
  }
  opening?: { eco?: string; name?: string; ply: number }
  moves?: string
  pgn?: string
  clock?: { initial?: number; increment?: number; totalTime?: number }
}

export class LichessGamesStreamSyncService {
  /**
   * Fetch games stream from Lichess API and batch save them to IndexedDB via repository.
   * Returns total number of games processed.
   */
  async syncGamesStream(
    username: string,
    perfTypes: string[],
    sinceTimestamp?: number,
    onProgress?: (count: number) => void
  ): Promise<number> {
    const cleanUsername = username.trim().toLowerCase()
    const maxGames = 10000
    const perfTypeParam = perfTypes.join(',')
    
    let url = `https://lichess.org/api/games/user/${username}?tags=false&clocks=false&evals=false&opening=true&literate=false&max=${maxGames}&perfType=${perfTypeParam}&pgnInJson=true`
    if (sinceTimestamp) {
      url += `&since=${sinceTimestamp}`
    }

    const response = await fetch(url, {
      headers: { Accept: 'application/x-ndjson' }
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Lichess Rate-Limit erreicht. Bitte versuche es in einigen Minuten erneut.')
      }
      throw new Error(`Lichess API Fehler (${response.status}): ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Lichess Antwort enthielt keinen Lesestream.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let count = 0

    const pendingBatch: LichessGameEntity[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        let game: LichessGameResponse
        try {
          game = JSON.parse(line) as LichessGameResponse
        } catch {
          continue
        }

        // Fail-Fast Validierung & Filterung
        if (game.variant !== 'standard') {
          continue
        }

        // Unknown Opening aussortieren
        if (!game.opening || !game.opening.name || game.opening.name === 'Unknown Opening') {
          continue
        }

        if (game.opening.ply === undefined) {
          throw new Error(`Game ${game.id || 'unknown'} is missing required 'ply' parameter in opening.`)
        }

        if (!game.players?.white?.user?.id || !game.players?.black?.user?.id) {
          continue
        }

        const whiteId = game.players.white.user.id.toLowerCase()
        const blackId = game.players.black.user.id.toLowerCase()

        const isWhite = whiteId === cleanUsername
        const isBlack = blackId === cleanUsername

        if (!isWhite && !isBlack) {
          continue
        }

        const userColor = isWhite ? 'white' : 'black'
        let userResult: 'win' | 'loss' | 'draw' = 'draw'
        if (game.winner) {
          const winnerIsUser = (game.winner === 'white' && isWhite) || (game.winner === 'black' && isBlack)
          userResult = winnerIsUser ? 'win' : 'loss'
        }

        const movesList = game.moves ? game.moves.trim().split(/\s+/).filter(Boolean) : []
        if (movesList.length === 0) {
          continue
        }

        const movesCount = movesList.length
        const firstMove = movesList[0] || ''
        const rootMove = firstMove ? `1. ${firstMove}` : ''
        const openingNameBase = ((game.opening?.name || '').split(':')[0] || '').trim()

        const whitePlayerName = game.players.white.user.name || game.players.white.user.id
        const blackPlayerName = game.players.black.user.name || game.players.black.user.id
        const resultVal = game.winner ? (game.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2'

        // Clean PGN from Lichess (just append result)
        const cleanPgn = game.pgn ? `${game.pgn.trim()} ${resultVal}` : ''

        const gameEntity: LichessGameEntity = {
          id: game.id || '',
          username: cleanUsername,
          userColor,
          userResult,
          white: whitePlayerName,
          black: blackPlayerName,
          white_elo: game.players.white.rating || 1500,
          black_elo: game.players.black.rating || 1500,
          result: resultVal,
          status: game.status || '',
          timeControl: (game.speed || 'other').toLowerCase(),
          createdAt: game.createdAt || Date.now(),
          lastMoveAt: game.lastMoveAt || Date.now(),
          rootMove,
          movesCount,
          openingNameBase,
          eco: game.opening.eco || '',
          opening: game.opening.name || '',
          ply: game.opening.ply,
          pgn: cleanPgn
        }

        pendingBatch.push(gameEntity)
        count++
        if (onProgress) onProgress(count)

        if (pendingBatch.length >= 50) {
          await userGamesRepository.saveGamesBatch(pendingBatch)
          pendingBatch.length = 0
        }
      }
    }

    // Verarbeite verbleibenden Puffer
    if (buffer.trim()) {
      try {
        const game = JSON.parse(buffer) as LichessGameResponse
        if (
          game.variant === 'standard' &&
          game.opening &&
          game.opening.name &&
          game.opening.name !== 'Unknown Opening' &&
          game.players?.white?.user?.id &&
          game.players?.black?.user?.id
        ) {
          if (game.opening.ply === undefined) {
            throw new Error(`Game ${game.id || 'unknown'} is missing required 'ply' parameter in opening.`)
          }
          const whiteId = game.players.white.user.id.toLowerCase()
          const blackId = game.players.black.user.id.toLowerCase()
          const isWhite = whiteId === cleanUsername
          const isBlack = blackId === cleanUsername

          if (isWhite || isBlack) {
            const userColor = isWhite ? 'white' : 'black'
            let userResult: 'win' | 'loss' | 'draw' = 'draw'
            if (game.winner) {
              const winnerIsUser = (game.winner === 'white' && isWhite) || (game.winner === 'black' && isBlack)
              userResult = winnerIsUser ? 'win' : 'loss'
            }

            const movesList = game.moves ? game.moves.trim().split(/\s+/).filter(Boolean) : []
            if (movesList.length > 0) {
              const movesCount = movesList.length
              const firstMove = movesList[0] || ''
              const rootMove = firstMove ? `1. ${firstMove}` : ''
              const openingNameBase = ((game.opening?.name || '').split(':')[0] || '').trim()

              const whitePlayerName = game.players.white.user.name || game.players.white.user.id
              const blackPlayerName = game.players.black.user.name || game.players.black.user.id
              const resultVal = game.winner ? (game.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2'

              // Clean PGN from Lichess (just append result)
              const cleanPgn = game.pgn ? `${game.pgn.trim()} ${resultVal}` : ''

              const gameEntity: LichessGameEntity = {
                id: game.id || '',
                username: cleanUsername,
                userColor,
                userResult,
                white: whitePlayerName,
                black: blackPlayerName,
                white_elo: game.players.white.rating || 1500,
                black_elo: game.players.black.rating || 1500,
                result: resultVal,
                status: game.status || '',
                timeControl: (game.speed || 'other').toLowerCase(),
                createdAt: game.createdAt || Date.now(),
                lastMoveAt: game.lastMoveAt || Date.now(),
                rootMove,
                movesCount,
                openingNameBase,
                eco: game.opening.eco || '',
                opening: game.opening.name || '',
                ply: game.opening.ply,
                pgn: cleanPgn
              }
              pendingBatch.push(gameEntity)
              count++
              if (onProgress) onProgress(count)
            }
          }
        }
      } catch {
        logger.warn('Fehler beim Parsen des trailing buffers')
      }
    }

    if (pendingBatch.length > 0) {
      await userGamesRepository.saveGamesBatch(pendingBatch)
      pendingBatch.length = 0
    }

    return count
  }
}

export const lichessGamesStreamSyncService = new LichessGamesStreamSyncService()
