import type { PgnNode } from '@/shared/lib/pgn/PgnService'
import logger from '@/shared/lib/logger'

export interface TrainingMetadata {
  successes: number
  attempts: number
  lastTrained?: number
  mastery?: number
}

class SrsService {
  /**
   * Calculates Weed Pressure (0.0 to 1.0) for a LEAF node.
   * 0.0 = Perfectly clean path
   * 1.0 = Maximum weed density (urgent)
   */
  public calculateWeedPressure(leafNode: PgnNode): number {
    const training = leafNode.metadata?.training as TrainingMetadata

    let mastery = 0
    let lastTrained = 0

    if (training) {
      if (training.mastery !== undefined) {
        mastery = training.mastery
      } else if (training.attempts > 0) {
        mastery = training.successes / training.attempts
      }
      lastTrained = training.lastTrained || 0
    }

    if (lastTrained === 0) {
      // Unplayed new node! Weed density is maximum.
      return 1.0
    }

    // Time component
    const msSinceLast = Date.now() - lastTrained
    const daysSinceLast = msSinceLast / (1000 * 60 * 60 * 24)

    // Weed grows by 14% per day. Max 100% after ~7 days.
    // Base weed pressure is determined by how well it was mastered
    // If mastery is 1.0 (perfect), initial weed is 0.0.
    // If mastery is lower, base weed is higher.
    const baseWeed = 1.0 - mastery
    const weedGrowth = daysSinceLast * 0.14

    const W = baseWeed + weedGrowth

    return Math.max(0, Math.min(1.0, W)) // Clamp between 0 and 1
  }

  /**
   * Recursive Deep Search to find all terminal descendant nodes (leafs).
   */
  private getLeafNodes(node: PgnNode, leafs: PgnNode[] = []): PgnNode[] {
    if (!node.children || node.children.length === 0) {
      leafs.push(node)
      return leafs
    }
    for (const child of node.children) {
      this.getLeafNodes(child, leafs)
    }
    return leafs
  }

  /**
   * The Bot is standing at a branching point and evaluates the MAX weed pressure
   * down every possible path, steering the user towards the worst weeds.
   */
  public selectNextChallenge(children: PgnNode[]): PgnNode | null {
    if (children.length === 0) return null
    if (children.length === 1) return children[0]!

    // Evaluate the MAX Weed Pressure down every branch
    const branchScores = children.map((branch, index) => {
      const leafs = this.getLeafNodes(branch)

      let maxWeed = 0
      for (const leaf of leafs) {
        const leafWeed = this.calculateWeedPressure(leaf)
        if (leafWeed > maxWeed) maxWeed = leafWeed
      }

      // If the path has never been played, W is exactly 1.0.
      // We apply a microscopic structural preference to prioritize the Mainline.
      if (maxWeed === 1.0) {
        maxWeed = 1.0 - index * 0.001 // Mainline: 1.000, 1st variation: 0.999
      }

      return { branch, weedPressure: maxWeed }
    })

    // Sort descending by weed pressure (Highest weed = highest priority)
    branchScores.sort((a, b) => b.weedPressure - a.weedPressure)

    logger.info(`[SrsService] Evaluated ${children.length} branch options for system reply:`)
    branchScores.forEach((bs) => {
      logger.info(
        `  - ${bs.branch.uci} (Forest Weed Pressure: ${(bs.weedPressure * 100).toFixed(6)}%)`,
      )
    })
    logger.info(`[SrsService] -> Selected worst weed patch: ${branchScores[0]!.branch.uci}`)

    return branchScores[0]!.branch
  }

  /**
   * Calculates the overall cleanliness (Progress) of a chapter.
   * 0.0 = Totally weedy (urgent)
   * 1.0 = Perfectly clean
   */
  public getChapterCleanliness(rootNode: PgnNode): number {
    const leafs = this.getLeafNodes(rootNode)
    if (leafs.length === 0) return 1.0 // Nothing to do, so it's clean-ish? Or 0? Let's say 1.0.

    let totalWeed = 0
    for (const leaf of leafs) {
      totalWeed += this.calculateWeedPressure(leaf)
    }

    const avgWeed = totalWeed / leafs.length
    return 1.0 - avgWeed
  }
}

export const srsService = new SrsService()
