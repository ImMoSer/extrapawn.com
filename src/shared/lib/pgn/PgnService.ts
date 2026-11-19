// src/shared/lib/pgn/PgnService.ts
import type { Setup as ChessopsSetup } from 'chessops'
import { scalachessCharPair } from 'chessops/compat'
import { makeFen, parseFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import { computed, ref } from 'vue'
import logger from '@/shared/lib/logger'
import {
  buildAnalysisPayloadContext,
  formatCurrentLinePgn,
  formatFullPgn,
  formatShapesToTags,
  stripShapeTagsFromComment,
} from './pgnFormatter'
import {
  buildPathFromNode,
  collectPathNodes,
  disposePgnTree,
  findMainlineNodeAtPly,
  findNodeByPath,
  isAncestorNode,
  mergePgnSubtree,
  setPgnCollapseRecursive,
} from './pgnTreeOps'
import {
  NAG_MAPPING,
  ROOT_NODE_ID,
  STANDARD_START_FEN,
  type DrawShape,
  type NewNodeData,
  type PgnNode,
  type PgnNodeMetadata,
  type PgnStringOptions,
} from './pgnTypes'

export { NAG_MAPPING }
export type { DrawShape, NewNodeData, PgnNode, PgnNodeMetadata, PgnStringOptions }

export class PgnTreeController {
  public readonly version = ref(0)
  private rootNode!: PgnNode
  private currentNode!: PgnNode
  private currentPath!: string
  private gameResult: string = '*'

  constructor(initialFen: string = STANDARD_START_FEN) {
    logger.info('[PgnTreeController] Initialized with tree structure.')
    this.reset(initialFen)
  }

  public reset(fen: string): void {
    disposePgnTree(this.rootNode)

    let normalizedFen = fen
    try {
      const setup: ChessopsSetup = parseFen(fen).unwrap()
      normalizedFen = makeFen(setup)
    } catch (e: unknown) {
      logger.error(
        `[PgnService] Error normalizing FEN "${fen}" in reset: ${e instanceof Error ? e.message : String(e)}. Using original FEN.`,
      )
    }

    this.rootNode = {
      id: ROOT_NODE_ID,
      ply: 0,
      fenBefore: '',
      fenAfter: normalizedFen,
      san: '',
      uci: '',
      children: [],
    }
    this.currentNode = this.rootNode
    this.currentPath = ''
    this.gameResult = '*'
    this.version.value++
    logger.info(
      `[PgnService] Reset with FEN: ${normalizedFen}. Current node is root. Path: "${this.currentPath}"`,
    )
  }

  public setRoot(root: PgnNode, currentPath: string = ''): void {
    this.rootNode = root
    this.currentNode = root
    this.currentPath = ''

    if (currentPath) {
      this.navigateToPath(currentPath)
    }

    this.version.value++
    logger.info('[PgnService] Root swapped.')
  }

  public addNode(data: NewNodeData): PgnNode | null {
    const parentNode = this.currentNode

    if (parentNode.fenAfter !== data.fenBefore) {
      logger.error(
        `[PgnService] FEN mismatch in addNode: parent.fenAfter (${parentNode.fenAfter}) !== newNode.fenBefore (${data.fenBefore}).`,
      )
      return null
    }

    const chessopsMove = parseUci(data.uci)
    if (!chessopsMove) {
      logger.error(`[PgnService] Invalid UCI string for ID generation: ${data.uci}`)
      return null
    }
    const nodeId = scalachessCharPair(chessopsMove)

    const existingChild = parentNode.children.find((child) => child.id === nodeId)
    if (existingChild) {
      this.currentNode = existingChild
      this.currentPath = buildPathFromNode(this.currentNode)
      this.version.value++
      return this.currentNode
    }

    const newNode: PgnNode = {
      id: nodeId,
      ply: parentNode.ply + 1,
      fenBefore: data.fenBefore,
      fenAfter: data.fenAfter,
      san: data.san,
      uci: data.uci,
      parent: parentNode,
      children: [],
      comment: data.comment,
      eval: data.eval,
    }

    parentNode.children.push(newNode)
    this.currentNode = newNode
    this.currentPath = buildPathFromNode(this.currentNode)
    this.version.value++
    return newNode
  }

  public addBlunderVariation(
    data: NewNodeData & { nag?: string; quality?: string },
  ): PgnNode | null {
    const parentNode = this.currentNode
    const newNode = this.addNode(data)
    if (newNode) {
      newNode.metadata = {
        ...newNode.metadata,
        nag: data.nag || '??',
        quality: data.quality || 'blunder',
      }
      this.currentNode = parentNode
      this.currentPath = buildPathFromNode(parentNode)
      this.version.value++
    }
    return newNode
  }

  public buildPathToNode(node: PgnNode): string {
    return buildPathFromNode(node)
  }

  public navigateToNode(node: PgnNode): boolean {
    this.currentNode = node
    this.currentPath = buildPathFromNode(this.currentNode)
    this.version.value++
    return true
  }

  public setGameResult(result: string): void {
    if (['1-0', '0-1', '1/2-1/2', '*'].includes(result)) {
      this.gameResult = result
      logger.info(`[PgnService] Game result set to: ${result}`)
    } else {
      logger.warn(`[PgnService] Invalid game result: ${result}. Using '*'`)
      this.gameResult = '*'
    }
  }

  public getCurrentPgnString(options?: PgnStringOptions): string {
    return formatCurrentLinePgn(this.rootNode, this.currentNode, this.gameResult, options)
  }

  public getNodesCount(): number {
    let count = 0
    let node = this.rootNode.children[0]
    while (node) {
      count++
      node = node.children[0]
    }
    return count
  }

  public getFullPgn(tags: Record<string, string>, root?: PgnNode): string {
    return formatFullPgn(tags, root || this.rootNode, this.gameResult)
  }

  public getCurrentNode(): PgnNode {
    return this.currentNode
  }

  public getRootNode(): PgnNode {
    return this.rootNode
  }

  public currentPathExists(): boolean {
    return !!this.currentPath
  }

  public getCurrentPath(): string {
    return this.currentPath
  }

  public getCurrentNavigatedFen(): string {
    return this.currentNode.fenAfter
  }

  public getCurrentNavigatedNode(): PgnNode | null {
    return this.currentNode.parent ? this.currentNode : null
  }

  public getCurrentSanPath(): string[] {
    return collectPathNodes(this.currentNode).map((n) => n.san)
  }

  public getCurrentUciPath(): string[] {
    return collectPathNodes(this.currentNode).map((n) => n.uci)
  }

  public getFenHistoryForRepetition(): string[] {
    const history: string[] = [this.rootNode.fenAfter]
    for (const node of collectPathNodes(this.currentNode)) {
      history.push(node.fenAfter)
    }
    return history
  }

  public getLastMove(): PgnNode | null {
    return this.currentNode === this.rootNode ? null : this.currentNode
  }

  public undoLastMove(): PgnNode | null {
    const parentNode = this.currentNode.parent
    if (parentNode) {
      const undoneNode = this.currentNode
      this.currentNode = parentNode
      this.currentPath = buildPathFromNode(this.currentNode)
      this.version.value++
      logger.info(
        `[PgnService] Undid move. Current node is now ply ${this.currentNode.ply}, SAN (of parent's move): ${this.currentNode.san}. Path: "${this.currentPath}"`,
      )
      return undoneNode
    }
    logger.warn('[PgnService] No move to undo (already at root).')
    return null
  }

  public navigateToPath(path: string): boolean {
    const targetNode = findNodeByPath(this.rootNode, path)
    if (targetNode) {
      this.currentNode = targetNode
      this.currentPath = path
      this.version.value++
      return true
    }
    logger.warn(`[PgnService] Cannot navigate to path "${path}". Path not found or invalid.`)
    return false
  }

  public navigateToPly(ply: number): boolean {
    if (ply < 0) {
      logger.warn(`[PgnService] Cannot navigate to negative ply: ${ply}`)
      return false
    }
    if (ply === 0) {
      this.navigateToStart()
      return true
    }

    const found = findMainlineNodeAtPly(this.rootNode, ply)
    if (found) {
      this.currentNode = found.node
      this.currentPath = found.path
      this.version.value++
      return true
    }
    logger.warn(
      `[PgnService] Cannot navigate to ply ${ply} on main line. Max ply on main line is currently ${this.currentNode.ply}.`,
    )
    return false
  }

  public navigateBackward(): boolean {
    const parentNode = this.currentNode.parent
    if (parentNode) {
      this.currentNode = parentNode
      this.currentPath = buildPathFromNode(this.currentNode)
      this.version.value++
      return true
    }
    return false
  }

  public navigateForward(variationIndex: number = 0): boolean {
    const childNode = this.currentNode.children[variationIndex]
    if (childNode) {
      this.currentNode = childNode
      this.currentPath += childNode.id
      this.version.value++
      return true
    }
    return false
  }

  public navigateToStart(): void {
    this.currentNode = this.rootNode
    this.currentPath = ''
    this.version.value++
  }

  public navigateToEnd(): void {
    let target = this.rootNode
    let path = ''
    while (target.children.length > 0) {
      target = target.children[0]!
      path += target.id
    }
    this.currentNode = target
    this.currentPath = path
    this.version.value++
  }

  public promoteToVariantMainline(node: PgnNode): void {
    const parent = node.parent
    if (!parent) return

    const index = parent.children.indexOf(node)
    if (index > 0) {
      parent.children.splice(index, 1)
      parent.children.unshift(node)
      this.version.value++
      logger.info(
        `[PgnService] Promoted node ${node.san} (ply ${node.ply}) to its variant mainline.`,
      )
    }
  }

  public promoteToMainline(node: PgnNode): void {
    let current: PgnNode | undefined = node
    let changed = false
    while (current && current.parent) {
      const p: PgnNode = current.parent
      const index = p.children.indexOf(current)
      if (index > 0) {
        p.children.splice(index, 1)
        p.children.unshift(current)
        changed = true
      }
      current = p
    }

    if (changed) {
      this.version.value++
      logger.info(`[PgnService] Promoted node ${node.san} (ply ${node.ply}) to absolute mainline.`)
    }
  }

  public deleteNode(node: PgnNode): void {
    const parent = node.parent
    if (!parent) return

    const index = parent.children.indexOf(node)
    if (index !== -1) {
      parent.children.splice(index, 1)
      if (isAncestorNode(node, this.currentNode)) {
        this.navigateToNode(parent)
      }
      this.version.value++
      logger.info(`[PgnService] Deleted node ${node.san} (ply ${node.ply}) and its subtree.`)
    }
  }

  public deleteCurrentNode(): void {
    if (this.currentNode !== this.rootNode) {
      this.deleteNode(this.currentNode)
    }
  }

  public updateNode(
    node: PgnNode,
    data: Partial<Pick<PgnNode, 'comment' | 'eval' | 'nag' | 'metadata' | 'shapes'>>,
  ): void {
    if ('comment' in data) node.comment = data.comment
    if ('eval' in data) node.eval = data.eval
    if ('nag' in data) node.nag = data.nag
    if ('shapes' in data) node.shapes = data.shapes
    if ('metadata' in data) {
      node.metadata = data.metadata === undefined ? undefined : { ...node.metadata, ...data.metadata }
    }
    this.version.value++
  }

  public updateCommentShapes(node: PgnNode, shapes: DrawShape[]): void {
    node.shapes = shapes
    const cleanComment = this.getCleanComment(node.comment || '')
    const tags = formatShapesToTags(shapes)
    node.comment = tags ? (cleanComment ? `${cleanComment} ${tags}` : tags) : cleanComment
    this.version.value++
  }

  public getCleanComment(comment: string): string {
    return stripShapeTagsFromComment(comment)
  }

  public toggleNodeCollapse(node: PgnNode): void {
    node.isCollapsed = !node.isCollapsed
    this.version.value++
  }

  public setCollapseRecursive(node: PgnNode, state: boolean): void {
    setPgnCollapseRecursive(node, state)
    this.version.value++
  }

  public setCollapseGlobal(state: boolean): void {
    setPgnCollapseRecursive(this.rootNode, state)
    this.version.value++
  }

  public addVariation(
    startNode: PgnNode,
    moves: { san: string; uci: string; fenBefore: string; fenAfter: string }[],
    metadata?: Record<string, unknown>,
  ): void {
    let current = startNode
    for (const move of moves) {
      const chessopsMove = parseUci(move.uci)
      if (!chessopsMove) continue
      const nodeId = scalachessCharPair(chessopsMove)

      let next = current.children.find((child) => child.id === nodeId)
      if (!next) {
        next = {
          id: nodeId,
          ply: current.ply + 1,
          fenBefore: move.fenBefore,
          fenAfter: move.fenAfter,
          san: move.san,
          uci: move.uci,
          parent: current,
          children: [],
          metadata: metadata ? { ...metadata } : undefined,
        }
        current.children.push(next)
      } else if (metadata) {
        next.metadata = { ...next.metadata, ...metadata }
      }
      current = next
    }
    this.version.value++
  }

  public getGameResult(): string {
    return this.gameResult
  }

  public mergeSubtree(target: PgnNode, source: PgnNode): void {
    if (mergePgnSubtree(target, source)) {
      this.version.value++
      logger.info(`[PgnService] Subtree merged into ply ${target.ply}`)
    }
  }

  public canNavigateBackward(): boolean {
    return !!this.currentNode.parent
  }

  public canNavigateForward(variationIndex: number = 0): boolean {
    return !!this.currentNode.children && this.currentNode.children.length > variationIndex
  }

  public getCurrentPly(): number {
    return this.currentNode.ply
  }

  public getAnalysisPayloadContext(overrideLastMoveUci?: string | null): {
    startFen: string
    moves: string[]
  } {
    return buildAnalysisPayloadContext(this.rootNode, this.currentNode, overrideLastMoveUci)
  }
}

export const pgnService = new PgnTreeController()

export const pgnTreeVersion = computed(() => pgnService.version.value)
