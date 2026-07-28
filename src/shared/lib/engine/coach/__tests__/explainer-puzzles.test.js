import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { Chess } from '../chess'
import { explainMove } from '../explainer.js'

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const cells = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cells.push(current)
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current)
    
    const row = {}
    headers.forEach((header, idx) => {
      row[header.trim()] = cells[idx]?.trim()
    })
    return row
  })
}

const csvPath = path.resolve(process.cwd(), 'tests/test_sacrifice_pro.csv')
const puzzles = parseCsv(csvPath)

describe('Explainer Puzzle Tests (Sacrifices)', () => {
  it('runs all puzzle tests and aggregates results', async () => {
    const successes = []
    const failures = []
    let passed = 0

    for (const puzzle of puzzles) {
      try {
        const fenBefore = puzzle.puzzle_fen
        const moves = puzzle.tactical_solution.split(' ')
        const moveUCI = moves[1] // 2nd move is the player's sacrifice
        
        const c = new Chess(fenBefore)
        const from = moveUCI.slice(0, 2)
        const to = moveUCI.slice(2, 4)
        const promotion = moveUCI[4] || 'q'
        c.move({ from, to, promotion })
        const fenAfter = c.fen()
        
        const sideToMove = fenBefore.split(' ')[1]
        const isWhite = sideToMove === 'w'
        
        // Simulate winning evaluations
        const evalBefore = 0
        const evalAfter = isWhite ? 600 : -600
        
        // Mock topMoves: Best is the sacrifice, second is way worse
        const topMoves = [
          { rank: 1, move: moveUCI, score: 600, cp: 600, pv: [moveUCI] },
          { rank: 2, move: 'a1a2', score: 0, cp: 0, pv: ['a1a2'] }
        ]
        
        const explanation = await explainMove(fenBefore, fenAfter, moveUCI, evalBefore, evalAfter, {
          topMoves
        })
        
        if (explanation.quality === 'brilliant') {
          passed++
          successes.push({
            id: puzzle.puzzle_id,
            fen: fenBefore,
            move: moveUCI,
            got: explanation.quality,
            motifs: puzzle.motifs_pg
          })
        } else {
          failures.push({
            id: puzzle.puzzle_id,
            fen: fenBefore,
            move: moveUCI,
            expected: 'brilliant',
            got: explanation.quality,
            motifs: puzzle.motifs_pg
          })
        }
      } catch (e) {
        failures.push({
          id: puzzle.puzzle_id,
          error: e.message
        })
      }
    }

    console.log(`\n=== PUZZLE TEST SUMMARY ===`)
    console.log(`Total Puzzles tested: ${puzzles.length}`)
    console.log(`Passed (Brilliant)  : ${passed}`)
    console.log(`Failed (Not Brilliant): ${failures.length}`)
    
    if (successes.length > 0) {
      console.log(`Random 10 Successes:`)
      const shuffled = [...successes].sort(() => 0.5 - Math.random())
      console.table(shuffled.slice(0, 10))
    }
    
    if (failures.length > 0) {
      console.log(`First 10 Failures:`)
      console.table(failures.slice(0, 10))
    }
    console.log(`===========================\n`)

    // We expect at least 1100 out of 1275 sacrifice puzzles to be successfully classified as brilliant
    // in the test environment (some fail due to the lack of Rust/WASM positional analyzer in tests).
    expect(passed).toBeGreaterThanOrEqual(1100)
  })
})
