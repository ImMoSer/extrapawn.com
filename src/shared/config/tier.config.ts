export const TIER_RANK: Record<string, number> = {
  Pawn: 0,
  pawn: 0,
  VIP: 1,
  vip: 1,
  Queen: 2,
  queen: 2,
  King: 3,
  king: 3,
  administrator: 3,
}

export function getTierRank(tier: string | undefined | null): number {
  if (!tier) return 0
  if (tier in TIER_RANK) return TIER_RANK[tier]
  const lower = tier.toLowerCase()
  if (lower in TIER_RANK) return TIER_RANK[lower]
  return 0
}

export function hasFullAccess(tier: string | undefined | null): boolean {
  return getTierRank(tier) >= 1
}

export function isPawn(tier: string | undefined | null): boolean {
  return getTierRank(tier) <= 0
}
