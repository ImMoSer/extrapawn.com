export interface ChessQuote {
  id: number
  author: string
  text: string
  translation_ru: string
}

const QUOTES_URL = '/quotes/lichess_quotes.json'

let cachedQuotes: ChessQuote[] | null = null
let inFlightRequest: Promise<ChessQuote[]> | null = null

function isChessQuote(value: unknown): value is ChessQuote {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'number' &&
    typeof record.author === 'string' &&
    record.author.length > 0 &&
    typeof record.text === 'string' &&
    record.text.length > 0 &&
    typeof record.translation_ru === 'string' &&
    record.translation_ru.length > 0
  )
}

export async function loadChessQuotes(): Promise<ChessQuote[]> {
  if (cachedQuotes !== null) {
    return cachedQuotes
  }
  if (inFlightRequest !== null) {
    return inFlightRequest
  }

  inFlightRequest = (async () => {
    const response = await fetch(QUOTES_URL)
    if (!response.ok) {
      throw new Error(
        `[QuotesService] Failed to fetch quotes from ${QUOTES_URL}: HTTP ${response.status}`,
      )
    }

    const raw: unknown = await response.json()
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error('[QuotesService] Quotes payload must be a non-empty array')
    }

    for (let i = 0; i < raw.length; i++) {
      if (!isChessQuote(raw[i])) {
        throw new Error(`[QuotesService] Invalid quote entry at index ${i}`)
      }
    }

    cachedQuotes = raw as ChessQuote[]
    return cachedQuotes
  })()

  try {
    return await inFlightRequest
  } finally {
    inFlightRequest = null
  }
}

export function getRandomChessQuote(quotes: readonly ChessQuote[], excludeId?: number): ChessQuote {
  if (quotes.length === 0) {
    throw new Error('[QuotesService] Cannot pick a random quote from an empty list')
  }

  if (quotes.length === 1) {
    const single = quotes[0]
    if (!single) {
      throw new Error('[QuotesService] Missing quote at index 0')
    }
    return single
  }

  const pool = excludeId !== undefined ? quotes.filter((q) => q.id !== excludeId) : quotes
  const randomIndex = Math.floor(Math.random() * pool.length)
  const selected = pool[randomIndex]
  if (!selected) {
    throw new Error(`[QuotesService] Failed to select quote at index ${randomIndex}`)
  }
  return selected
}

