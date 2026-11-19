import { MAX_SANITY_ATTEMPTS, type HydratedSessionItem } from '@/entities/training'

export function isSessionItemHydrated(item: HydratedSessionItem | null | undefined): boolean {
  if (!item || !item.puzzle_id?.trim()) return false
  return Boolean(item.tactical || item.endgame || item.course_puzzle)
}

export function isItemVerdictFinalized(item: HydratedSessionItem | null | undefined): boolean {
  if (!item) return false
  return item.status === 'solved' || item.status === 'failed'
}

export function canAnalyzeSessionItem(item: HydratedSessionItem | null | undefined): boolean {
  return isItemVerdictFinalized(item) && isSessionItemHydrated(item)
}

export function canPracticeReplayItem(item: HydratedSessionItem | null | undefined): boolean {
  return isItemVerdictFinalized(item) && isSessionItemHydrated(item)
}

export function getItemAttemptsUsed(item: HydratedSessionItem | null | undefined): number {
  if (!item || typeof item.attempts_used !== 'number' || !Number.isFinite(item.attempts_used)) {
    return 0
  }
  return Math.max(0, Math.min(MAX_SANITY_ATTEMPTS, Math.trunc(item.attempts_used)))
}

export function getCurrentAttemptNumber(item: HydratedSessionItem | null | undefined): number {
  if (isItemVerdictFinalized(item)) {
    return Math.max(1, getItemAttemptsUsed(item))
  }
  return Math.min(MAX_SANITY_ATTEMPTS, getItemAttemptsUsed(item) + 1)
}

export function canRestartDuringPlay(
  item: HydratedSessionItem | null | undefined,
  userMovesPlayed: number,
): boolean {
  if (!item || isItemVerdictFinalized(item)) return false
  return userMovesPlayed > 0 && getItemAttemptsUsed(item) < MAX_SANITY_ATTEMPTS - 1
}

export function canRestartFromRetryPrompt(item: HydratedSessionItem | null | undefined): boolean {
  if (!item || isItemVerdictFinalized(item)) return false
  const used = getItemAttemptsUsed(item)
  return used > 0 && used < MAX_SANITY_ATTEMPTS
}
