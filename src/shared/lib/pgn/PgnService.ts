// src/services/PgnService.ts
import type { Setup as ChessopsSetup } from 'chessops'
import { Chess } from 'chessops/chess'
import { scalachessCharPair } from 'chessops/compat'
import { makeFen, parseFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import { readonly, ref } from 'vue'
import logger from '@/shared/lib/logger'

export interface DrawShape {
  orig: string
  dest?: string
  brush?: string
  modifiers?: {
    lineWidth?: number
  }
}

const BRUSH_TO_LICHESS: Record<string, string> = {
  green: 'G',
  red: 'R',
  blue: 'B',
  yellow: 'Y',
}

export const NAG_MAPPING: Record<number, { symbol: string; quality: string }> = {
  1: { symbol: '!', quality: 'best' },
  2: { symbol: '?', quality: 'mistake' },
  3: { symbol: '!!', quality: 'brilliant' },
  4: { symbol: '??', quality: 'blunder' },
  5: { symbol: '!?', quality: 'interesting' },
  6: { symbol: '?!', quality: 'inaccuracy' },
  7: { symbol: '□', quality: 'forced' },
  10: { symbol: '=', quality: 'equal' }, // Drawish
  13: { symbol: '∞', quality: 'unclear' },
  14: { symbol: '±', quality: 'better-white' }, // White is slightly better
  15: { symbol: '∓', quality: 'better-black' }, // Black is slightly better
  16: { symbol: '±', quality: 'better-white' }, // +/=
  17: { symbol: '∓', quality: 'better-black' }, // =/+
  18: { symbol: '+-', quality: 'winning-white' }, // +-
  19: { symbol: '-+', quality: 'winning-black' }, // -+
  20: { symbol: '+-', quality: 'winning-white' }, // Decisive advantage white
  21: { symbol: '-+', quality: 'winning-black' }, // Decisive advantage black
  32: { symbol: '⟳', quality: 'development' },
  36: { symbol: '↑', quality: 'initiative' },
  40: { symbol: '→', quality: 'attack' },
  44: { symbol: '⇄', quality: 'counterplay' },
  132: { symbol: '⇆', quality: 'counterplay' },
  146: { symbol: 'N', quality: 'novelty' },
}

export interface PgnNode {
  id: string
  ply: number
  fenBefore: string
  fenAfter: string
  san: string
  uci: string
  parent?: PgnNode | undefined
  children: PgnNode[]
  comment?: string | undefined
  eval?: number | undefined
  nag?: number | undefined
  isCollapsed?: boolean | undefined
  shapes?: DrawShape[] | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any> | undefined
}

export interface NewNodeData {
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  comment?: string
  eval?: number
}

export interface PgnStringOptions {
  showResult?: boolean
  showVariations?: boolean
}

const ROOT_NODE_ID = '__ROOT__'

const treeVersion = ref(0)

class PgnServiceController {
  private rootNode!: PgnNode
  private currentNode!: PgnNode
  private currentPath!: string
  private gameResult: string = '*'

  constructor() {
    logger.info('[PgnService] Initialized with tree structure.')
    this.reset('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  }

  public reset(fen: string): void {
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
    treeVersion.value++
    logger.info(
      `[PgnService] Reset with FEN: ${normalizedFen}. Current node is root. Path: "${this.currentPath}"`,
    )
  }

  public setRoot(root: PgnNode, currentPath: string = ''): void {
    this.rootNode = root
    this.currentNode = root
    this.currentPath = ''

    // reset game result or store it in PgnNode if needed?
    // For now assume logic handles result separately or it's not part of the tree node properly.

    if (currentPath) {
      this.navigateToPath(currentPath)
    }

    treeVersion.value++
    logger.info(`[PgnService] Root swapped.`)
  }

  public addNode(data: NewNodeData): PgnNode | null {
    const parentNode = this.currentNode

    if (parentNode.fenAfter !== data.fenBefore) {
      logger.error(
        `[PgnService] FEN mismatch in addNode: parent.fenAfter (${parentNode.fenAfter}) !== newNode.fenBefore (${data.fenBefore}).`,
      )
      // This is often why the second move fails if parentNode wasn't updated or fenBefore is wrong
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
      // logger.debug(`[PgnService] Node with ID ${nodeId} (UCI: ${data.uci}) already exists as a child. Navigating to it.`)
      this.currentNode = existingChild
      this.currentPath = this.buildPath(this.currentNode)
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
    this.currentPath = this.buildPath(this.currentNode)
    treeVersion.value++

    // logger.debug(`[PgnService] Node added: Ply ${newNode.ply}, SAN ${newNode.san}, ID ${newNode.id}. Path: "${this.currentPath}"`)
    return newNode
  }

  private buildPath(node: PgnNode): string {
    let path = ''
    let current: PgnNode | undefined = node
    while (current && current.parent) {
      path = current.id + path
      current = current.parent
    }
    return path
  }

  public buildPathToNode(node: PgnNode): string {
    return this.buildPath(node)
  }

  public navigateToNode(node: PgnNode): boolean {
    this.currentNode = node
    this.currentPath = this.buildPath(this.currentNode)
    treeVersion.value++
    // logger.debug(`[PgnService] Navigated directly to node: Ply ${node.ply}, SAN ${node.san}. Path: "${this.currentPath}"`)
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
    let pgn = ''
    const pathNodes: PgnNode[] = []
    let N: PgnNode | undefined = this.currentNode
    while (N && N.parent) {
      pathNodes.unshift(N)
      N = N.parent
    }

    if (pathNodes.length === 0) {
      return options?.showResult ? this.gameResult : ''
    }

    let currentFullMoveNumber = 1
    let isWhiteToMoveInitially = true

    try {
      const rootSetup = parseFen(this.rootNode.fenAfter).unwrap()
      const rootChessPos = Chess.fromSetup(rootSetup).unwrap()
      currentFullMoveNumber = rootChessPos.fullmoves
      isWhiteToMoveInitially = rootChessPos.turn === 'white'
    } catch (e: unknown) {
      logger.warn(
        `[PgnService] Could not parse root FEN or create Chess pos for PGN string: ${e instanceof Error ? e.message : String(e)}`,
      )
    }

    for (let i = 0; i < pathNodes.length; i++) {
      const node = pathNodes[i]
      if (!node) continue

      const isWhiteMoveInPgn =
        (node.ply % 2 === 1 && isWhiteToMoveInitially) ||
        (node.ply % 2 === 0 && !isWhiteToMoveInitially)

      if (isWhiteMoveInPgn) {
        if (pgn.length > 0) pgn += options?.showVariations ? ' ' : '\n'
        pgn += `${currentFullMoveNumber}. `
      } else {
        if (i === 0 && !isWhiteToMoveInitially) {
          pgn += `${currentFullMoveNumber}... `
        } else {
          pgn += ` `
        }
      }
      pgn += node.san

      if (node.comment && options?.showVariations) {
        pgn += ` {${node.comment}}`
      }

      if (!isWhiteMoveInPgn) {
        currentFullMoveNumber++
      }
    }

    if (options?.showResult && this.gameResult !== '*') {
      pgn += (pgn.length > 0 ? ' ' : '') + this.gameResult
    }
    return pgn.trim()
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
    let pgn = ''
    for (const [key, value] of Object.entries(tags)) {
      pgn += `[${key} "${value}"]\n`
    }
    if (Object.keys(tags).length > 0) pgn += '\n'

    const targetRoot = root || this.rootNode
    const rootSetup = parseFen(targetRoot.fenAfter).unwrap()
    const isWhiteToMoveInitially = rootSetup.turn === 'white'
    const initialFullMoveNumber = rootSetup.fullmoves

    pgn += this.renderTree(targetRoot, isWhiteToMoveInitially, initialFullMoveNumber, false)
    pgn += ` ${this.gameResult}`
    return pgn.trim()
  }

  private renderTree(
    node: PgnNode,
    isWhiteToMove: boolean,
    fullMoveNumber: number,
    forceMoveNumber: boolean,
  ): string {
    if (node.children.length === 0) return ''

    const mainLine = node.children[0]
    if (!mainLine) return ''
    const variations = node.children.slice(1)

    const nextFullMove = isWhiteToMove ? fullMoveNumber : fullMoveNumber + 1
    const nextTurn = !isWhiteToMove

    let pgn = ''

    // 1. Render mainline move
    if (isWhiteToMove || forceMoveNumber) {
      pgn += `${fullMoveNumber}${isWhiteToMove ? '.' : '...'} `
    }
    pgn += mainLine.san
    if (mainLine.nag) pgn += ` $${mainLine.nag}`
    if (mainLine.comment) pgn += ` {${mainLine.comment}}`

    // 2. Render variations (siblings of mainline)
    for (const variation of variations) {
      pgn += ` (${fullMoveNumber}${isWhiteToMove ? '.' : '...'} ${variation.san}${variation.nag ? ` $${variation.nag}` : ''}${variation.comment ? ` {${variation.comment}}` : ''}`
      const varContinuation = this.renderTree(variation, nextTurn, nextFullMove, false)
      if (varContinuation) pgn += ' ' + varContinuation
      pgn += `)`
    }

    // 3. Render mainline continuation
    // forceMoveNumber is true if we had variations, because they "break" the flow
    const continuation = this.renderTree(mainLine, nextTurn, nextFullMove, variations.length > 0)
    if (continuation) pgn += ' ' + continuation

    return pgn
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
    const path: string[] = []
    let N: PgnNode | undefined = this.currentNode
    while (N && N.parent) {
      path.unshift(N.san)
      N = N.parent
    }
    return path
  }

  public getCurrentUciPath(): string[] {
    const path: string[] = []
    let N: PgnNode | undefined = this.currentNode
    while (N && N.parent) {
      path.unshift(N.uci)
      N = N.parent
    }
    return path
  }

  public getFenHistoryForRepetition(): string[] {
    const history: string[] = [this.rootNode.fenAfter]
    let N: PgnNode | undefined = this.currentNode
    const pathNodes: PgnNode[] = []

    while (N && N.parent) {
      pathNodes.unshift(N)
      N = N.parent
    }
    pathNodes.forEach((node) => {
      if (node) {
        history.push(node.fenAfter)
      }
    })
    return history
  }

  public getLastMove(): PgnNode | null {
    if (this.currentNode === this.rootNode) return null
    return this.currentNode
  }

  public undoLastMove(): PgnNode | null {
    const parentNode = this.currentNode.parent
    if (parentNode) {
      const undoneNode = this.currentNode
      this.currentNode = parentNode
      this.currentPath = this.buildPath(this.currentNode)
      treeVersion.value++
      logger.info(
        `[PgnService] Undid move. Current node is now ply ${this.currentNode.ply}, SAN (of parent's move): ${this.currentNode.san}. Path: "${this.currentPath}"`,
      )
      return undoneNode
    }
    logger.warn(`[PgnService] No move to undo (already at root).`)
    return null
  }

  public navigateToPath(path: string): boolean {
    let targetNode: PgnNode | undefined = this.rootNode
    let currentPathSegment = path

    while (currentPathSegment.length > 0 && targetNode) {
      let foundChild = false
      // <<< НАЧАЛО ИЗМЕНЕНИЙ: Убрана некорректная аннотация типа
      for (const child of targetNode.children) {
        // <<< КОНЕЦ ИЗМЕНЕНИЙ
        if (currentPathSegment.startsWith(child.id)) {
          targetNode = child
          currentPathSegment = currentPathSegment.substring(child.id.length)
          foundChild = true
          break
        }
      }
      if (!foundChild) {
        targetNode = undefined
        break
      }
    }

    if (targetNode && currentPathSegment.length === 0) {
      this.currentNode = targetNode
      this.currentPath = path
      treeVersion.value++
      // logger.debug( `[PgnService] Navigated to path: "${path}", Ply: ${this.currentNode.ply}`      )
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

    let targetNode: PgnNode | undefined = this.rootNode
    let constructedPath = ''
    while (targetNode && targetNode.ply < ply) {
      // <<< НАЧАЛО ИЗМЕНЕНИЙ: Явно указываем тип переменной
      const mainLineChild: PgnNode | undefined = targetNode.children[0]
      // <<< КОНЕЦ ИЗМЕНЕНИЙ
      if (mainLineChild) {
        targetNode = mainLineChild
        constructedPath += targetNode.id
      } else {
        targetNode = undefined
        break
      }
    }

    if (targetNode && targetNode.ply === ply) {
      this.currentNode = targetNode
      this.currentPath = constructedPath
      treeVersion.value++
      // logger.debug(`[PgnService] Navigated to ply: ${this.currentNode.ply} on main line. Path: "${this.currentPath}"`)
      return true
    }
    const maxPly = this.currentNode.ply
    logger.warn(
      `[PgnService] Cannot navigate to ply ${ply} on main line. Max ply on main line is currently ${maxPly}.`,
    )
    return false
  }

  public navigateBackward(): boolean {
    const parentNode = this.currentNode.parent
    if (parentNode) {
      this.currentNode = parentNode
      this.currentPath = this.buildPath(this.currentNode)
      treeVersion.value++
      // logger.debug(`[PgnService] Navigated backward to ply: ${this.currentNode.ply}. Path: "${this.currentPath}"`)
      return true
    }
    return false
  }

  public navigateForward(variationIndex: number = 0): boolean {
    if (this.currentNode.children && this.currentNode.children.length > variationIndex) {
      const childNode = this.currentNode.children[variationIndex]
      if (childNode) {
        this.currentNode = childNode
        this.currentPath += childNode.id
        treeVersion.value++
        // logger.debug(`[PgnService] Navigated forward to ply: ${this.currentNode.ply} (Variation ${variationIndex}). Path: "${this.currentPath}"`)
        return true
      }
    }
    return false
  }

  public navigateToStart(): void {
    this.currentNode = this.rootNode
    this.currentPath = ''
    treeVersion.value++
    // logger.debug(`[PgnService] Navigated to start (ply 0). Path: "${this.currentPath}"`)
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
    treeVersion.value++
  }

  public promoteToVariantMainline(node: PgnNode): void {
    const parent = node.parent
    if (!parent) return

    const index = parent.children.indexOf(node)
    if (index > 0) {
      // Move to index 0
      parent.children.splice(index, 1)
      parent.children.unshift(node)
      treeVersion.value++
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
      treeVersion.value++
      logger.info(`[PgnService] Promoted node ${node.san} (ply ${node.ply}) to absolute mainline.`)
    }
  }

  public deleteNode(node: PgnNode): void {
    const parent = node.parent
    if (!parent) return // Cannot delete root

    const index = parent.children.indexOf(node)
    if (index !== -1) {
      parent.children.splice(index, 1)

      // If we deleted the current node or one of its ancestors, navigate to parent
      let N: PgnNode | undefined = this.currentNode
      let isAncestorOfCurrent = false
      while (N) {
        if (N === node) {
          isAncestorOfCurrent = true
          break
        }
        N = N.parent
      }

      if (isAncestorOfCurrent) {
        this.navigateToNode(parent)
      }

      treeVersion.value++
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
      if (data.metadata === undefined) {
        node.metadata = undefined
      } else {
        node.metadata = { ...node.metadata, ...data.metadata }
      }
    }
    treeVersion.value++
  }

  public updateCommentShapes(node: PgnNode, shapes: DrawShape[]): void {
    node.shapes = shapes
    const cleanComment = this.getCleanComment(node.comment || '')
    const tags = this.formatShapesToTags(shapes)
    node.comment = tags ? (cleanComment ? `${cleanComment} ${tags}` : tags) : cleanComment
    treeVersion.value++
  }

  public getCleanComment(comment: string): string {
    return comment
      .replace(/\[%(cal|csl)\s+[^\]]*\]/gi, '')
      .replace(/\s\s+/g, ' ')
      .trim()
  }

  private formatShapesToTags(shapes: DrawShape[]): string {
    if (shapes.length === 0) return ''

    const cals: string[] = []
    const csls: string[] = []

    for (const shape of shapes) {
      const brushChar = BRUSH_TO_LICHESS[shape.brush || 'green'] || 'G'
      if (shape.dest) {
        cals.push(`${brushChar}${shape.orig}${shape.dest}`)
      } else {
        csls.push(`${brushChar}${shape.orig}`)
      }
    }

    let result = ''
    if (cals.length > 0) result += `[%cal ${cals.join(',')}]`
    if (csls.length > 0) result += `[%csl ${csls.join(',')}]`
    return result
  }

  public toggleNodeCollapse(node: PgnNode): void {
    node.isCollapsed = !node.isCollapsed
    treeVersion.value++
  }

  public setCollapseRecursive(node: PgnNode, state: boolean): void {
    const traverse = (n: PgnNode) => {
      if (n.children.length > 1) {
        n.isCollapsed = state
      }
      n.children.forEach(traverse)
    }
    traverse(node)
    treeVersion.value++
  }

  public setCollapseGlobal(state: boolean): void {
    const traverse = (n: PgnNode) => {
      if (n.children.length > 1) {
        n.isCollapsed = state
      }
      n.children.forEach(traverse)
    }
    traverse(this.rootNode)
    treeVersion.value++
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
        // Update metadata for existing nodes in the variation
        next.metadata = { ...next.metadata, ...metadata }
      }
      current = next
    }
    treeVersion.value++
  }

  public getGameResult(): string {
    return this.gameResult
  }

  public mergeSubtree(target: PgnNode, source: PgnNode): void {
    let changed = false
    const merge = (t: PgnNode, s: PgnNode) => {
      for (const sChild of s.children) {
        let tChild = t.children.find((c) => c.uci === sChild.uci)
        if (!tChild) {
          tChild = {
            id: sChild.id,
            ply: t.ply + 1,
            fenBefore: t.fenAfter,
            fenAfter: sChild.fenAfter,
            san: sChild.san,
            uci: sChild.uci,
            parent: t,
            children: [],
            comment: sChild.comment,
            nag: sChild.nag,
            eval: sChild.eval,
          }
          t.children.push(tChild)
          changed = true
        } else {
          // Merge metadata if present in source but not in target
          if (sChild.comment && !tChild.comment) {
            tChild.comment = sChild.comment
            changed = true
          }
          if (sChild.nag && !tChild.nag) {
            tChild.nag = sChild.nag
            changed = true
          }
        }
        merge(tChild, sChild)
      }
    }

    merge(target, source)
    if (changed) {
      treeVersion.value++
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
}

export const pgnService = new PgnServiceController()

export const pgnTreeVersion = readonly(treeVersion)
