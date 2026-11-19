import type { PgnNode } from './pgnTypes'

export function disposePgnTree(root: PgnNode | undefined): void {
  if (!root) return
  const stack: PgnNode[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    for (const child of node.children) {
      stack.push(child)
    }
    node.children.length = 0
    node.parent = undefined
    node.shapes = undefined
    node.metadata = undefined
  }
}

export function buildPathFromNode(node: PgnNode): string {
  let path = ''
  let current: PgnNode | undefined = node
  while (current && current.parent) {
    path = current.id + path
    current = current.parent
  }
  return path
}

export function collectPathNodes(currentNode: PgnNode): PgnNode[] {
  const pathNodes: PgnNode[] = []
  let current: PgnNode | undefined = currentNode
  while (current && current.parent) {
    pathNodes.unshift(current)
    current = current.parent
  }
  return pathNodes
}

export function findNodeByPath(rootNode: PgnNode, path: string): PgnNode | null {
  let targetNode: PgnNode | undefined = rootNode
  let remaining = path

  while (remaining.length > 0 && targetNode) {
    let foundChild = false
    for (const child of targetNode.children) {
      if (remaining.startsWith(child.id)) {
        targetNode = child
        remaining = remaining.substring(child.id.length)
        foundChild = true
        break
      }
    }
    if (!foundChild) {
      return null
    }
  }

  return targetNode && remaining.length === 0 ? targetNode : null
}

export function findMainlineNodeAtPly(
  rootNode: PgnNode,
  ply: number,
): { node: PgnNode; path: string } | null {
  let targetNode: PgnNode | undefined = rootNode
  let constructedPath = ''
  while (targetNode && targetNode.ply < ply) {
    const mainLineChild: PgnNode | undefined = targetNode.children[0]
    if (mainLineChild) {
      targetNode = mainLineChild
      constructedPath += targetNode.id
    } else {
      return null
    }
  }
  if (targetNode && targetNode.ply === ply) {
    return { node: targetNode, path: constructedPath }
  }
  return null
}

export function isAncestorNode(candidateAncestor: PgnNode, node: PgnNode): boolean {
  let current: PgnNode | undefined = node
  while (current) {
    if (current === candidateAncestor) return true
    current = current.parent
  }
  return false
}

export function setPgnCollapseRecursive(node: PgnNode, state: boolean): void {
  const traverse = (n: PgnNode) => {
    if (n.children.length > 1) {
      n.isCollapsed = state
    }
    n.children.forEach(traverse)
  }
  traverse(node)
}

export function mergePgnSubtree(target: PgnNode, source: PgnNode): boolean {
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
  return changed
}
