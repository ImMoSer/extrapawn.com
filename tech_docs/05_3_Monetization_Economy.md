# 5.3 Monetization & Economy (PawnCoins & Tiers)

The platform operates on a unique "Active-First" economic model. While providing premium features, it rewards community engagement and tournament participation above all else.

## 1. The PawnCoin Currency

**PawnCoins** are the primary virtual currency used to interact with high-intensity features.

- **Costs per Unit**:
  - **Theory Endgames / Practical Chess**: 5 PawnCoins per attempt.
  - **Finish Him**: 10 PawnCoins per attempt (reflects the high computational cost of the playout engine).
  - **Study Generator**: 50 PawnCoins per generation.
- **Replenishment**:
  - **Daily Allowance**: Every user receives a daily replenishment up to their tier's limit (e.g., 150 for Pawn tier).
  - **Testing Phase**: During the current beta, accounts are replenished every hour to facilitate exhaustive testing.

## 2. Subscription Tiers (Role-Based)

The user's status is visually represented by chess piece icons, determining their daily limits and cloud storage capacity.

| Tier       | Icon | Daily PawnCoins | Access / Status             |
| :--------- | :--- | :-------------- | :-------------------------- |
| **Pawn**   | ♟    | 250             | Free / Basic                |
| **Knight** | ♞    | 500             | Club Bonus / Premium        |
| **Bishop** | ♝    | 1,000           | Club Bonus / Premium        |
| **Rook**   | ♜    | 1,500           | Paid / Elite                |
| **Queen**  | ♛    | 3,000           | Paid / Grandmaster          |
| **King**   | ♚    | LIMITLESS       | Paid / Professional Analyst |

## 3. The "Club Bonus" System (Play-to-Earn)

In a departure from traditional "Pay-to-Win" models, the platform integrates deeply with the **Lichess Club** ecosystem.

- **Automatic Upgrades**: The system analyzes a player's activity in team tournaments over the last 30 days.
- **Activity Points**: Points are awarded for participation, points scored, and games played in club events.
- **Thresholds**:
  - **Knight**: 250+ Activity Points.
  - **Bishop**: 500+ Activity Points.
- **Dynamic Recalculation**: Tiers are updated automatically every day. This ensures that the most active club members always have free access to premium tools.

## 4. Technical Infrastructure

- **Payment Processing**: Integrated via **Polar.sh** (Merchant of Record) and **Stripe** for Rook, Queen, and King tiers.
- **Storage**: King tier includes advanced cloud storage synchronization for opening studies.
- **Anti-Abuse**: Cloud-side validation of currency spending via **Supabase Functions** to prevent client-side manipulation.

---

_Back to: [Project Overview](../01_Project_Overview_Mission.md)_
