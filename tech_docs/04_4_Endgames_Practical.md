# 4.4 Practical Chess (Endgames)

**Practical Chess** bridge the gap between static puzzles and real-game scenarios. Unlike theoretical endgames, these positions are messy, complex, and require sharp calculation and intuition.

## Concept
The primary focus of this mode is **Conversion on Demand**. Every position in this mode is a "Play to Win" scenario. There are no draws here—you must navigate the complexities of a real-game endgame and bring home the full point against high-level resistance.

## Source & Accuracy
All positions in this mode are sourced from **real human games** (via the [Lichess Evaluation Database](https://database.lichess.org/#evals)). 
- **Verfied Content**: Every position has been algorithmically classified and verified by engines to ensure it is actually winning but requires precise execution.
- **Realistic Geometry**: Unlike artificial studies, these positions contain the typical "noise" and placement patterns found in actual over-the-board play.

## The "YOU MOVE!" Feature (Choose Your Side)
One of the most innovative features of the platform is the **"YOU MOVE!"** setup:
1. **Side Selection**: The system presents a complex position, and the user must first decide which side they want to play for (White or Black).
2. **First Move Responsibility**: After choosing a side, the user must find and execute the first move.
3. **Training Value**: This simulates the most critical moment in a game—assessing who is better and finding the path forward without a pre-defined prompt.

## Setup Options
- **Difficulty**: Novice, Pro, and Master levels.
- **Sparring Partners**: Highly recommended to play against **Maia (1900/2200)** or **BadGyal 8** to experience realistic defensive blunders and "human" stubbornness. **Stockfish 18** is available for those seeking a flawless opponent.

## Material Categories
The trainer allows targeting specific material imbalances:
- **Extra Pawn**: Learning to convert a single pawn advantage.
- **Exchange**: Converting the exchange (e.g., Rook vs Knight/Bishop).
- **Major/Minor Piece Endgames**: Specific categories for Rooks, Queens, Bishops, Knights, and Knight vs Bishop scenarios.

## Technical Implementation
- **Dynamic Color Flipping**: The engine and UI automatically adjust to the user's color choice in "YOU MOVE!" mode.
- **Real-time Evaluation**: Backend monitors if the user maintains the winning advantage. Any significant evaluation drop results in a failed attempt.

---
*Back to: [Game Modes Overview](./04_GameModes_Overview.md) | Next Section: [4.5 Opening Sparring](./04_6_Open_Sparring.md)*
