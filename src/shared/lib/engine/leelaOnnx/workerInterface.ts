import type { WorkerRequest, WorkerResponse, LeelaOnnxState, LeelaOnnxNetworkInfo } from './types'
import { DEFAULT_LEELA_ONNX_NETWORK } from './networks'

type StateListener = (state: LeelaOnnxState) => void

export class LeelaOnnxEngine {
  private worker: Worker | null = null
  private listeners = new Set<StateListener>()
  private activeNetwork: LeelaOnnxNetworkInfo = DEFAULT_LEELA_ONNX_NETWORK

  private currentState: LeelaOnnxState = {
    isReady: false,
    isLoading: false,
    isThinking: false,
    loadingProgress: 0,
    loadingMessage: '',
    lastMove: null,
    lastConfidence: null,
    wdl: null,
    error: null,
    selectedNetwork: DEFAULT_LEELA_ONNX_NETWORK,
  }

  private pendingInit: {
    resolve: () => void
    reject: (error: Error) => void
    promise: Promise<void>
  } | null = null

  private pendingMove: {
    resolve: (result: { move: string; confidence: number; wdl: [number, number, number] }) => void
    reject: (error: Error) => void
  } | null = null

  private pendingEvaluation: {
    resolve: (wdl: [number, number, number]) => void
    reject: (error: Error) => void
  } | null = null

  constructor() {
    this.spawnWorker()
  }

  private spawnWorker() {
    if (this.worker) {
      this.worker.terminate()
    }
    this.worker = new Worker(
      new URL('./worker.ts', import.meta.url),
      { type: 'module' }
    )
    this.worker.onmessage = this.handleMessage.bind(this)
    this.worker.onerror = (e) => {
      const err = new Error(e.message || 'LeelaONNX Worker Error')
      this.notify({ error: err.message, isLoading: false, isThinking: false })
      if (this.pendingInit) {
        this.pendingInit.reject(err)
        this.pendingInit = null
      }
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    listener(this.currentState)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): LeelaOnnxState {
    return { ...this.currentState }
  }

  private notify(update: Partial<LeelaOnnxState>) {
    this.currentState = { ...this.currentState, ...update }
    for (const listener of this.listeners) {
      listener(this.currentState)
    }
  }

  private handleMessage(e: MessageEvent<WorkerResponse>) {
    const msg = e.data

    switch (msg.type) {
      case 'ready':
        this.notify({ isReady: true, isLoading: false, loadingProgress: 1, loadingMessage: 'Ready' })
        this.pendingInit?.resolve()
        this.pendingInit = null
        break

      case 'initProgress':
        this.notify({
          isLoading: true,
          loadingProgress: msg.progress,
          loadingMessage: msg.message,
        })
        break

      case 'initError': {
        const err = new Error(msg.error)
        this.notify({ error: msg.error, isLoading: false, isReady: false })
        this.pendingInit?.reject(err)
        this.pendingInit = null
        break
      }

      case 'bestMove':
        this.notify({
          isThinking: false,
          lastMove: msg.move,
          lastConfidence: msg.confidence,
          wdl: msg.wdl,
        })
        this.pendingMove?.resolve({
          move: msg.move,
          confidence: msg.confidence,
          wdl: msg.wdl,
        })
        this.pendingMove = null
        break

      case 'evaluation':
        this.pendingEvaluation?.resolve(msg.wdl)
        this.pendingEvaluation = null
        break

      case 'error': {
        const err = new Error(msg.error)
        this.notify({ error: msg.error, isThinking: false })
        this.pendingMove?.reject(err)
        this.pendingEvaluation?.reject(err)
        this.pendingMove = null
        this.pendingEvaluation = null
        break
      }
    }
  }

  async init(net: LeelaOnnxNetworkInfo = DEFAULT_LEELA_ONNX_NETWORK): Promise<void> {
    if (this.activeNetwork.id === net.id && this.currentState.isReady) {
      return Promise.resolve()
    }

    if (this.pendingInit && this.activeNetwork.id === net.id) {
      return this.pendingInit.promise
    }

    this.activeNetwork = net
    this.spawnWorker()
    this.notify({
      isReady: false,
      isLoading: true,
      loadingProgress: 0.05,
      loadingMessage: `Loading ${net.name}...`,
      selectedNetwork: net,
      error: null,
    })

    let resolveFunc!: () => void
    let rejectFunc!: (error: Error) => void
    const promise = new Promise<void>((res, rej) => {
      resolveFunc = res
      rejectFunc = rej
    })

    this.pendingInit = { resolve: resolveFunc, reject: rejectFunc, promise }
    const modelUrl = `/leelaOnnxModels/${net.file}`
    this.post({ type: 'init', modelUrl })

    return promise
  }

  async getBestMove(
    fen: string,
    history: string[],
    legalMoves: string[],
    temperature: number = 0
  ): Promise<{ move: string; confidence: number; wdl: [number, number, number] }> {
    this.notify({ isThinking: true })
    return new Promise((resolve, reject) => {
      if (this.pendingMove) {
        reject(new Error('LeelaONNX engine already has a pending move request'))
        return
      }
      this.pendingMove = { resolve, reject }
      this.post({ type: 'getBestMove', fen, history, legalMoves, temperature })
    })
  }

  async evaluatePosition(
    fen: string,
    history: string[]
  ): Promise<[number, number, number]> {
    return new Promise((resolve, reject) => {
      if (this.pendingEvaluation) {
        reject(new Error('LeelaONNX engine already has a pending evaluation request'))
        return
      }
      this.pendingEvaluation = { resolve, reject }
      this.post({ type: 'evaluatePosition', fen, history })
    })
  }

  private post(msg: WorkerRequest) {
    this.worker?.postMessage(msg)
  }

  terminate() {
    this.worker?.terminate()
    this.worker = null
    this.pendingInit = null
    this.notify({ isReady: false, isLoading: false, isThinking: false })
  }
}

export const leelaOnnxEngine = new LeelaOnnxEngine()
