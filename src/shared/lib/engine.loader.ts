import logger from '@/shared/lib/logger'

export interface EngineController {
  postMessage(command: string): void
  addMessageListener(callback: (message: string) => void): void
  terminate?(): void
}

export function loadMultiThreadEngine(): Promise<EngineController | null> {
  if (!window.crossOriginIsolated) {
    logger.warn('[EngineLoader] Multi-threaded engine not supported: crossOriginIsolated is false.')
    return Promise.resolve(null)
  }

  const workerPath = '/npm_stockfish/sf_1807_multi_lite/stockfish-18-lite.js'
  logger.info(`[EngineLoader] Initializing Web Worker from ${workerPath}`)

  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(workerPath)
      const listeners: ((message: string) => void)[] = []

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
