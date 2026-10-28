import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

export type CoachDrawShape = DrawShape & {
  nag?: string
  customNag?: string
  stepBadge?: string
}

const VALID_BRUSHES = [
  'green',
  'red',
  'blue',
  'yellow',
  'orange',
  'purple',
  'cyan',
  'pink',
  'brown',
  'gray',
  'bestmove',
  'enginePlan',
  'paleBlue',
  'paleGreen',
] as const

const COLOR_PRIORITY: Record<string, number> = {
  coachgray: 0,
  coachbrown: 1,
  coachyellow: 2,
  coachgreen: 3,
  coachcyan: 4,
  coachblue: 5,
  coachpurple: 6,
  coachpink: 7,
  coachorange: 8,
  coachred: 9,
  bestmove: 10,
  enginePlan: 10,
}

/**
 * Visualizer command parser for Chessground board shapes.
 * Parses visual commands strings (e.g. "[mark:e4:green;arrow:e2->e4:green]") into Chessground DrawShapes.
 */
export function parseVisualCommands(actionStr: string): CoachDrawShape[] {
  if (!actionStr) return []
  const subActions = actionStr.split(';')
  const allShapes: CoachDrawShape[] = []

  for (const sub of subActions) {
    if (!sub.trim()) continue

    const cleanSub = sub.replace(/[[\]]/g, '').trim()
    const parts = cleanSub.split(':')
    const cmd = parts[0]?.trim()
    const data = parts[1]?.trim()
    let brush = parts[2]?.trim() || 'green'

    if (!(VALID_BRUSHES as readonly string[]).includes(brush)) {
      brush = 'green'
    }

    const coachBrush =
      brush === 'bestmove' || brush === 'enginePlan' ? 'enginePlan' : `coach${brush}`

    if (cmd === 'clear') {
      return []
    }

    if (!data) continue

    if (cmd === 'arrow' || cmd === 'route' || cmd === 'root') {
      const squares = data.split('->')
      for (let i = 0; i < squares.length - 1; i++) {
        const orig = squares[i]?.trim()
        const dest = squares[i + 1]?.trim()

        if (orig && dest && orig.length === 2 && dest.length === 2) {
          allShapes.push({
            orig: orig as Key,
            dest: dest as Key,
            brush: coachBrush,
            modifiers: { lineWidth: 3 },
          })
        }
      }
    } else if (cmd === 'mark') {
      const squares = data.split(',')
      squares.forEach((sq) => {
        const cleanSq = sq.trim()
        if (cleanSq && cleanSq.length === 2) {
          allShapes.push({
            orig: cleanSq as Key,
            brush: coachBrush,
          })
        }
      })
    } else if (cmd === 'nag') {
      const squares = data.split(',')
      const quality = parts[2]?.trim() || 'brilliant'
      squares.forEach((sq) => {
        const cleanSq = sq.trim()
        if (cleanSq && cleanSq.length === 2) {
          allShapes.push({
            orig: cleanSq as Key,
            nag: quality,
          })
        }
      })
    } else if (cmd === 'step_badge' || cmd === 'badge') {
      const squares = data.split(',')
      const label = parts[2]?.trim() || 'A1'
      const bColor = parts[3]?.trim() || coachBrush
      squares.forEach((sq) => {
        const cleanSq = sq.trim()
        if (cleanSq && cleanSq.length === 2) {
          allShapes.push({
            orig: cleanSq as Key,
            stepBadge: label,
            brush: bColor,
          })
        }
      })
    }
  }

  allShapes.sort((a, b) => {
    const pA = COLOR_PRIORITY[a.brush || ''] || 0
    const pB = COLOR_PRIORITY[b.brush || ''] || 0
    return pA - pB
  })

  return allShapes
}

