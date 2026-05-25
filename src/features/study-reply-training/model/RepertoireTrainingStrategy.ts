import type { IGameplayStrategy } from '@/entities/game'
import { useBoardStore } from '@/entities/game'
import { useStudyStore } from '@/entities/study'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { soundService } from '@/shared/lib/sound.service'
import i18n from '@/shared/config/i18n'
import { useReplyTrainingStore } from '../model/reply-training.store'
import { srsService } from '../lib/SrsService'
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])

export class RepertoireTrainingStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 200,
    playGameStatusSounds: false,
  }

  private trainingStore = useReplyTrainingStore()
  private studyStore = useStudyStore()
  private boardStore = useBoardStore()
  private sessionMistakes = 0
  private userColor: 'white' | 'black'
  private startFen: string

  constructor(userColor: 'white' | 'black', startFen: string) {
    this.userColor = userColor
    this.startFen = startFen
  }

  async validateUserMove(uciMove: string): Promise<boolean> {
    if (!this.trainingStore.isReplyTrainingActive) return false

    const uciPrefix = uciMove.slice(0, 4)
    const currentNode = pgnService.getCurrentNode()
    const children = currentNode.children || []
    const matchingChild = children.find((c) => c.uci.startsWith(uciPrefix))

    logger.info(
      `[RepertoireTrainingStrategy] User played ${uciMove}. Matches expected: ${children.map((c) => c.uci).join(', ')}`,
    )

    if (matchingChild) {
      this.trainingStore.variantStats.correct++
      return true
    } else {
      logger.warn(`[RepertoireTrainingStrategy] Incorrect move: ${uciMove}`)
      this.trainingStore.variantStats.wrong++
      this.sessionMistakes++
      soundService.playSound('game_training_error')
      return false
    }
  }

  async onUserMoveExecuted(): Promise<void> {
    const currentNode = pgnService.getCurrentNode()
    if (!currentNode.children || currentNode.children.length === 0) {
      this.onVariationEnded()
    }
  }

  async requestBotMove(): Promise<string | null> {
    if (!this.trainingStore.isReplyTrainingActive) return null

    const currentNode = pgnService.getCurrentNode()
    const children = currentNode.children || []

    if (children.length > 0) {
      const challengeNode = srsService.selectNextChallenge(children)
      if (challengeNode) {
        logger.info(`[RepertoireTrainingStrategy] Bot plays preset: ${challengeNode.uci}`)
        return challengeNode.uci
      }
    }
    return null
  }

  async onBotMoveExecuted(): Promise<void> {
    const currentNode = pgnService.getCurrentNode()
    if (!currentNode.children || currentNode.children.length === 0) {
      this.onVariationEnded()
    }
  }

  private onVariationEnded() {
    if (!this.trainingStore.isReplyTrainingActive) return

    const currentNode = pgnService.getCurrentNode()
    const N = Math.max(1, currentNode.ply || 1)

    this.trainingStore.sessionStats.variantsPlayed++
    if (this.sessionMistakes === 0) {
      this.trainingStore.sessionStats.variantsSolved++
    }

    const alpha = 0.5
    const errorRate = Math.min(this.sessionMistakes, N) / N

    if (!currentNode.metadata) currentNode.metadata = {}
    if (!currentNode.metadata.training) {
      currentNode.metadata.training = { mastery: 0, lastTrained: 0, successes: 0, attempts: 0 }
    }

    const training = currentNode.metadata.training
    if (training.mastery === undefined) {
      training.mastery = training.attempts > 0 ? training.successes / training.attempts : 0
    }

    training.mastery = alpha * (1.0 - errorRate) + (1.0 - alpha) * training.mastery
    training.lastTrained = Date.now()
    training.attempts = (training.attempts || 0) + 1
    if (this.sessionMistakes === 0) {
      training.successes = (training.successes || 0) + 1
    }

    logger.info(
      `[RepertoireTrainingStrategy] Variation ended. Mastery: ${(training.mastery * 100).toFixed(1)}%`,
    )

    pgnService.updateNode(currentNode, { metadata: { ...currentNode.metadata } })
    const nodePath = pgnService.buildPathToNode(currentNode)
    this.studyStore.persistNodeMetadata(nodePath, currentNode.metadata || null)

    this.sessionMistakes = 0

    message.success(i18n.global.t('features.study.replyTraining.variationFinished'), {
      duration: 2500,
    })

    setTimeout(async () => {
      if (!this.trainingStore.isReplyTrainingActive) return

      this.trainingStore.resetVariant()
      pgnService.navigateToStart()
      
      const gameStoreModule = await import('@/entities/game')
      const gameStore = gameStoreModule.useGameStore()
      gameStore.loadPosition(this.startFen)

      // Play system response if first move is bot's turn
      const firstNode = pgnService.getCurrentNode()
      const turn = this.boardStore.turn
      if (turn !== this.userColor && firstNode.children && firstNode.children.length > 0) {
        gameStore.triggerBotMove()
      }
    }, 1500)
  }
}
