# 4.6 Study! (The Grandmaster's Studio)

**Study!** is the analytical heart of the platform. It is a high-performance environment designed for professional opening preparation and tactical deep-dives, combining a flexible study tree with the deep theoretical intelligence of **MozerBook**.

## 1. Study Hub: Knowledge Management
The **Study Manager** acts as the central repository for your chess knowledge, supporting both local creation and external synchronization:
- **Lichess Integration**: Seamlessly link your Lichess account to import your private opening studies. You can also access curated **Community Studies** provided by the `@ExtraPawnCOM` profile.
- **Manual Construction**: Build your own preparation from scratch, move-by-move.
- **PGN Intelligence**: Import external PGN files or export your current study lines for use in other software.
- **AI-Powered Generation**: The Repertoire Generator can automatically build entire trees based on Masters' statistics and selectable playstyles (GrossMaster, Master, Hustler).

## 2. Professional Tree Navigation
The user interface is optimized for managing vast amounts of theoretical variations:
- **Recursive Navigation**: An infinite-depth tree structure that tracks every candidate move and sideline.
- **Visual Hierarchy**: Mainlines and variations are visually distinguished by font size and color coding, making complex structures readable at a glance.
- **Candidate Moves Panel**: A dedicated grid at the bottom of the tree for rapid switching between variations, prioritizing the "Mainline" response.
- **Branch Management**: Elevate sidelines to mainlines, add annotations (NAGs like `!!`, `??`), or prune unwanted branches instantly.

## 3. MozerBook: The Theoretical Compass
Linked directly to the Study Tree, the **MozerBook** panel provides real-time validation against the best known theory.
- **Multi-Source Data**: Toggle between **Lichess Masters** (Elite play), **Lichess Ratings** (Specific Elo-level trends), and the curated **MozerBook Green** database.
- **Winrate Analysis**: Visual bars representing success rates for both sides, helping you choose the most practical lines.
- **WikiBooks Integration**: A high-impact panel that pulls encyclopedic data directly from the "Chess Opening Theory" project for strategic context.

## 4. Advanced Training Modes
Preparation is useless without retention. The Study module offers two elite training modes:

### A. Reply Training (SRS & "Weed Pressure")
This mode completes the "Memorization Loop" using a sophisticated **Spaced Repetition System (SRS)** logic:
- **Weed Pressure Logic**: The system treats forgotten or unplayed lines as "weeds." New lines start with 100% weed pressure, and pressure grows over time (approx. 14% per day) if not practiced.
- **Targeted Practice**: The training bot analyzes your study tree and automatically steers the session toward the "worst weed patches"—the branches where your mastery is lowest or your memory is fuzziest.
- **Mastery Tracking**: Successes and attempts are tracked for every terminal node, ensuring you focus on the lines that matter most.

### B. Study Speedrun
A gamified, high-intensity way to drill your preparation:
- **Against the Clock**: Play through your selected study chapters against a bot as fast as possible.
- **Objective Driven**: You must win (or reach the target result, e.g., a draw in theoretical endgames) to proceed to the next chapter.
- **Persistence**: If you fail a line, the system resets the chapter instantly, forcing you to find the correct solution under pressure.

## 5. Technical Architecture
- **Engine Synergy**: Uses Stockfish for live validation and evaluation during study sessions.
- **Hybrid Storage**: Full synchronization via **Supabase**. Studies are stored locally in the browser (via **Dexie**) for zero-latency navigation and backed up to the cloud for multi-device access.
- **High Capacity**: Capable of rendering and navigating trees with 10,000+ nodes with sub-second performance.

## Goal
To provide a "Studio" experience where the player isn't just a consumer of theory, but an architect of it.

---
*Back to: [Game Modes Overview](./04_GameModes_Overview.md) | Next Chapter: [5. User Ecosystem & Economy](./05_User_Ecosystem_Economy.md)*
