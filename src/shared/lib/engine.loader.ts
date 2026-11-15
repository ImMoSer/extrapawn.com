import type { EngineDownloadProgress } from '@/shared/lib/engine/types'
import {
  evictStockfishWasmCache,
  resolveStockfishWasmAsset,
} from '@/shared/lib/engine/wasmCache'
import logger from '@/shared/lib/logger'

const STOCKFISH_SINGLE_WORKER_PATH = '/stockfish/stockfish-19-single.js'

export interface EngineController {
  postMessage(command: string): void
  addMessageListener(callback: (message: string) => void): void
  terminate?(): void
}

export async function loadLocalEngine(
  onProgress?: (progress: EngineDownloadProgress) => void,
): Promise<EngineController> {
  const wasmAsset = await resolveStockfishWasmAsset({ onProgress })
  logger.info(
    `[EngineLoader] Initializing Stockfish 19 Worker (${wasmAsset.fromCache ? 'Cache Storage HIT, 0 B network' : 'downloaded & cached'}, ${(wasmAsset.byteLength / 1_048_576).toFixed(1)} MB)`,
  )

  try {
    const workerUrl = `${STOCKFISH_SINGLE_WORKER_PATH}#${encodeURIComponent(wasmAsset.wasmUrl)}`
    const worker = new Worker(workerUrl)
    const listeners: ((message: string) => void)[] = []
    let uciInitialized = false

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = typeof event.data === 'string' ? event.data : String(event.data)
      if (message === 'uciok' && !uciInitialized) {
        uciInitialized = true
        wasmAsset.revoke()
      }
      listeners.forEach((callback) => callback(message))
    }

    worker.onerror = (error) => {
      wasmAsset.revoke()
      if (!uciInitialized && wasmAsset.fromCache) {
        void evictStockfishWasmCache()
      }
      logger.error('[EngineLoader] Worker execution error:', error)
    }

    return {
      postMessage: (command: string) => {
        worker.postMessage(command)
      },
      addMessageListener: (callback: (message: string) => void) => {
        listeners.push(callback)
      },
      terminate: () => {
        wasmAsset.revoke()
        worker.terminate()
        listeners.length = 0
        logger.info('[EngineLoader] Engine Worker terminated.')
      },
    }
  } catch (error) {
    wasmAsset.revoke()
    logger.error('[EngineLoader] Failed to spawn engine worker.', error)
    throw error
  }
}
