import { Chess } from 'chess.js'
import { encodeFenHistory } from './encoding'
import { runInference } from './inference'
import { POLICY_INDEX_MAP } from './policyIndex'
import { flipUci } from './encoding'

// --- MCTS Tree Node ---

export interface MCTSNode {
  /** UCI move that led to this node (null for root) */
  move: string | null
  /** Parent node */
  parent: MCTSNode | null
  /** Child nodes, keyed by UCI move */
  children: Map<string, MCTSNode>
  /** Prior probability from the policy network */
  prior: number
  /** Visit count */
  visits: number
  /** Total value accumulated (from this node's perspective) */
  totalValue: number
  /** WDL accumulated [win, draw, loss] from this node's perspective */
  wdlSum: [number, number, number]
  /** Whether this node has been expanded (inference run) */
  expanded: boolean
  /** Whether this is a terminal node (game over) */
  terminal: boolean
  /** Terminal value if applicable (-1 loss, 0 draw, 1 win, from side-to-move) */
  terminalValue: number
}

function createNode(move: string | null, parent: MCTSNode | null, prior: number): MCTSNode {
  return {
    move,
    parent,
    children: new Map(),
    prior,
    visits: 0,
    totalValue: 0,
    wdlSum: [0, 0, 0],
    expanded: false,
    terminal: false,
    terminalValue: 0,
  }
}

// --- PUCT Selection ---

const CPUCT = 2.5 // Exploration constant (lc0 default range is ~2.5)

function qValue(node: MCTSNode): number {
  if (node.visits === 0) return 0
  return node.totalValue / node.visits
}

function puctScore(child: MCTSNode, parentVisits: number): number {
  // Negate Q: child's value is from the opponent's perspective,
  // but the parent wants moves that are BAD for the opponent
  const q = -qValue(child)
  const u = CPUCT * child.prior * Math.sqrt(parentVisits) / (1 + child.visits)
  return q + u
}

function selectChild(node: MCTSNode): MCTSNode {
  let bestChild: MCTSNode | null = null
  let bestScore = -Infinity

  for (const child of node.children.values()) {
    const score = puctScore(child, node.visits)
    if (score > bestScore) {
      bestScore = score
      bestChild = child
    }
  }

  return bestChild!
}

// --- Policy decoding (extract priors for legal moves) ---

function getPriors(
  policyLogits: Float32Array,
  legalMoves: string[],
  isBlack: boolean,
): Map<string, number> {
  const moveLogits: { move: string; logit: number }[] = []

  for (const uci of legalMoves) {
    const canonicalMove = isBlack ? flipUci(uci) : uci
    let index = POLICY_INDEX_MAP.get(canonicalMove)

    // Knight promotion: strip 'n' suffix
    if (index === undefined && canonicalMove.endsWith('n')) {
      index = POLICY_INDEX_MAP.get(canonicalMove.slice(0, 4))
    }

    if (index === undefined) continue
    moveLogits.push({ move: uci, logit: policyLogits[index] })
  }

  // Softmax to get probabilities
  const maxLogit = Math.max(...moveLogits.map((m) => m.logit))
  const exps = moveLogits.map((m) => Math.exp(m.logit - maxLogit))
  const sumExp = exps.reduce((a, b) => a + b, 0)

  const priors = new Map<string, number>()
  moveLogits.forEach((m, i) => {
    priors.set(m.move, exps[i] / sumExp)
  })

  return priors
}

// --- Helper: convert chess.js move to UCI ---

function moveToUCI(move: { from: string; to: string; promotion?: string }): string {
  return move.from + move.to + (move.promotion ?? '')
}

// --- MCTS Search ---

export interface MCTSResult {
  /** Best move in UCI format */
  bestMove: string
  /** Visit count of the best move */
  bestVisits: number
  /** Total nodes searched */
  totalNodes: number
  /** Top moves ranked by visit count */
  topMoves: { move: string; visits: number; q: number; prior: number }[]
  /** WDL from the root (engine's perspective) */
  wdl: [number, number, number]
}

export interface MCTSProgress {
  nodes: number
  totalNodes: number
}

/**
 * Run MCTS search from the given position.
 *
 * @param fen - Current position FEN
 * @param history - Full FEN history (for encoding, most recent last)
 * @param nodeLimit - Number of nodes to search
 * @param onProgress - Optional callback for progress updates
 * @returns Best move and search statistics
 */
export async function mctsSearch(
  fen: string,
  history: string[],
  nodeLimit: number,
  timeLimitMs?: number,
  onProgress?: (progress: MCTSProgress) => void,
): Promise<MCTSResult> {
  const rootGame = new Chess(fen)
  const isBlack = rootGame.turn() === 'b'

  // Create root and expand it
  const root = createNode(null, null, 1.0)
  await expandNode(root, rootGame, history, isBlack)

  if (root.children.size === 0) {
    throw new Error('No legal moves from root position')
  }

  // If only one legal move, return immediately
  if (root.children.size === 1) {
    const [move, child] = root.children.entries().next().value!
    return {
      bestMove: move,
      bestVisits: 1,
      totalNodes: 1,
      topMoves: [{ move, visits: 1, q: 0, prior: child.prior }],
      wdl: root.wdlSum.map((v) => v / Math.max(root.visits, 1)) as [number, number, number],
    }
  }

  // Main search loop
  const deadline = timeLimitMs && timeLimitMs > 0 ? Date.now() + timeLimitMs : null
  let nodesSearched = 1 // root expansion counted as 1

  for (let i = 1; i < nodeLimit; i++) {
    if (deadline && Date.now() >= deadline) break
    // Selection: walk down the tree
    let node = root
    const game = new Chess(fen)
    const gameHistory = [...history]

    while (node.expanded && !node.terminal && node.children.size > 0) {
      node = selectChild(node)
      const moveData = uciToMove(node.move!)
      game.move(moveData)
      gameHistory.push(game.fen())
    }

    // Expansion + evaluation
    if (!node.terminal) {
      const nodeIsBlack = game.turn() === 'b'
      await expandNode(node, game, gameHistory, nodeIsBlack)
    }

    // Get value to backpropagate
    let value: number
    let wdl: [number, number, number]
    if (node.terminal) {
      value = node.terminalValue
      // Terminal WDL
      if (value > 0) wdl = [1, 0, 0]
      else if (value < 0) wdl = [0, 0, 1]
      else wdl = [0, 1, 0]
    } else {
      // Use the value from expansion (stored during expandNode)
      value = node.visits > 0 ? node.totalValue / node.visits : 0
      wdl = node.visits > 0
        ? node.wdlSum.map((v) => v / node.visits) as [number, number, number]
        : [0.5, 0, 0.5]
    }

    // Backpropagation: walk back to root, flipping value at each level
    backpropagate(node, value, wdl)

    nodesSearched = i + 1

    // Progress reporting
    if (onProgress && (i % 10 === 0 || i === nodeLimit - 1)) {
      onProgress({ nodes: nodesSearched, totalNodes: nodeLimit })
    }
  }

  // Select best move by visit count
  const sortedMoves = [...root.children.entries()]
    .map(([move, child]) => ({
      move,
      visits: child.visits,
      q: -qValue(child), // Negate: report Q from root's perspective
      prior: child.prior,
    }))
    .sort((a, b) => b.visits - a.visits)

  const rootWdl: [number, number, number] = root.visits > 0
    ? [root.wdlSum[0] / root.visits, root.wdlSum[1] / root.visits, root.wdlSum[2] / root.visits]
    : [0.5, 0, 0.5]

  return {
    bestMove: sortedMoves[0].move,
    bestVisits: sortedMoves[0].visits,
    totalNodes: nodesSearched,
    topMoves: sortedMoves.slice(0, 5),
    wdl: rootWdl,
  }
}

// --- Expansion ---

async function expandNode(
  node: MCTSNode,
  game: Chess,
  history: string[],
  isBlack: boolean,
): Promise<void> {
  // Check for terminal states
  if (game.isGameOver()) {
    node.terminal = true
    node.expanded = true
    if (game.isCheckmate()) {
      // The side that just got checkmated loses.
      // From the side-to-move's perspective (who is checkmated), this is a loss.
      node.terminalValue = -1
    } else {
      // Draw
      node.terminalValue = 0
    }
    // Backprop will handle this value
    node.visits = 1
    node.totalValue = node.terminalValue
    if (node.terminalValue > 0) node.wdlSum = [1, 0, 0]
    else if (node.terminalValue < 0) node.wdlSum = [0, 0, 1]
    else node.wdlSum = [0, 1, 0]
    return
  }

  // Run inference
  const inputTensor = encodeFenHistory(history)
  const result = await runInference(inputTensor)

  // Get legal moves
  const verboseMoves = game.moves({ verbose: true })
  const legalMoves = verboseMoves.map(moveToUCI)

  // Get priors from policy
  const priors = getPriors(result.policy, legalMoves, isBlack)

  // Create child nodes
  for (const uci of legalMoves) {
    const prior = priors.get(uci) ?? (1 / legalMoves.length)
    node.children.set(uci, createNode(uci, node, prior))
  }

  node.expanded = true

  // Store the evaluation at this node
  // Value from WDL: win - loss (from the network's perspective = side-to-move)
  const value = result.wdl[0] - result.wdl[2]
  node.visits = 1
  node.totalValue = value
  node.wdlSum = [...result.wdl]
}

// --- Backpropagation ---

function backpropagate(
  node: MCTSNode,
  value: number,
  wdl: [number, number, number],
): void {
  // Walk from the expanded node back to root.
  // Skip the node itself (already has its value from expansion).
  let current = node.parent
  let v = -value // Flip because parent is the opponent
  let currentWdl: [number, number, number] = [wdl[2], wdl[1], wdl[0]] // Flip W and L

  while (current !== null) {
    current.visits += 1
    current.totalValue += v
    current.wdlSum[0] += currentWdl[0]
    current.wdlSum[1] += currentWdl[1]
    current.wdlSum[2] += currentWdl[2]

    v = -v
    currentWdl = [currentWdl[2], currentWdl[1], currentWdl[0]]
    current = current.parent
  }
}

// --- UCI move parsing ---

function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci[4] : undefined
  return { from, to, promotion }
}
