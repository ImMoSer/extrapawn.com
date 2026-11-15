import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EngineDownloadProgress } from '../types'
import {
  hasValidWasmPreamble,
  resolveStockfishWasmAsset,
  STOCKFISH_CACHE_NAME,
  STOCKFISH_CACHE_PREFIX,
  STOCKFISH_WASM_URL,
} from '../wasmCache'

function createSyntheticWasmBytes(totalLength: number): Uint8Array {
  const bytes = new Uint8Array(totalLength)
  // Standard WebAssembly v1 preamble: \0asm + version 1
  bytes.set([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00], 0)
  for (let i = 8; i < totalLength; i++) {
    bytes[i] = (i * 31) & 0xff
  }
  return bytes
}

function createChunkedStreamResponse(chunks: Uint8Array[], status = 200): Response {
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      const nextChunk = chunks[index]
      index += 1
      if (nextChunk) {
        controller.enqueue(nextChunk)
      }
    },
  })

  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'application/wasm' },
  })
}

class InMemoryCache implements Cache {
  private readonly store = new Map<string, Response>()

  private normalizeKey(request: RequestInfo | URL): string {
    if (typeof request === 'string') return request
    if (request instanceof URL) return request.toString()
    return request.url
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const stored = this.store.get(this.normalizeKey(request))
    return stored ? stored.clone() : undefined
  }

  async matchAll(): Promise<readonly Response[]> {
    return Array.from(this.store.values(), (res) => res.clone())
  }

  async add(): Promise<void> {
    throw new Error('Not implemented in mock')
  }

  async addAll(): Promise<void> {
    throw new Error('Not implemented in mock')
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.store.set(this.normalizeKey(request), response.clone())
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.store.delete(this.normalizeKey(request))
  }

  async keys(): Promise<readonly Request[]> {
    return Array.from(this.store.keys(), (url) => new Request(`https://extrapawn.local${url}`))
  }
}

class InMemoryCacheStorage implements CacheStorage {
  public readonly buckets = new Map<string, InMemoryCache>()

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    for (const bucket of this.buckets.values()) {
      const hit = await bucket.match(request)
      if (hit) return hit
    }
    return undefined
  }

  async has(cacheName: string): Promise<boolean> {
    return this.buckets.has(cacheName)
  }

  async open(cacheName: string): Promise<Cache> {
    let bucket = this.buckets.get(cacheName)
    if (!bucket) {
      bucket = new InMemoryCache()
      this.buckets.set(cacheName, bucket)
    }
    return bucket
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.buckets.delete(cacheName)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.buckets.keys())
  }
}

describe('wasmCache — Persistent Stockfish 19 WASM Cache Storage', () => {
  let cacheStorage: InMemoryCacheStorage
  const createdUrls: string[] = []
  const revokedUrls: string[] = []

  beforeEach(() => {
    cacheStorage = new InMemoryCacheStorage()
    createdUrls.length = 0
    revokedUrls.length = 0

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:https://extrapawn.local/${createdUrls.length + 1}`
      createdUrls.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revokedUrls.push(url)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('validates WebAssembly v1 binary preamble strictly', () => {
    expect(hasValidWasmPreamble(createSyntheticWasmBytes(16))).toBe(true)
    expect(hasValidWasmPreamble(new TextEncoder().encode('<!DOCTYPE html>'))).toBe(false)
    expect(hasValidWasmPreamble(new Uint8Array([0x00, 0x61, 0x73]))).toBe(false)
  })

  it('downloads on Cache MISS, persists to Cache Storage, prunes legacy versions, and serves subsequent calls from disk with 0 network fetches', async () => {
    const legacyCacheName = `${STOCKFISH_CACHE_PREFIX}v18.0.0`
    await cacheStorage.open(legacyCacheName)
    expect(await cacheStorage.has(legacyCacheName)).toBe(true)

    const expectedBytes = 1024
    const payload = createSyntheticWasmBytes(expectedBytes)
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      createChunkedStreamResponse([payload.subarray(0, 512), payload.subarray(512)]),
    )

    const firstProgress: EngineDownloadProgress[] = []
    const firstAsset = await resolveStockfishWasmAsset({
      wasmUrl: STOCKFISH_WASM_URL,
      cacheName: STOCKFISH_CACHE_NAME,
      expectedBytes,
      fetchImpl: fetchMock,
      cacheStorage,
      onProgress: (p) => firstProgress.push(p),
    })

    expect(firstAsset.fromCache).toBe(false)
    expect(firstAsset.byteLength).toBe(expectedBytes)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(firstProgress[firstProgress.length - 1]?.percent).toBe(1)
    expect(await cacheStorage.has(legacyCacheName)).toBe(false)
    expect(await cacheStorage.has(STOCKFISH_CACHE_NAME)).toBe(true)

    firstAsset.revoke()
    firstAsset.revoke() // idempotent
    expect(revokedUrls).toEqual([firstAsset.wasmUrl])

    // Second call (e.g. after PC reboot or switching Lichess user): 0 network calls!
    const secondProgress: EngineDownloadProgress[] = []
    const secondAsset = await resolveStockfishWasmAsset({
      wasmUrl: STOCKFISH_WASM_URL,
      cacheName: STOCKFISH_CACHE_NAME,
      expectedBytes,
      fetchImpl: fetchMock,
      cacheStorage,
      onProgress: (p) => secondProgress.push(p),
    })

    expect(secondAsset.fromCache).toBe(true)
    expect(secondAsset.byteLength).toBe(expectedBytes)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(secondProgress).toHaveLength(1)
    expect(secondProgress[0]?.percent).toBe(1)
  })

  it('fails fast on non-WASM HTML fallback response and never pollutes Cache Storage', async () => {
    const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html>502 Bad Gateway</html>')
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => createChunkedStreamResponse([htmlBytes]))

    await expect(
      resolveStockfishWasmAsset({
        wasmUrl: STOCKFISH_WASM_URL,
        cacheName: STOCKFISH_CACHE_NAME,
        expectedBytes: htmlBytes.byteLength,
        fetchImpl: fetchMock,
        cacheStorage,
      }),
    ).rejects.toThrow(/preamble/i)

    const activeCache = await cacheStorage.open(STOCKFISH_CACHE_NAME)
    expect(await activeCache.match(STOCKFISH_WASM_URL)).toBeUndefined()
  })

  it('fails fast on truncated WASM stream and never writes partial bytes to Cache Storage', async () => {
    const fullBytes = 2048
    const truncatedChunk = createSyntheticWasmBytes(600)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => createChunkedStreamResponse([truncatedChunk]))

    await expect(
      resolveStockfishWasmAsset({
        wasmUrl: STOCKFISH_WASM_URL,
        cacheName: STOCKFISH_CACHE_NAME,
        expectedBytes: fullBytes,
        fetchImpl: fetchMock,
        cacheStorage,
      }),
    ).rejects.toThrow(/Truncated Stockfish WASM/i)

    const activeCache = await cacheStorage.open(STOCKFISH_CACHE_NAME)
    expect(await activeCache.match(STOCKFISH_WASM_URL)).toBeUndefined()
  })

  it('evicts corrupted cached entry and self-heals from network', async () => {
    const expectedBytes = 512
    const activeCache = await cacheStorage.open(STOCKFISH_CACHE_NAME)
    await activeCache.put(
      STOCKFISH_WASM_URL,
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' },
      }),
    )

    const validPayload = createSyntheticWasmBytes(expectedBytes)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => createChunkedStreamResponse([validPayload]))

    const healedAsset = await resolveStockfishWasmAsset({
      wasmUrl: STOCKFISH_WASM_URL,
      cacheName: STOCKFISH_CACHE_NAME,
      expectedBytes,
      fetchImpl: fetchMock,
      cacheStorage,
    })

    expect(healedAsset.fromCache).toBe(false)
    expect(healedAsset.byteLength).toBe(expectedBytes)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const thirdCallAsset = await resolveStockfishWasmAsset({
      wasmUrl: STOCKFISH_WASM_URL,
      cacheName: STOCKFISH_CACHE_NAME,
      expectedBytes,
      fetchImpl: fetchMock,
      cacheStorage,
    })
    expect(thirdCallAsset.fromCache).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
