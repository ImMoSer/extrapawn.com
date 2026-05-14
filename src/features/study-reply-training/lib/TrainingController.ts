import { useBoardStore } from '@/entities/game'
import { useStudyStore } from '@/entities/study'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { soundService } from '@/shared/lib/sound.service'
import i18n from '@/shared/config/i18n'
import type { Key } from '@lichess-org/chessground/types'
import { useReplyTrainingStore } from '../model/reply-training.store'
import { srsService } from './SrsService'

// Use dynamic message to show praise
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'])

export class TrainingController {
  private _boardStore: ReturnType<typeof useBoardStore> | null = null
  private _trainingStore: ReturnType<typeof useReplyTrainingStore> | null = null
  private _studyStore: ReturnType<typeof useStudyStore> | null = null

  private sessionMistakes = 0

  // Lazy loaders for stores to avoid circular dependency issues in some setups
  private get boardStore() {
    if (!this._boardStore) this._boardStore = useBoardStore()
    return this._boardStore
  }
  private get trainingStore() {
    if (!this._trainingStore) this._trainingStore = useReplyTrainingStore()
    return this._trainingStore
  }
  private get studyStore() {
    if (!this._studyStore) this._studyStore = useStudyStore()
    return this._studyStore
  }

  /**
   * Intercepts user moves before they are played.
   * If the move is not in the repertoire, records failure and reverts board (returns true).
   * If it IS in the repertoire, returns false, allowing the normal analysis flow to apply it.
   */
  public handleWrongMoveIntercept(orig: Key, dest: Key): boolean {
    if (!this.trainingStore.isReplyTrainingActive) return false

    const uciPrefix = orig + dest

    const currentNode = pgnService.getCurrentNode()
    const children = currentNode.children || []

    const matchingChild = children.find((c) => c.uci.startsWith(uciPrefix))

    logger.info(
      `[TrainingController] User played ${orig}-${dest}. Normalized to ${uciPrefix}. Valid children: ${children.map((c) => c.uci).join(', ')}`,
    )

    if (matchingChild) {
      logger.info(`[TrainingController] Correct Move! Matched child node ID: ${matchingChild.id}`)
      // The move is roughly correct
      // We update success stats
      this.trainingStore.variantStats.correct++

      // READ-ONLY PROTECTION:
      // Do not allow BoardStore to write/duplicate the move.
      // We just quietly navigate to the node and manually trigger logical progression.
      this.boardStore.navigateToNode(matchingChild)

      // Trigger user sound based on move characteristics
      if (matchingChild.san.includes('x')) {
        soundService.playSound('board_capture')
      } else if (matchingChild.san.includes('O-O')) {
        soundService.playSound('board_castle')
      } else if (matchingChild.san.includes('+') || matchingChild.san.includes('#')) {
        soundService.playSound('board_check')
      } else {
        soundService.playSound('board_move')
      }

      this.onMoveSuccessfullyApplied()

      return true // Intercept entirely! Do not pass to boardStore.handleAnalysisMove
    } else {
      logger.warn(
        `[TrainingController] Incorrect Move. Played ${uciPrefix}, but expected one of: ${children.map((c) => c.uci).join(', ')}`,
      )
      // Move not in repertoire
      this.trainingStore.variantStats.wrong++
      this.sessionMistakes++ // Unkraut wächst!

      soundService.playSound('game_training_error')

      // Revert board (undo the piece drop)
      this.boardStore.syncBoardWithPgn()

      return true // Intercepted
    }
  }

  /**
   * Called via GameLayout when a correct move was successfully added/navigated in PGN.
   */
  public onMoveSuccessfullyApplied() {
    const currentNode = pgnService.getCurrentNode()
    // It's the system's turn to play, check if variation ended
    if (!currentNode.children || currentNode.children.length === 0) {
      this.onVariationEnded()
    } else {
      this.checkOpponentReply()
    }
  }

  private onVariationEnded() {
    if (!this.trainingStore.isReplyTrainingActive) return

    // JÄTEN FINISHED! End of the garden path.
    const currentNode = pgnService.getCurrentNode()
    const N = Math.max(1, currentNode.ply || 1)

    // Update Session Stats
    this.trainingStore.sessionStats.variantsPlayed++
    if (this.sessionMistakes === 0) {
      this.trainingStore.sessionStats.variantsSolved++
    }

    // Mathematics of the Garden
    const alpha = 0.5 // Learning rate
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
      `[TrainingController] Variation ended. Line <${currentNode.id}> Jäten finished. Mistakes: ${this.sessionMistakes}/${N}. Mastery updated to: ${(training.mastery * 100).toFixed(1)}%`,
    )

    pgnService.updateNode(currentNode, { metadata: { ...currentNode.metadata } })

    // SURGICAL UPDATE: Only save the training progress (metadata) to DB
    // This prevents overwriting structural PGN data (comments, arrows) during training
    const nodePath = pgnService.getCurrentPath()
    this.studyStore.persistNodeMetadata(nodePath, currentNode.metadata || null)

    // Reset session errors for the next run
    this.sessionMistakes = 0

    logger.info(`[TrainingController] Variation ended. Resetting to start.`)
    message.success(i18n.global.t('features.study.replyTraining.variationFinished'), {
      duration: 2500,
    })

    // Wait briefly then reset to start
    setTimeout(() => {
      if (!this.trainingStore.isReplyTrainingActive) {
        return
      }

      this.trainingStore.resetVariant()
      this.boardStore.navigatePgn('start')
      this.boardStore.syncBoardWithPgn()

      // Let system move again if the user is black
      this.checkOpponentReply()
    }, 1500)
  }

  /**
   * Plays the system's move automatically if it's the opponent's turn.
   */
  public checkOpponentReply() {
    if (!this.trainingStore.isReplyTrainingActive) return

    const chapterColor = this.studyStore.activeChapter?.color || 'white'
    const turn = this.boardStore.turn // 'white' | 'black'

    logger.info(
      `[TrainingController] Checking opponent reply. Turn: ${turn}, UserColor: ${chapterColor}`,
    )

    // Only move if it's not the user's turn
    if (turn !== chapterColor) {
      setTimeout(() => {
        if (!this.trainingStore.isReplyTrainingActive) return // Check again after delay

        const currentNode = pgnService.getCurrentNode()
        const children = currentNode.children || []

        if (children.length > 0) {
          // SELECTION: Favor nodes with lower success or higher age
          const challengeNode = srsService.selectNextChallenge(children)
          if (challengeNode) {
            logger.info(`[TrainingController] System generated reply: ${challengeNode.uci}`)
            // Apply the move (Logic in boardStore handles PGN sync as well)
            this.boardStore.applyUciMove(challengeNode.uci)

            // If variation immediately ends after system's move (e.g. system plays the last move of repertoire)
            if (!challengeNode.children || challengeNode.children.length === 0) {
              this.onVariationEnded()
            }
          }
        }
      }, 100) // Minimum possible delay to allow DOM updates, maximum speed!
    }
  }

  // Deprecated node-by-node metadata updater, removed in favor of leaf-node mastery update
}

export const trainingController = new TrainingController()
