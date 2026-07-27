import type { WorkerRequest, WorkerResponse } from './types'
import { encodeFenHistory } from './encoding'
import { decodePolicyOutput } from './decoding'
import { initModel, runInference } from './inference'
import { getCachedModel, cacheModel, decompressGzip } from './modelCache'

function post(msg: WorkerResponse) {
  console.log('[LeelaONNX/Worker -> Main]', msg.type, 'message' in msg ? msg.message : '')
  self.postMessage(msg)
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  console.log('[LeelaONNX/Worker <- Main]', msg.type, msg)

  switch (msg.type) {
    case 'init': {
      try {
        post({ type: 'initProgress', progress: 0.1, message: 'Checking model cache...' })

        let modelData = await getCachedModel(msg.modelUrl)

        if (!modelData) {
          console.log('[LeelaONNX/Worker] Model not in cache. Fetching:', msg.modelUrl)
          post({
            type: 'initProgress',
            progress: 0.2,
            message: 'Loading Leela ONNX model...',
          })

          let response = await fetch(msg.modelUrl)
          if (!response.ok) {
            response = await fetch(msg.modelUrl + '.bin')
          }
          if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status} (${msg.modelUrl})`)
          }

          const contentLength = response.headers.get('Content-Length')
          const total = contentLength ? parseInt(contentLength, 10) : 0

          let compressed: ArrayBuffer
          if (total > 0 && response.body) {
            const reader = response.body.getReader()
            const chunks: Uint8Array[] = []
            let received = 0

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              chunks.push(value)
              received += value.length
              const dlProgress = 0.2 + (received / total) * 0.5
              post({
                type: 'initProgress',
                progress: dlProgress,
                message: `Loading... ${Math.round((received / total) * 100)}%`,
              })
            }

            const buffer = new Uint8Array(received)
            let pos = 0
            for (const chunk of chunks) {
              buffer.set(chunk, pos)
              pos += chunk.length
            }
            compressed = buffer.buffer
          } else {
            compressed = await response.arrayBuffer()
          }

          console.log('[LeelaONNX/Worker] Model downloaded. Size:', compressed.byteLength)

          post({
            type: 'initProgress',
            progress: 0.75,
            message: 'Decompressing model...',
          })
          try {
            modelData = await decompressGzip(compressed)
          } catch {
            modelData = compressed
          }

          post({
            type: 'initProgress',
            progress: 0.85,
            message: 'Caching model in browser...',
          })
          await cacheModel(msg.modelUrl, modelData)
        } else {
          console.log('[LeelaONNX/Worker] Model loaded from IndexedDB cache. Size:', modelData.byteLength)
          post({
            type: 'initProgress',
            progress: 0.8,
            message: 'Loaded model from cache',
          })
        }

        post({
          type: 'initProgress',
          progress: 0.9,
          message: 'Initializing Leela ONNX neural network...',
        })
        await initModel(modelData)

        post({ type: 'ready' })
      } catch (error) {
        console.error('[LeelaONNX/Worker] init failed:', error)
        post({
          type: 'initError',
          error: error instanceof Error ? error.message : String(error),
        })
      }
      break
    }

    case 'getBestMove': {
      try {
        const { fen, history, legalMoves, temperature = 0 } = msg
        const isBlack = fen.split(' ')[1] === 'b'

        const inputTensor = encodeFenHistory(history)
        const { policy, wdl } = await runInference(inputTensor)
        const result = decodePolicyOutput(policy, legalMoves, isBlack, temperature)

        console.log('[LeelaONNX/Worker] Best move decoded:', result.best)

        post({
          type: 'bestMove',
          move: result.best.move,
          confidence: result.best.confidence,
          wdl: wdl,
        })
      } catch (error) {
        console.error('[LeelaONNX/Worker] getBestMove failed:', error)
        post({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
      break
    }

    case 'evaluatePosition': {
      try {
        const inputTensor = encodeFenHistory(msg.history)
        const { wdl } = await runInference(inputTensor)
        post({
          type: 'evaluation',
          wdl,
        })
      } catch (error) {
        console.error('[LeelaONNX/Worker] evaluatePosition failed:', error)
        post({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
      break
    }
  }
}
