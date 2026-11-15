import {
  validateBotLadderEngine,
  type AttemptResultDTO,
  type HydratedSessionDTO,
  type HydratedSessionItem,
} from '@/entities/training'
import type { SessionReportSummary } from './trainingSession.types'

export function findNextPendingIndex(items: HydratedSessionItem[], startFrom: number = 0): number {
  for (let i = startFrom; i < items.length; i++) {
    if (items[i]?.status === 'pending') return i
  }
  for (let i = 0; i < startFrom && i < items.length; i++) {
    if (items[i]?.status === 'pending') return i
  }
  return -1
}

export function computeSessionReportSummary(
  sess: HydratedSessionDTO | null,
  runningSessionTimeMs: number,
  sessionAttemptResults: Record<string, AttemptResultDTO>,
): SessionReportSummary | null {
  if (!sess) return null

  if (sess.session.mode === 'crashtest' || sess.items.length > 200) {
    const solvedCount = sess.session.solved_count
    const failedCount = sess.session.failed_count
    const totalCount = sess.session.total_count || sess.items.length
    const pendingCount = Math.max(0, totalCount - solvedCount - failedCount)
    const decidedCount = solvedCount + failedCount
    const totalTimeMs = runningSessionTimeMs
    const accuracyPercent =
      decidedCount > 0 ? Math.round((solvedCount / decidedCount) * 1000) / 10 : 0
    const avgTimeMs = decidedCount > 0 ? Math.round(totalTimeMs / decidedCount) : 0

    return {
      sessionId: sess.session.id,
      discipline: sess.session.discipline,
      mode: sess.session.mode,
      difficulty: sess.session.difficulty,
      botEngine: validateBotLadderEngine(sess.session.bot_engine),
      focusGroup: sess.session.focus_group,
      focusKey: sess.session.focus_key,
      totalCount,
      solvedCount,
      failedCount,
      pendingCount,
      accuracyPercent,
      totalTimeMs,
      avgTimeMs,
      netGlobalRatingDelta: 0,
      woodpeckerCount: 0,
      woodpeckerSolvedCount: 0,
      woodpeckerGraduatedCount: 0,
      woodpeckerQueuedCount: 0,
      items: sess.items,
    }
  }

  let solvedCount = 0
  let failedCount = 0
  let pendingCount = 0
  let totalTimeMs = 0
  let netGlobalRatingDelta = 0
  let woodpeckerCount = 0
  let woodpeckerSolvedCount = 0
  let woodpeckerGraduatedCount = 0
  let woodpeckerQueuedCount = 0

  for (const item of sess.items) {
    if (item.status === 'solved') solvedCount++
    else if (item.status === 'failed') failedCount++
    else pendingCount++

    if (typeof item.time_ms === 'number' && item.time_ms > 0) {
      totalTimeMs += item.time_ms
    }
    if (typeof item.rating_delta === 'number') {
      netGlobalRatingDelta += item.rating_delta
    }
    if (item.is_woodpecker) {
      woodpeckerCount++
      if (item.status === 'solved') woodpeckerSolvedCount++
    }

    const recorded = sessionAttemptResults[item.puzzle_id]
    if (recorded) {
      if (recorded.woodpecker.action === 'graduated') woodpeckerGraduatedCount++
      if (recorded.woodpecker.action === 'queued' || recorded.woodpecker.action === 'reset') {
        woodpeckerQueuedCount++
      }
    }
  }

  const decidedCount = solvedCount + failedCount
  const accuracyPercent =
    decidedCount > 0 ? Math.round((solvedCount / decidedCount) * 1000) / 10 : 0
  const avgTimeMs = decidedCount > 0 ? Math.round(totalTimeMs / decidedCount) : 0

  return {
    sessionId: sess.session.id,
    discipline: sess.session.discipline,
    mode: sess.session.mode,
    difficulty: sess.session.difficulty,
    botEngine: validateBotLadderEngine(sess.session.bot_engine),
    focusGroup: sess.session.focus_group,
    focusKey: sess.session.focus_key,
    totalCount: sess.items.length,
    solvedCount,
    failedCount,
    pendingCount,
    accuracyPercent,
    totalTimeMs,
    avgTimeMs,
    netGlobalRatingDelta: Math.round(netGlobalRatingDelta * 10) / 10,
    woodpeckerCount,
    woodpeckerSolvedCount,
    woodpeckerGraduatedCount,
    woodpeckerQueuedCount,
    items: sess.items,
  }
}
