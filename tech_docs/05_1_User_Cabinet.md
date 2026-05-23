# 5.1 User Cabinet (Achievement & Analytics)

The **User Cabinet** is the command center for the player's personal growth, providing a data-rich visualization of their entire chess journey. It transforms raw training data into actionable insights using advanced analytics and professional-grade charting.

## 1. Profile Identity & Economy
At the top of the cabinet, the system displays the user's standing within the platform's ecosystem:
- **Tiered Avatars**: The user's avatar reflects their subscription status, using high-quality chess icons consistent with their rank:
  - **Pawn** (Free/Standard)
  - **Knight**, **Bishop**, **Rook**, **Queen**, **King** (Premium Tiers)
- **FanCoins Dashboard**: Real-time tracking of the user's secondary currency, used for premium analysis and unlocking specialized content.

## 2. Activity Statistics
The activity engine tracks engagement across the primary training pillars: **Advantage** (Tactics) and **Theory** (Openings).
- **Timeframe Filtering**: Switch between Daily, Weekly, and Monthly views to identify trends in training volume.
- **Comparative Analysis**: Visualize which areas of the game are receiving the most focus and where intensity needs to be increased.

## 3. Tactical Fingerprint (Nightingale Rose Charts)
For the [Advantage](../04_1_Finish_Him.md) mode, the cabinet provides a "Nightingale Rose" diagram. This chart visualizes the user's tactical DNA across dozens of themes (e.g., Pins, Skewers, Trapped Pieces, X-Ray Attacks).

- **Rating vs. Accuracy**: Toggle the diagram to show either the estimated **Rating** for a specific theme or the raw **Accuracy** (success rate).
- **Mode Isolation**: Filter charts by time control (e.g., see your "Blitz Pins" vs "Bullet Pins").
- **Theme Deep-Dive**: Hover over any slice to see precise statistics: `Success / Requested` and calculation precision.

## 4. Mastery Progress (Stacked Column Charts)
Progress in structured study areas is tracked using a 3-tier difficulty system: **Novice (Green)**, **Pro (Blue)**, and **Master (Orange)**.

### Endgame Mastery (Theory & Practical)
- **Granular Classification**: Statistics are broken down by material types (Pawn Endgames, Knight Endgames, Rook & Pawn, etc.).
- **Ladder System**: Each column shows the number of positions solved at each mastery tier, providing a clear visual representation of "climbing the ladder" in endgame knowledge.

### Theory Retention
- **Retention Filtering**: Toggle between **Win** and **Draw** orientations to see how well you handle different theoretical outcomes.
- **Chapter-Based Tracking**: Mastery is calculated per opening chapter, identifying which repertoires are "Battle-Ready" and which require more study.

## Technical Foundation
The User Cabinet utilizes **Apache ECharts** for its visualization layer, ensuring high-performance rendering of complex datasets. Data is synchronized in real-time with the platform's cloud backend (**Supabase**), ensuring that your achievements are always up to date across all devices.

---
*Next Topic: [5.2 Monetization & Economy](./05_2_Economy.md)*
