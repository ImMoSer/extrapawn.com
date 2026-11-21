import { localEngineManager, type EvaluatedLine } from '@/shared/lib/engine'
import {
  normalizeUciToken,
  REPORT_STEP_TIMEOUT_MS,
  REPORT_TABLEBASE_TIMEOUT_MS,
  type EngineLineSnapshot,
} from './puzzleReportRules'

const LICHESS_TABLEBASE_ENDPOINT = 'https://tablebase.lichess.ovh/standard'

interface LichessTablebaseResponse {
  category?: string
}

export type SinglePvSearchFn = (params: {
  fen: string
  targetDepth: number
  shouldEarlyStop: (line: EngineLineSnapshot) => boolean
  onDepthProgress: (line: EngineLineSnapshot) => void
  signal?: AbortSignal
}) => Promise<EngineLineSnapshot | null>

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export async function runLocalSinglePvSearch(params: {
  fen: string
  targetDepth: number
  shouldEarlyStop: (line: EngineLineSnapshot) => boolean
  onDepthProgress: (line: EngineLineSnapshot) => void
  signal?: AbortSignal
}): Promise<EngineLineSnapshot | null> {
  const { fen, targetDepth, shouldEarlyStop, onDepthProgress, signal } = params
  if (signal?.aborted) {
    throw new DOMException('Verification aborted', 'AbortError')
  }

  await localEngineManager.ensureReady()
  await localEngineManager.startNewGame()

  if (signal?.aborted) {
    throw new DOMException('Verification aborted', 'AbortError')
  }

  return new Promise<EngineLineSnapshot | null>((resolve, reject) => {
    let settled = false
    let latestLine: EngineLineSnapshot | null = null

    const cleanup = () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
    }

    const finishWith = (result: EngineLineSnapshot | null, needStop: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      if (needStop) {
        void localEngineManager.stopAnalysis().finally(() => resolve(result))
      } else {
        resolve(result)
      }
    }

    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      void localEngineManager.stopAnalysis().finally(() => {
        reject(new DOMException('Verification aborted', 'AbortError'))
      })
    }

    const timeoutId = setTimeout(() => {
      finishWith(latestLine, true)
    }, REPORT_STEP_TIMEOUT_MS)

    signal?.addEventListener('abort', handleAbort, { once: true })

    void localEngineManager
      .startAnalysis(
        fen,
        (lines: EvaluatedLine[], bestMoveUci?: string | null) => {
          if (settled) return

          for (const line of lines) {
            if (line.id !== 1) continue
            const moveUci = line.pvUci[0] ? normalizeUciToken(line.pvUci[0]) : ''
            if (!moveUci) continue

            const snapshot: EngineLineSnapshot = {
              depth: line.depth,
              score: line.score,
              wdl: line.wdl,
              bestMoveUci: moveUci,
            }
            latestLine = snapshot
            onDepthProgress(snapshot)

            if (snapshot.depth >= targetDepth || shouldEarlyStop(snapshot)) {
              finishWith(snapshot, true)
              return
            }
          }

          if (bestMoveUci !== undefined && bestMoveUci !== null) {
            finishWith(
              latestLine ?? {
                depth: targetDepth,
                score: { type: 'cp', value: 0 },
                bestMoveUci: normalizeUciToken(bestMoveUci),
              },
              false,
            )
          }
        },
        { multiPv: 1 },
      )
      .catch((err: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        reject(err)
      })
  })
}

export async function fetchLichessTablebaseCategory(
  fen: string,
  fetchFn: typeof fetch = fetch,
  parentSignal?: AbortSignal,
): Promise<{ ok: true; category: string } | { ok: false; errorMessage: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REPORT_TABLEBASE_TIMEOUT_MS)
  const onParentAbort = () => controller.abort()
  parentSignal?.addEventListener('abort', onParentAbort, { once: true })

  try {
    const url = `${LICHESS_TABLEBASE_ENDPOINT}?fen=${encodeURIComponent(fen)}`
    const response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      return { ok: false, errorMessage: `Lichess Tablebase HTTP ${response.status}` }
    }

    const data = (await response.json()) as LichessTablebaseResponse
    const rawCategory = (data.category ?? '').trim().toLowerCase()
    if (!rawCategory) {
      return { ok: false, errorMessage: 'Empty Lichess Tablebase category' }
    }
    return { ok: true, category: rawCategory }
  } catch (err: unknown) {
    if (parentSignal?.aborted) {
      throw new DOMException('Verification aborted', 'AbortError')
    }
    return {
      ok: false,
      errorMessage: isAbortError(err)
        ? 'Lichess Tablebase request timed out'
        : err instanceof Error
          ? err.message
          : String(err),
    }
  } finally {
    clearTimeout(timeoutId)
    parentSignal?.removeEventListener('abort', onParentAbort)
  }
}
