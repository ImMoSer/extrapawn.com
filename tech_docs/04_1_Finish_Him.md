# 4.1 Finish Him (Conversion Training)

"Finish Him" is a specialized training mode focused on the most critical skill for competitive players: **converting a winning advantage into a full point.**

## Concept
In many tactical trainers, the drill ends as soon as you find the first "winning" move. In **Finish Him**, finding the winning move is just the beginning. The user is presented with a position where they have a significant advantage (usually +2.0 or more) and must play it out until the game is technically over (Mate or clear resignation).

## Engine Selection (The Marketing Core)
Unlike standard trainers that force you to play against a merciless Stockfish, **Finish Him** allows you to choose your opponent. This is a key strategic advantage of our platform:
- **Stockfish 18**: For those who seek the "Grandmaster level" challenge—no mistakes, absolute precision.
- **Neural Networks (Human-like style)**: You can opt to play against engines running specialized weights that simulate human play:
  - `maia-1900.pb.gz` / `maia-2200.pb.gz`: These engines are trained to make mistakes similar to human players of respective ratings.
  - `badgyal-8.pb.gz`: An aggressive, sharp tactical opponent.
- **Why it matters**: Learning to convert against an opponent who *might* make a mistake or set a "human" trap is often more valuable for practical tournament preparation than practicing against an engine that never blunders.

## Key Features
- **Realistic Resistance**: The choice of engine determines the defensive style. Maia might offer a stubborn but fallible defense, whereas Stockfish will be mathematically precise.
- **Evaluation Requirements**: The system monitors the evaluation in real-time. If your advantage drops below a certain threshold (the "blunder threshold"), the attempt is marked as failed.
- **Progressive Difficulty**: Positions are sourced from real games where a significant advantage was either converted or lost, allowing users to learn from historical mistakes.

## Technical Implementation
- **Backend Orchestration**: The backend initializes a dedicated worker (Stockfish or LCZero with weights) for the session.
- **Move Validation**: Every move made by the user is analyzed. If the win probability (WDL) drops significantly, the user receives immediate feedback.

## Goal
To eliminate "winning position anxiety" by providing a safe environment to practice converting advantages against the strongest possible defense.

---
*Back to: [Game Modes Overview](./04_GameModes_Overview.md)*
