import type { EngineDownloadProgress } from './types'
import logger from '@/shared/lib/logger'

export const STOCKFISH_CACHE_PREFIX = 'extrapawn-stockfish-wasm-'
export const STOCKFISH_CACHE_NAME = `${STOCKFISH_CACHE_PREFIX}v19.0.1`
export const STOCKFISH_WASM_URL = '/stockfish/stockfish-19-single.wasm'
export const STOCKFISH_19_EXPECTED_BYTES = 99_169_054

const WASM_BINARY_PREAMBLE = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00] as const
const PROGRESS_EMIT_INTERVAL_MS = 32

export interface ResolvedWasmAsset {
  wasmUrl: string
  fromCache: boolean
  byteLength: number
  revoke: () => void
}

export interface ResolveWasmOptions {
  wasmUrl?: string
  cacheName?: string
  expectedBytes?: number
  onProgress?: (progress: EngineDownloadProgress) => void
  fetchImpl?: typeof fetch
  cacheStorage?: CacheStorage | null
}

interface CachedBlobResult {
  blob: Blob
  fromCache: boolean
}

const inFlightDownloads = new Map<string, Promise<Blob>>()

export function hasValidWasmPreamble(bytes: Uint8Array): boolean {
  if (bytes.byteLength < WASM_BINARY_PREAMBLE.length) {
    return false
  }
  for (let i = 0; i < WASM_BINARY_PREAMBLE.length; i++) {
    if (bytes[i] !== WASM_BINARY_PREAMBLE[i]) {
      return false
    }
  }
  return true
}

function formatTransferSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return ''
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1_048_576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1_048_576).toFixed(1)} MB/s`
}

function formatEtaSeconds(etaSeconds: number): string {
  if (!Number.isFinite(etaSeconds) || etaSeconds <= 0) return ''
  if (etaSeconds < 60) return `${Math.ceil(etaSeconds)} sec`
  return `${Math.round(etaSeconds / 60)} min`
}

function buildDownloadProgress(
  loaded: number,
  total: number,
  startedAtMs: number,
  nowMs: number,
): EngineDownloadProgress {
  const safeTotal = Math.max(1, total)
  const elapsedSeconds = Math.max(0.001, (nowMs - startedAtMs) / 1000)
  const speedBytesPerSec = loaded > 0 ? loaded / elapsedSeconds : 0
  const eta = speedBytesPerSec > 0 && loaded < safeTotal ? (safeTotal - loaded) / speedBytesPerSec : 0

  return {
    percent: Math.min(1, Math.max(0, loaded / safeTotal)),
    loaded,
    total: safeTotal,
    speedBytesPerSec,
    speedText: formatTransferSpeed(speedBytesPerSec),
    eta,
    etaText: formatEtaSeconds(eta),
  }
}

function buildWasmResponseFromChunks(chunks: Uint8Array[], byteLength: number): Response {
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      const chunk = chunks[index]
      index += 1
      if (chunk) {
        controller.enqueue(chunk)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/wasm',
      'Content-Length': String(byteLength),
    },
  })
}

async function isValidCachedWasmBlob(blob: Blob, expectedBytes: number): Promise<boolean> {
  if (blob.size !== expectedBytes) {
    return false
  }
  const headerBuffer = await blob.slice(0, WASM_BINARY_PREAMBLE.length).arrayBuffer()
  return hasValidWasmPreamble(new Uint8Array(headerBuffer))
}

function ensureWasmMimeType(blob: Blob): Blob {
  return blob.type === 'application/wasm' ? blob : blob.slice(0, blob.size, 'application/wasm')
}

function createRevocableBlobAsset(blob: Blob, fromCache: boolean): ResolvedWasmAsset {
  const typedBlob = ensureWasmMimeType(blob)
  const blobUrl = URL.createObjectURL(typedBlob)
  let revoked = false

  return {
    wasmUrl: blobUrl,
    fromCache,
    byteLength: typedBlob.size,
    revoke: () => {
      if (revoked) return
      revoked = true
      URL.revokeObjectURL(blobUrl)
    },
  }
}

export async function pruneLegacyStockfishCaches(
  cacheStorage: CacheStorage,
  activeCacheName = STOCKFISH_CACHE_NAME,
): Promise<void> {
  const keys = await cacheStorage.keys()
  const staleKeys = keys.filter(
    (key) => key.startsWith(STOCKFISH_CACHE_PREFIX) && key !== activeCacheName,
  )
  await Promise.all(staleKeys.map((key) => cacheStorage.delete(key)))
}

export async function evictStockfishWasmCache(
  wasmUrl = STOCKFISH_WASM_URL,
  cacheName = STOCKFISH_CACHE_NAME,
  cacheStorage: CacheStorage | null = typeof caches !== 'undefined' ? caches : null,
): Promise<void> {
  if (!cacheStorage) return
  try {
    const cache = await cacheStorage.open(cacheName)
    await cache.delete(wasmUrl)
    logger.warn(`[WasmCache] Evicted cached WASM entry for ${wasmUrl} (${cacheName}).`)
  } catch (error) {
    logger.warn('[WasmCache] Failed to evict cached WASM entry:', error)
  }
}

async function downloadAndValidateWasmChunks(
  wasmUrl: string,
  expectedBytes: number,
  fetchImpl: typeof fetch,
  onProgress?: (progress: EngineDownloadProgress) => void,
): Promise<Uint8Array[]> {
  const startedAtMs = Date.now()
  const response = await fetchImpl(wasmUrl, { credentials: 'same-origin' })
  if (!response.ok) {
    throw new Error(`Failed to download Stockfish WASM (${wasmUrl}): HTTP ${response.status}`)
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (!hasValidWasmPreamble(bytes)) {
      throw new Error('Invalid Stockfish WASM binary preamble (expected \\0asm v1)')
    }
    if (bytes.byteLength !== expectedBytes) {
      throw new Error(
        `Truncated Stockfish WASM binary: received ${bytes.byteLength} of ${expectedBytes} bytes`,
      )
    }
    onProgress?.(buildDownloadProgress(bytes.byteLength, expectedBytes, startedAtMs, Date.now()))
    return [bytes]
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  const preambleBytes = new Uint8Array(WASM_BINARY_PREAMBLE.length)
  let preambleCollected = 0
  let preambleVerified = false
  let loadedBytes = 0
  let lastProgressEmitMs = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      if (!preambleVerified) {
        const needed = WASM_BINARY_PREAMBLE.length - preambleCollected
        const copyLen = Math.min(needed, value.byteLength)
        preambleBytes.set(value.subarray(0, copyLen), preambleCollected)
        preambleCollected += copyLen

        if (preambleCollected === WASM_BINARY_PREAMBLE.length) {
          if (!hasValidWasmPreamble(preambleBytes)) {
            await reader.cancel()
            throw new Error('Invalid Stockfish WASM binary preamble (expected \\0asm v1)')
          }
          preambleVerified = true
        }
      }

      chunks.push(value.slice())
      loadedBytes += value.byteLength

      const nowMs = Date.now()
      if (onProgress && nowMs - lastProgressEmitMs >= PROGRESS_EMIT_INTERVAL_MS) {
        lastProgressEmitMs = nowMs
        onProgress(buildDownloadProgress(loadedBytes, expectedBytes, startedAtMs, nowMs))
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!preambleVerified || !hasValidWasmPreamble(preambleBytes)) {
    throw new Error('Invalid Stockfish WASM binary preamble (expected \\0asm v1)')
  }
  if (loadedBytes !== expectedBytes) {
    throw new Error(
      `Truncated Stockfish WASM download: received ${loadedBytes} of ${expectedBytes} bytes`,
    )
  }

  onProgress?.(buildDownloadProgress(loadedBytes, expectedBytes, startedAtMs, Date.now()))
  return chunks
}

async function resolveBlobFromCacheOrNetwork(options: ResolveWasmOptions): Promise<CachedBlobResult> {
  const wasmUrl = options.wasmUrl ?? STOCKFISH_WASM_URL
  const cacheName = options.cacheName ?? STOCKFISH_CACHE_NAME
  const expectedBytes = options.expectedBytes ?? STOCKFISH_19_EXPECTED_BYTES
  const fetchImpl = options.fetchImpl ?? fetch
  const cacheStorage =
    options.cacheStorage !== undefined
      ? options.cacheStorage
      : typeof caches !== 'undefined'
        ? caches
        : null

  if (cacheStorage) {
    try {
      const cache = await cacheStorage.open(cacheName)
      const cachedResponse = await cache.match(wasmUrl)
      if (cachedResponse) {
        const cachedBlob = await cachedResponse.blob()
        if (await isValidCachedWasmBlob(cachedBlob, expectedBytes)) {
          options.onProgress?.({
            percent: 1,
            loaded: cachedBlob.size,
            total: cachedBlob.size,
            speedBytesPerSec: 0,
            speedText: '',
            eta: 0,
            etaText: '',
          })
          return { blob: ensureWasmMimeType(cachedBlob), fromCache: true }
        }
        logger.warn(
          `[WasmCache] Cached WASM failed integrity check (size=${cachedBlob.size}, expected=${expectedBytes}). Evicting.`,
        )
        await cache.delete(wasmUrl)
      }
    } catch (cacheReadError) {
      logger.warn('[WasmCache] Cache Storage read failed, falling back to network:', cacheReadError)
    }
  } else {
    logger.warn(
      '[WasmCache] Cache Storage API unavailable in this environment; WASM will not persist across reloads.',
    )
  }

  const dedupeKey = `${cacheName}::${wasmUrl}`
  let downloadPromise = inFlightDownloads.get(dedupeKey)
  if (!downloadPromise) {
    downloadPromise = (async () => {
      try {
        const chunks = await downloadAndValidateWasmChunks(
          wasmUrl,
          expectedBytes,
          fetchImpl,
          options.onProgress,
        )

        if (cacheStorage) {
          try {
            const cache = await cacheStorage.open(cacheName)
            await cache.put(wasmUrl, buildWasmResponseFromChunks(chunks, expectedBytes))
            await pruneLegacyStockfishCaches(cacheStorage, cacheName)
          } catch (cacheWriteError) {
            logger.warn('[WasmCache] Failed to persist WASM in Cache Storage:', cacheWriteError)
          }
        }

        return await buildWasmResponseFromChunks(chunks, expectedBytes).blob()
      } finally {
        inFlightDownloads.delete(dedupeKey)
      }
    })()

    inFlightDownloads.set(dedupeKey, downloadPromise)
  }

  const blob = await downloadPromise
  return { blob, fromCache: false }
}

export async function resolveStockfishWasmAsset(
  options: ResolveWasmOptions = {},
): Promise<ResolvedWasmAsset> {
  const { blob, fromCache } = await resolveBlobFromCacheOrNetwork(options)
  return createRevocableBlobAsset(blob, fromCache)
}
