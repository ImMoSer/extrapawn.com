/**
 * Remote Coach Engine API connector (Docker microservice).
 * Endpoint: POST http://127.0.0.1:5004/analyze
 */

const DEFAULT_REMOTE_URL = 'http://127.0.0.1:5004/analyze'

export function getRemoteEngineUrl() {
  try {
    return localStorage.getItem('positional_chess.remote_url') || DEFAULT_REMOTE_URL
  } catch {
    return DEFAULT_REMOTE_URL
  }
}

export function setRemoteEngineUrl(url) {
  try {
    localStorage.setItem('positional_chess.remote_url', url || DEFAULT_REMOTE_URL)
  } catch {
    /* ignore */
  }
}

export function getEngineSource() {
  try {
    return localStorage.getItem('positional_chess.engine_source') || 'remote'
  } catch {
    return 'remote'
  }
}

export function setEngineSource(source) {
  try {
    localStorage.setItem('positional_chess.engine_source', source)
  } catch {
    /* ignore */
  }
}

/**
 * Sends position analysis request to the Docker Server Engine.
 */
export async function analyzeRemotePosition(fen, opts = {}) {
  const url = getRemoteEngineUrl()
  const payload = {
    fen,
    start_fen: opts.startFen || fen,
    moves: opts.movesHistoryUci || [],
    depth: opts.depth || 14,
    multipv: opts.multipv || 5,
    check_book: opts.checkBook ?? true,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs || 15000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Remote engine HTTP error: ${response.status}`)
    }

    const data = await response.json()
    return mapRemoteResponseToEngineFormat(data)
  } catch (err) {
    clearTimeout(timeoutId)
    console.warn('[RemoteEngine] Request failed, falling back to local Stockfish:', err)
    throw err
  }
}

/**
 * Maps structured_moves response from Docker server into the format engine.js expects.
 */
export function mapRemoteResponseToEngineFormat(data) {
  const moves = (data.structured_moves || []).map((m) => {
    const score =
      m.cp !== null && m.cp !== undefined
        ? m.cp
        : m.mate !== null && m.mate !== undefined
          ? m.mate > 0
            ? 100000 - m.mate
            : -100000 - m.mate
          : 0

    return {
      rank: m.rank,
      move: m.uci,
      san: m.san,
      pv: Array.isArray(m.pv) && m.pv.length > 0 ? m.pv.slice(0, 5) : [m.uci],
      score: score,
      cp: m.cp ?? null,
      mate: m.mate ?? null,
      isMate: m.mate !== null && m.mate !== undefined,
      wdl: m.wdl || null,
      eco: m.eco || null,
      name: m.name || null,
      ecoName: m.name ? (m.eco ? `[${m.eco}] ${m.name}` : m.name) : (m.eco ? `[${m.eco}]` : (data.opening_info?.name || null)),
      winP: m.win_p ?? (m.wdl ? parseFloat((m.wdl.win / 10).toFixed(1)) : null),
      drawP: m.draw_p ?? (m.wdl ? parseFloat((m.wdl.draw / 10).toFixed(1)) : null),
      lossP: m.loss_p ?? (m.wdl ? parseFloat((m.wdl.loss / 10).toFixed(1)) : null),
      totalGames: m.total ?? null,
      popularity: m.popularity ?? null,
      theoreticalContinuations: Array.isArray(m.theoretical_continuations) && m.theoretical_continuations.length > 0
        ? m.theoretical_continuations
        : null,
    }
  })

  const top = moves[0] || {}
  return {
    mode: data.mode || 'engine',
    opening_info: data.opening_info || null,
    moves,
    bestMove: top.move || null,
    score: top.score || 0,
    cp: top.cp ?? null,
    mate: top.mate ?? null,
  }
}
