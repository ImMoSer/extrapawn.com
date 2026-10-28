import { useAuthStore } from './auth.store'
import { applyThemeStyle } from '../config/theme.config'
import { apiClient } from '@/shared/api/client'
import { changeLang } from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import { registerVolumeProvider } from '@/shared/lib/sound'
import { AVAILABLE_ENGINES, type EngineId } from '@/shared/types/api.types'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const LOCAL_STORAGE_KEY = 'user_preferences_backup_v1'
const LEGACY_COACH_STORAGE_KEY = 'extrapawn_coach_settings'

export interface ThemePreferences {
  board: string
  pieces: string
  animationDuration: number
}

export interface EnginePreferences {
  useServerCoach: boolean
  depth: number
  multipv: number
}

export interface AudioPreferences {
  boardVolume: number
}

export interface GameplayPreferences {
  language: 'en' | 'de' | 'ru'
  botEngine: string
  global_crashtest: boolean
}

export interface DelayPreferences {
  initialBotDelayMs: number
  botDelayMs: number
  nextPuzzleDelayMs: number
  restartDelayMs: number
  crashtestDelayMs: number
}

export interface PuzzlePreferences {
  autoNext: boolean
}

export interface AnalysisPreferences {
  multiPv: number
  searchTime: number
  showArrows: boolean
  engineVersion: 'lite' | 'full'
}

export interface CoachVisualLayersPreferences {
  lastMoveNag: boolean
  candidateArrow: boolean
  tacticalPlans: boolean
}

export interface CoachPreferences {
  coachSpy: boolean
  autoTakeback: boolean
  autoTakebackDelay: number
  showVisuals: boolean
  visualLayers: CoachVisualLayersPreferences
}

export interface UserPreferencesDto {
  theme: ThemePreferences
  engine: EnginePreferences
  audio: AudioPreferences
  gameplay: GameplayPreferences
  delays: DelayPreferences
  puzzle: PuzzlePreferences
  analysis: AnalysisPreferences
  coach: CoachPreferences
}

export interface BackendUserPreferencesDto {
  theme: ThemePreferences
  engine: EnginePreferences
  audio: AudioPreferences
  gameplay: Omit<GameplayPreferences, 'global_crashtest'> & { global_autoplay?: boolean }
  delays: Omit<DelayPreferences, 'crashtestDelayMs'> & { autoPlayDelayMs?: number }
  puzzle?: PuzzlePreferences
  analysis?: AnalysisPreferences
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export const DEFAULT_USER_PREFERENCES: UserPreferencesDto = {
  theme: {
    board: 'wood4',
    pieces: 'alpha',
    animationDuration: 200,
  },
  engine: {
    useServerCoach: true,
    depth: 12,
    multipv: 5,
  },
  audio: {
    boardVolume: 1.0,
  },
  gameplay: {
    language: 'en',
    botEngine: 'maia-1500',
    global_crashtest: false,
  },
  delays: {
    initialBotDelayMs: 500,
    botDelayMs: 250,
    nextPuzzleDelayMs: 2000,
    restartDelayMs: 500,
    crashtestDelayMs: 100,
  },
  puzzle: {
    autoNext: false,
  },
  analysis: {
    multiPv: 3,
    searchTime: 5,
    showArrows: true,
    engineVersion: 'lite',
  },
  coach: {
    coachSpy: true,
    autoTakeback: true,
    autoTakebackDelay: 1000,
    showVisuals: true,
    visualLayers: {
      lastMoveNag: true,
      candidateArrow: true,
      tacticalPlans: true,
    },
  },
}

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }
  for (const key of Object.keys(source) as Array<keyof T>) {
    const val = source[key]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(
        (result[key] || {}) as Record<string, unknown>,
        val as DeepPartial<Record<string, unknown>>,
      ) as T[keyof T]
    } else if (val !== undefined) {
      result[key] = val as T[keyof T]
    }
  }
  return result
}

export const usePreferencesStore = defineStore('preferences', () => {
  const authStore = useAuthStore()
  const rawPreferences = ref<UserPreferencesDto>({ ...DEFAULT_USER_PREFERENCES })

  const isMo3ep = computed(() => authStore.isMo3ep)

  const preferences = computed<UserPreferencesDto>({
    get: () => {
      if (!isMo3ep.value) {
        return {
          ...rawPreferences.value,
          delays: {
            initialBotDelayMs: 500,
            botDelayMs: rawPreferences.value.delays.botDelayMs,
            nextPuzzleDelayMs: 500,
            restartDelayMs: 500,
            crashtestDelayMs: 100,
          },
        }
      }
      if (rawPreferences.value.gameplay.global_crashtest) {
        const speed = rawPreferences.value.delays.crashtestDelayMs
        return {
          ...rawPreferences.value,
          delays: {
            initialBotDelayMs: speed,
            botDelayMs: speed,
            nextPuzzleDelayMs: speed,
            restartDelayMs: speed,
            crashtestDelayMs: speed,
          },
        }
      }
      return rawPreferences.value
    },
    set: (val) => {
      rawPreferences.value = val
    },
  })

  const isLoaded = ref(false)

  registerVolumeProvider({
    getVolume: () => preferences.value.audio.boardVolume,
    setVolume: (vol) => updatePreferences({ audio: { boardVolume: vol } }),
  })

  let saveTimeout: number | null = null

  function loadLocal(): UserPreferencesDto {
    let merged = { ...DEFAULT_USER_PREFERENCES }
    try {
      const backup = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (backup) {
        const parsed = JSON.parse(backup)
        merged = deepMerge(merged, parsed)
      }
      // Migrate legacy coach settings if present
      const legacyCoach = localStorage.getItem(LEGACY_COACH_STORAGE_KEY)
      if (legacyCoach) {
        const parsedCoach = JSON.parse(legacyCoach)
        merged = deepMerge(merged, { coach: parsedCoach })
        localStorage.removeItem(LEGACY_COACH_STORAGE_KEY)
      }
    } catch (err) {
      logger.error('[PreferencesStore] Failed to parse local preferences:', err)
    }
    return merged
  }

  function saveLocal() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rawPreferences.value))
    } catch (err) {
      logger.error('[PreferencesStore] Failed to save local preferences:', err)
    }
  }

  async function fetchBackend() {
    if (!authStore.isAuthenticated) {
      return
    }
    try {
      const rawBackendPrefs = await apiClient<BackendUserPreferencesDto>('/users/me/preferences')

      const mappedPrefs: DeepPartial<UserPreferencesDto> = {
        theme: rawBackendPrefs.theme,
        engine: rawBackendPrefs.engine,
        audio: rawBackendPrefs.audio,
        gameplay: {
          language:
            rawBackendPrefs.gameplay?.language ?? DEFAULT_USER_PREFERENCES.gameplay.language,
          botEngine:
            rawBackendPrefs.gameplay?.botEngine ?? DEFAULT_USER_PREFERENCES.gameplay.botEngine,
          global_crashtest:
            rawBackendPrefs.gameplay?.global_autoplay ??
            DEFAULT_USER_PREFERENCES.gameplay.global_crashtest,
        },
        delays: {
          initialBotDelayMs:
            rawBackendPrefs.delays?.initialBotDelayMs ??
            DEFAULT_USER_PREFERENCES.delays.initialBotDelayMs,
          botDelayMs:
            rawBackendPrefs.delays?.botDelayMs ?? DEFAULT_USER_PREFERENCES.delays.botDelayMs,
          nextPuzzleDelayMs:
            rawBackendPrefs.delays?.nextPuzzleDelayMs ??
            DEFAULT_USER_PREFERENCES.delays.nextPuzzleDelayMs,
          restartDelayMs:
            rawBackendPrefs.delays?.restartDelayMs ??
            DEFAULT_USER_PREFERENCES.delays.restartDelayMs,
          crashtestDelayMs:
            rawBackendPrefs.delays?.autoPlayDelayMs ??
            DEFAULT_USER_PREFERENCES.delays.crashtestDelayMs,
        },
        puzzle: {
          autoNext: rawBackendPrefs.puzzle?.autoNext ?? DEFAULT_USER_PREFERENCES.puzzle.autoNext,
        },
        analysis: {
          multiPv: rawBackendPrefs.analysis?.multiPv ?? DEFAULT_USER_PREFERENCES.analysis.multiPv,
          searchTime:
            rawBackendPrefs.analysis?.searchTime ?? DEFAULT_USER_PREFERENCES.analysis.searchTime,
          showArrows:
            rawBackendPrefs.analysis?.showArrows ?? DEFAULT_USER_PREFERENCES.analysis.showArrows,
          engineVersion:
            rawBackendPrefs.analysis?.engineVersion ??
            DEFAULT_USER_PREFERENCES.analysis.engineVersion,
        },
      }

      preferences.value = deepMerge(preferences.value, mappedPrefs)
      if (preferences.value.gameplay.language) {
        changeLang(preferences.value.gameplay.language)
      }
      saveLocal()
      logger.info('[PreferencesStore] Preferences loaded from backend.')
    } catch (err) {
      logger.error('[PreferencesStore] Error loading preferences from backend:', err)
    }
  }

  async function updatePreferences(updateDto: DeepPartial<UserPreferencesDto>) {
    preferences.value = deepMerge(preferences.value, updateDto)
    saveLocal()

    const hasBackendFields = Boolean(
      updateDto.theme ||
        updateDto.engine ||
        updateDto.audio ||
        updateDto.gameplay ||
        updateDto.delays ||
        updateDto.puzzle ||
        updateDto.analysis,
    )

    if (authStore.isAuthenticated && hasBackendFields) {
      if (saveTimeout) {
        window.clearTimeout(saveTimeout)
      }
      saveTimeout = window.setTimeout(async () => {
        try {
          const current = rawPreferences.value
          const backendDto: DeepPartial<BackendUserPreferencesDto> = {
            theme: current.theme,
            engine: current.engine,
            audio: current.audio,
            gameplay: {
              language: current.gameplay.language,
              botEngine: current.gameplay.botEngine,
              global_autoplay: current.gameplay.global_crashtest,
            },
            delays: {
              initialBotDelayMs: current.delays.initialBotDelayMs,
              botDelayMs: current.delays.botDelayMs,
              nextPuzzleDelayMs: current.delays.nextPuzzleDelayMs,
              restartDelayMs: current.delays.restartDelayMs,
              autoPlayDelayMs: current.delays.crashtestDelayMs,
            },
            puzzle: current.puzzle,
            analysis: current.analysis,
          }

          await apiClient<BackendUserPreferencesDto>('/users/me/preferences', {
            method: 'PATCH',
            body: JSON.stringify(backendDto),
          })
          logger.info('[PreferencesStore] Preferences successfully updated on backend.')
        } catch (err) {
          logger.error('[PreferencesStore] Failed to update preferences on backend:', err)
        }
      }, 500)
    }
  }

  async function initialize() {
    preferences.value = loadLocal()
    if (authStore.isAuthenticated) {
      await fetchBackend()
    }
    isLoaded.value = true
  }

  watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated) => {
      if (isAuthenticated && isLoaded.value) {
        await fetchBackend()
      } else if (!isAuthenticated) {
        preferences.value = loadLocal()
      }
    },
  )

  watch(
    () => [preferences.value.theme.board, preferences.value.theme.pieces],
    ([board, pieces]) => {
      if (board && pieces) {
        applyThemeStyle(board as string, pieces as string)
      }
    },
    { immediate: true },
  )

  const selectedBotEngine = computed<EngineId>(() => {
    const current = preferences.value.gameplay.botEngine as EngineId
    return current && AVAILABLE_ENGINES.includes(current) ? current : 'maia-1500'
  })

  async function setBotEngine(engineId: EngineId) {
    await updatePreferences({ gameplay: { botEngine: engineId } })
  }

  return {
    preferences,
    isLoaded,
    initialize,
    updatePreferences,
    selectedBotEngine,
    setBotEngine,
  }
})

