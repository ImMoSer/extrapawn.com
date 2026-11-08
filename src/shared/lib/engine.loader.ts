import type { EngineDownloadProgress } from '@/shared/lib/engine/types'
import logger from '@/shared/lib/logger'

const STOCKFISH_SINGLE_WORKER_PATH = '/stockfish/stockfish-19-single.js'

export interface EngineController {
  postMessage(command: string): void
  addMessageListener(callback: (message: string) => void): void
  terminate?(): void
}

export function loadLocalEngine(
  onProgress?: (progress: EngineDownloadProgress) => void,
): Promise<EngineController> {
  logger.info(
    `[EngineLoader] Initializing Single-Thread Web Worker from ${STOCKFISH_SINGLE_WORKER_PATH}`,
  )

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(STOCKFISH_SINGLE_WORKER_PATH)
      const listeners: ((message: string) => void)[] = []
      let progressPort: MessagePort | null = null

      if (onProgress && typeof MessageChannel !== 'undefined') {
        const channel = new MessageChannel()
        progressPort = channel.port1
        progressPort.onmessage = (event: MessageEvent<unknown>) => {
          const data = event.data as Partial<EngineDownloadProgress> | null
          if (
            data &&
            typeof data.percent === 'number' &&
            typeof data.loaded === 'number' &&
            typeof data.total === 'number'
          ) {
            onProgress({
              percent: Math.min(1, Math.max(0, data.percent)),
              loaded: data.loaded,
              total: data.total,
              speedBytesPerSec:
                typeof data.speedBytesPerSec === 'number' ? data.speedBytesPerSec : 0,
              speedText: typeof data.speedText === 'string' ? data.speedText : '',
              eta: typeof data.eta === 'number' ? data.eta : 0,
              etaText: typeof data.etaText === 'string' ? data.etaText : '',
            })
          }
        }
        worker.postMessage({ progressPort: channel.port2 }, [channel.port2])
      }

      worker.onmessage = (event: MessageEvent) => {
        const message = typeof event.data === 'string' ? event.data : String(event.data)
        listeners.forEach((callback) => callback(message))
      }

      worker.onerror = (error) => {
        logger.error('[EngineLoader] Worker execution error:', error)
        reject(error)
      }

      const engineAdapter: EngineController = {
        postMessage: (command: string) => {
          worker.postMessage(command)
        },
        addMessageListener: (callback: (message: string) => void) => {
          listeners.push(callback)
        },
        terminate: () => {
          if (progressPort) {
            progressPort.close()
            progressPort = null
          }
          worker.terminate()
          listeners.length = 0
          logger.info('[EngineLoader] Engine Worker terminated.')
        },
      }

      resolve(engineAdapter)
    } catch (error) {
      logger.error('[EngineLoader] Failed to spawn engine worker.', error)
      reject(error)
    }
  })
}
