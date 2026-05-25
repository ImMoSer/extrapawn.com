import type { IGameplayStrategy } from '@/entities/game'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { useSpeedrunStore } from './speedrun.store'

export class StudySpeedrunStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 150,
    playGameStatusSounds: false,
  }

  private speedrunStore = useSpeedrunStore()
  private userColor: 'white' | 'black'

  constructor(userColor: 'white' | 'black') {
    this.userColor = userColor
  }

  onGameStart(): void {
    // Prevent timer drift by starting timer only after game is fully loaded and started
    this.speedrunStore.startTimer()
  }

  async validateUserMove(uciMove: string): Promise<boolean> {
    const uciPrefix = uciMove.slice(0, 4)
    const currentNode = pgnService.getCurrentNode()
    const children = currentNode.children || []
    const matchingChild = children.find((c) => c.uci.startsWith(uciPrefix))

    if (matchingChild) {
      return true
    } else {
      // Wrong move -> instant failure, sound: error, load next line
      this.speedrunStore.handleChapterFailure()
      return false
    }
  }

  async onUserMoveExecuted(): Promise<void> {
    const currentNode = pgnService.getCurrentNode()
    if (!currentNode.children || currentNode.children.length === 0) {
      this.speedrunStore.handleChapterSuccess(this.speedrunStore.currentTimeMs)
    }
  }

  async requestBotMove(): Promise<string | null> {
    const currentNode = pgnService.getCurrentNode()
    const children = currentNode.children || []

    if (children.length > 0) {
      const replyNode = children[0]
      if (replyNode) {
        return replyNode.uci
      }
    }
    return null
  }

  async onBotMoveExecuted(): Promise<void> {
    const currentNode = pgnService.getCurrentNode()
    if (!currentNode.children || currentNode.children.length === 0) {
      this.speedrunStore.handleChapterSuccess(this.speedrunStore.currentTimeMs)
    }
  }
}
