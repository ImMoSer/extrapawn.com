import { computed, ref } from 'vue'

export type CrashTestAnomalyType =
  | 'blunder_in_crashtest'
  | 'cache_miss_healed'
  | 'api_error'
  | 'unexpected_failure'
  | 'manual_flag'

export interface CrashTestAnomalyEntry {
  id: string
  timestamp: string
  type: CrashTestAnomalyType
  puzzle_id: string
  course_slug?: string
  batch_id?: number
  global_batch_id?: number
  index_in_session?: number
  domain?: string
  class?: string
  objective?: string
  initial_fen: string
  current_fen: string
  move_uci?: string
  user_move_number?: number
  played_moves_uci: string[]
  game_moves_uci?: string[]
  game_moves_san?: string[]
  game_pgn?: string
  canonical_solution?: string
  crashtest_engine?: string
  blunderspy_state?: string
  blunderspy_next_state?: string
  blunderspy_source?: string
  blunderspy_reason?: string
  best_move_uci?: string
  allowed_moves?: string[]
  eval?: {
    cp?: number | null
    mate?: number | null
    wdl?: number[] | null
  } | null
  error_message?: string
}

export interface CrashTestReportData {
  report_version: '1.0'
  started_at: string
  updated_at: string
  total_puzzles_in_dump: number
  processed_count: number
  solved_count: number
  failed_count: number
  cache_hits_count: number
  cache_misses_healed_count: number
  api_errors_count: number
  flagged_count: number
  last_puzzle_id: string | null
  last_index: number
  anomalies: CrashTestAnomalyEntry[]
}

const STORAGE_KEY = 'extrapawn_crashtest_report_v1'
const MAX_ANOMALIES = 3000

function createDefaultReport(totalInDump: number = 6147): CrashTestReportData {
  const now = new Date().toISOString()
  return {
    report_version: '1.0',
    started_at: now,
    updated_at: now,
    total_puzzles_in_dump: totalInDump,
    processed_count: 0,
    solved_count: 0,
    failed_count: 0,
    cache_hits_count: 0,
    cache_misses_healed_count: 0,
    api_errors_count: 0,
    flagged_count: 0,
    last_puzzle_id: null,
    last_index: 0,
    anomalies: [],
  }
}

function loadFromStorage(): CrashTestReportData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultReport()
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultReport()
    const parsed = JSON.parse(raw) as Partial<CrashTestReportData>
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.anomalies)) {
      return createDefaultReport()
    }
    return {
      ...createDefaultReport(parsed.total_puzzles_in_dump ?? 6147),
      ...parsed,
      anomalies: parsed.anomalies,
    }
  } catch {
    return createDefaultReport()
  }
}

const reportState = ref<CrashTestReportData>(loadFromStorage())
let persistTimerId: ReturnType<typeof setTimeout> | null = null

function persistToStorageImmediate(): void {
  if (persistTimerId !== null) {
    clearTimeout(persistTimerId)
    persistTimerId = null
  }
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    reportState.value.updated_at = new Date().toISOString()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reportState.value))
  } catch (err) {
    // If localStorage quota is tight, trim oldest anomalies and retry
    if (reportState.value.anomalies.length > 500) {
      reportState.value.anomalies = reportState.value.anomalies.slice(-500)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reportState.value))
      } catch {
        // Ignore storage error
      }
    }
    console.warn('[CrashTestReportLogger] Failed to persist report to localStorage:', err)
  }
}

function schedulePersistToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  reportState.value.updated_at = new Date().toISOString()
  if (persistTimerId !== null) return
  persistTimerId = setTimeout(() => {
    persistTimerId = null
    persistToStorageImmediate()
  }, 250)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (persistTimerId !== null) {
      persistToStorageImmediate()
    }
  })
}

export function resetCrashTestReport(totalInDump: number = 6147): void {
  reportState.value = createDefaultReport(totalInDump)
  persistToStorageImmediate()
}

export function setCrashTestTotalPuzzles(totalInDump: number): void {
  if (totalInDump > 0 && reportState.value.total_puzzles_in_dump !== totalInDump) {
    reportState.value.total_puzzles_in_dump = totalInDump
    schedulePersistToStorage()
  }
}

export function recordCrashTestStepHit(source: 'cache' | 'engine_healed' | string): void {
  if (source === 'engine_healed') {
    reportState.value.cache_misses_healed_count += 1
  } else {
    reportState.value.cache_hits_count += 1
  }
  schedulePersistToStorage()
}

export function recordCrashTestPuzzleOutcome(
  puzzleId: string,
  indexInSession: number,
  solved: boolean,
): void {
  reportState.value.processed_count += 1
  if (solved) {
    reportState.value.solved_count += 1
  } else {
    reportState.value.failed_count += 1
  }
  reportState.value.last_puzzle_id = puzzleId
  reportState.value.last_index = indexInSession
  schedulePersistToStorage()
}

export function recordCrashTestAnomaly(
  entry: Omit<CrashTestAnomalyEntry, 'id' | 'timestamp'>,
): void {
  const now = new Date().toISOString()
  const fullEntry: CrashTestAnomalyEntry = {
    ...entry,
    id: `${entry.puzzle_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
  }

  if (entry.type === 'api_error') {
    reportState.value.api_errors_count += 1
  } else if (entry.type === 'manual_flag') {
    reportState.value.flagged_count += 1
  }

  if (reportState.value.anomalies.length >= MAX_ANOMALIES) {
    reportState.value.anomalies.shift()
  }
  reportState.value.anomalies.push(fullEntry)
  persistToStorageImmediate()
}

export function downloadCrashTestReport(filename: string = 'craschTestReport.json'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  persistToStorageImmediate()
  const payload = JSON.stringify(reportState.value, null, 2)
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function useCrashTestReport() {
  const anomaliesCount = computed(() => reportState.value.anomalies.length)
  const hasReportData = computed(
    () =>
      reportState.value.processed_count > 0 ||
      reportState.value.anomalies.length > 0 ||
      reportState.value.cache_hits_count > 0,
  )

  return {
    report: reportState,
    anomaliesCount,
    hasReportData,
    resetCrashTestReport,
    downloadCrashTestReport,
  }
}

