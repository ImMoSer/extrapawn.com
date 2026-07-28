import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { Chess } from '../chess'
import { initSync, analyze as wasmAnalyze } from '../wasm-rs/engine_rs.js'
import { explainMove, see } from '../explainer.js'

describe('WASM & SEE Investigation Test', () => {
  it('analyzes position and outputs detailed logs', async () => {
    // 1. Initialize WASM synchronously
    const wasmPath = path.resolve(process.cwd(), 'src/shared/lib/engine/coach/wasm-rs/engine_rs_bg.wasm')
    const wasmBytes = fs.readFileSync(wasmPath)
    initSync(wasmBytes)
    console.log("WASM Initialized successfully in test!")

    const fenBefore = 'rnb2k2/4q1bQ/4r1B1/p1np4/1p1B4/8/PPP2PP1/R4K1R w - - 5 24'
    const moveUCI = 'h7h8' // Qh8+

    // 2. Call Rust WASM
    const rustResult = wasmAnalyze(fenBefore, moveUCI)
    console.log("\n=== RUST WASM ANALYZER RESULT ===")
    console.log(JSON.stringify(rustResult, null, 2))

    // 3. Chess.js analysis
    const c = new Chess(fenBefore)
    const from = moveUCI.slice(0, 2)
    const to = moveUCI.slice(2, 4)
    const movingPiece = c.get(from)
    const capturedPiece = c.get(to)
    
    // Calculate SEE value in JS
    c.move({ from, to, promotion: 'q' })
    const fenAfter = c.fen()
    
    const opponent = movingPiece.color === 'w' ? 'b' : 'w'
    const chessAfter = new Chess(fenAfter)
    const opponentGain = see(chessAfter, to, opponent)
    const PIECE_VALUE = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 20000 }
    const recovered = capturedPiece ? PIECE_VALUE[capturedPiece.type] : 0
    const netMaterial = recovered - opponentGain

    console.log("\n=== JS SEE EVALUATION ===")
    console.log("Moving Piece :", movingPiece.type, `(${movingPiece.color})`)
    console.log("Captured Piece:", capturedPiece ? capturedPiece.type : 'none')
    console.log("Opponent Gain (SEE after move) :", opponentGain)
    console.log("Recovered Material            :", recovered)
    console.log("Net Material (Recovered - Gain):", netMaterial)
    console.log("Is sacrifice by SEE?          :", netMaterial <= -100)

    // 4. Run explainMove simulating a forced mate score (9000 cp)
    // Both before and after are highly winning, which normally triggers positionDecided = true
    const evalBefore = 650  // Winning by 6.5 pawns (approx mate threat)
    const evalAfter = 10000  // Mate score
    const topMoves = [
      { rank: 1, move: moveUCI, score: 10000, cp: 10000, pv: [moveUCI] },
      { rank: 2, move: 'a1a2', score: 0, cp: 0, pv: ['a1a2'] }
    ]

    const explanation = await explainMove(fenBefore, fenAfter, moveUCI, evalBefore, evalAfter, {
      topMoves
    })

    console.log("\n=== FINAL EXPLAINER OUTPUT ===")
    console.log(JSON.stringify(explanation, null, 2))
    expect(explanation.quality).toBe('brilliant')
  })
})
