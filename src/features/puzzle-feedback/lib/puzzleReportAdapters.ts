import { localEngineManager, type EvaluatedLine } from '@/shared/lib/engine'
import {
  normalizeUciToken,
  REPORT_STEP_TIMEOUT_MS,
  REPORT_TABLEBASE_TIMEOUT_MS,
  type EngineLineSnapshot,
} from './puzzleReportRules'
import type { MultiPvDepthSnapshot } from './puzzleReportTacticsRules'

const LICHESS_TABLEBASE_ENDPOINT = 'https://tablebase.lichess.ovh/standard'

interface LichessTablebaseResponse {
  category?: string
}

export type SinglePvSearchFn = (params: {
  fen: string
  targetDepth: number
  onDepthProgress: (line: EngineLineSnapshot) => void
  signal?: AbortSignal
}) => Promise<EngineLineSnapshot | null>

export type MultiPvSearchFn = (params: {
  fen: string
  maxDepth: number
  resetGame?: boolean
  shouldEarlyStop: (pair: MultiPvDepthSnapshot) => boolean
  onDepthProgress: (pair: MultiPvDepthSnapshot) => void
  signal?: AbortSignal
}) => Promise<MultiPvDepthSnapshot | null>

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export async function runLocalSinglePvSearch(params: {
  fen: string
  targetDepth: number
  onDepthProgress: (line: EngineLineSnapshot) => void
  signal?: AbortSignal
}): Promise<EngineLineSnapshot | null> {
  const { fen, targetDepth, onDepthProgress, signal } = params
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

            if (snapshot.depth >= targetDepth) {
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

export async function runLocalMultiPvSearch(params: {
  fen: string
  maxDepth: number
  resetGame?: boolean
  shouldEarlyStop: (pair: MultiPvDepthSnapshot) => boolean
  onDepthProgress: (pair: MultiPvDepthSnapshot) => void
  signal?: AbortSignal
}): Promise<MultiPvDepthSnapshot | null> {
  const { fen, maxDepth, resetGame = true, shouldEarlyStop, onDepthProgress, signal } = params
  if (signal?.aborted) {
    throw new DOMException('Verification aborted', 'AbortError')
  }

  await localEngineManager.ensureReady()
  if (resetGame) {
    await localEngineManager.startNewGame()
  }

  if (signal?.aborted) {
    throw new DOMException('Verification aborted', 'AbortError')
  }

  return new Promise<MultiPvDepthSnapshot | null>((resolve, reject) => {
    let settled = false
    const pv1ByDepth = new Map<number, EngineLineSnapshot>()
    const pv2ByDepth = new Map<number, EngineLineSnapshot>()
    let lastCompletedDepth = 0
    let lastPv1Move = ''
    let pv1StableCount = 0
    let latestPair: MultiPvDepthSnapshot | null = null

    const cleanup = () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
    }

    const finishWith = (result: MultiPvDepthSnapshot | null, needStop: boolean) => {
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
      finishWith(latestPair, true)
    }, REPORT_STEP_TIMEOUT_MS)

    signal?.addEventListener('abort', handleAbort, { once: true })

    void localEngineManager
      .startAnalysis(
        fen,
        (lines: EvaluatedLine[], bestMoveUci?: string | null) => {
          if (settled) return

          for (const line of lines) {
            if (line.id !== 1 && line.id !== 2) continue
            const moveUci = line.pvUci[0] ? normalizeUciToken(line.pvUci[0]) : ''
            if (!moveUci) continue

            const snapshot: EngineLineSnapshot = {
              depth: line.depth,
              score: line.score,
              wdl: line.wdl,
              bestMoveUci: moveUci,
            }

            if (line.id === 1) {
              pv1ByDepth.set(line.depth, snapshot)
            } else {
              pv2ByDepth.set(line.depth, snapshot)
            }

            const pv1 = pv1ByDepth.get(line.depth)
            const pv2 = pv2ByDepth.get(line.depth)
            if (pv1 && pv2 && line.depth > lastCompletedDepth) {
              if (pv1.bestMoveUci === lastPv1Move) {
                pv1StableCount += 1
              } else {
                lastPv1Move = pv1.bestMoveUci
                pv1StableCount = 1
              }
              lastCompletedDepth = line.depth

              const pair: MultiPvDepthSnapshot = {
                depth: line.depth,
                pv1,
                pv2,
                pv1StableCount,
              }
              latestPair = pair
              onDepthProgress(pair)

              if (pair.depth >= maxDepth || shouldEarlyStop(pair)) {
                finishWith(pair, true)
                return
              }
            }
          }

          if (bestMoveUci !== undefined && bestMoveUci !== null) {
            if (latestPair) {
              finishWith(latestPair, false)
              return
            }
            const highestPv1 = Array.from(pv1ByDepth.values()).sort((a, b) => b.depth - a.depth)[0]
            if (highestPv1) {
              finishWith(
                {
                  depth: highestPv1.depth,
                  pv1: highestPv1,
                  pv2: pv2ByDepth.get(highestPv1.depth),
                  pv1StableCount: Math.max(1, pv1StableCount),
                },
                false,
              )
              return
            }
            finishWith(
              {
                depth: maxDepth,
                pv1: {
                  depth: maxDepth,
                  score: { type: 'cp', value: 0 },
                  bestMoveUci: normalizeUciToken(bestMoveUci),
                },
                pv1StableCount: 1,
              },
              false,
            )
          }
        },
        { multiPv: 2 },
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
