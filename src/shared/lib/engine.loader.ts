import logger from '@/shared/lib/logger'

export interface EngineController {
  postMessage(command: string): void
  addMessageListener(callback: (message: string) => void): void
  terminate?(): void
}

export function loadLocalEngine(): Promise<EngineController | null> {
  const workerPath = '/stockfish_single/stockfish-18-lite-single.js'
  logger.info(`[EngineLoader] Initializing Single-Thread Web Worker from ${workerPath}`)

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
