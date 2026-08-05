import { useAuthStore } from '@/entities/user'
import { applyThemeStyle } from '../config/theme.config'
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { registerVolumeProvider } from '@/shared/lib/sound.service'
import type { EngineId } from '@/shared/types/api.types'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const LOCAL_STORAGE_KEY = 'user_preferences_backup_v1'

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
  voiceVolume: number
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

export interface UserPreferencesDto {
  theme: ThemePreferences
  engine: EnginePreferences
  audio: AudioPreferences
  gameplay: GameplayPreferences
  delays: DelayPreferences
}

export interface BackendUserPreferencesDto {
  theme: ThemePreferences
  engine: EnginePreferences
  audio: AudioPreferences
  gameplay: Omit<GameplayPreferences, 'global_crashtest'> & { global_autoplay?: boolean }
  delays: Omit<DelayPreferences, 'crashtestDelayMs'> & { autoPlayDelayMs?: number }
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
    voiceVolume: 1.0,
    boardVolume: 1.0,
  },
  gameplay: {
    language: 'en',
    botEngine: 'maia-2200',
    global_crashtest: false,
  },
  delays: {
    initialBotDelayMs: 500,
    botDelayMs: 250,
    nextPuzzleDelayMs: 2000,
    restartDelayMs: 500,
    crashtestDelayMs: 100,
  },
}

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }
  for (const key of Object.keys(source) as Array<keyof T>) {
    const val = source[key]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(
        (result[key] || {}) as Record<string, unknown>,
        val as DeepPartial<Record<string, unknown>>
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

  const isMo3ep = computed(() => {
    const profile = authStore.userProfile
    if (!profile) return false
    return profile.id === 'mo3ep' || profile.username === 'MO3EP'
  })

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

  // Local-only preferences (not synced to backend)
  const coachTakebackEnabled = ref(true)
  const coachTakebackDelay = ref(1000)

  // Register shared providers to comply with Feature-Sliced Design
  registerVolumeProvider({
    getVoiceVolume: () => preferences.value.audio.voiceVolume,
    getBoardVolume: () => preferences.value.audio.boardVolume,
    setVoiceVolume: (vol) => updatePreferences({ audio: { voiceVolume: vol } }),
    setBoardVolume: (vol) => updatePreferences({ audio: { boardVolume: vol } }),
  })



  let saveTimeout: number | null = null

  // Load initial preferences
  function loadLocal(): UserPreferencesDto {
    try {
      const backup = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (backup) {
        const parsed = JSON.parse(backup)
        coachTakebackEnabled.value = parsed.coachTakebackEnabled ?? true
        coachTakebackDelay.value = parsed.coachTakebackDelay ?? 1000
        return deepMerge(DEFAULT_USER_PREFERENCES, parsed)
      }
    } catch (err) {
      logger.error('[PreferencesStore] Failed to parse local preferences:', err)
    }
    return { ...DEFAULT_USER_PREFERENCES }
  }

  function saveLocal() {
    try {
      const payload = {
        ...preferences.value,
        coachTakebackEnabled: coachTakebackEnabled.value,
        coachTakebackDelay: coachTakebackDelay.value,
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
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

      const mappedPrefs: UserPreferencesDto = {
        theme: rawBackendPrefs.theme,
        engine: rawBackendPrefs.engine,
        audio: rawBackendPrefs.audio,
        gameplay: {
          language: rawBackendPrefs.gameplay?.language ?? DEFAULT_USER_PREFERENCES.gameplay.language,
          botEngine: rawBackendPrefs.gameplay?.botEngine ?? DEFAULT_USER_PREFERENCES.gameplay.botEngine,
          global_crashtest: rawBackendPrefs.gameplay?.global_autoplay ?? DEFAULT_USER_PREFERENCES.gameplay.global_crashtest,
        },
        delays: {
          initialBotDelayMs: rawBackendPrefs.delays?.initialBotDelayMs ?? DEFAULT_USER_PREFERENCES.delays.initialBotDelayMs,
          botDelayMs: rawBackendPrefs.delays?.botDelayMs ?? DEFAULT_USER_PREFERENCES.delays.botDelayMs,
          nextPuzzleDelayMs: rawBackendPrefs.delays?.nextPuzzleDelayMs ?? DEFAULT_USER_PREFERENCES.delays.nextPuzzleDelayMs,
          restartDelayMs: rawBackendPrefs.delays?.restartDelayMs ?? DEFAULT_USER_PREFERENCES.delays.restartDelayMs,
          crashtestDelayMs: rawBackendPrefs.delays?.autoPlayDelayMs ?? DEFAULT_USER_PREFERENCES.delays.crashtestDelayMs,
        },
      }

      preferences.value = deepMerge(DEFAULT_USER_PREFERENCES, mappedPrefs)
      saveLocal()
      logger.info('[PreferencesStore] Preferences loaded from backend.')
    } catch (err) {
      logger.error('[PreferencesStore] Error loading preferences from backend:', err)
    }
  }

  async function updatePreferences(updateDto: DeepPartial<UserPreferencesDto>) {
    preferences.value = deepMerge(preferences.value, updateDto)
    saveLocal()

    // Sync to backend if authenticated
    if (authStore.isAuthenticated) {
      if (saveTimeout) {
        window.clearTimeout(saveTimeout)
      }
      saveTimeout = window.setTimeout(async () => {
        try {
          const backendDto: DeepPartial<BackendUserPreferencesDto> = {}
          if (updateDto.theme) backendDto.theme = updateDto.theme
          if (updateDto.engine) backendDto.engine = updateDto.engine
          if (updateDto.audio) backendDto.audio = updateDto.audio
          if (updateDto.gameplay) {
            backendDto.gameplay = {
              language: updateDto.gameplay.language,
              botEngine: updateDto.gameplay.botEngine,
              global_autoplay: updateDto.gameplay.global_crashtest,
            }
          }
          if (updateDto.delays) {
            backendDto.delays = {
              initialBotDelayMs: updateDto.delays.initialBotDelayMs,
              botDelayMs: updateDto.delays.botDelayMs,
              nextPuzzleDelayMs: updateDto.delays.nextPuzzleDelayMs,
              restartDelayMs: updateDto.delays.restartDelayMs,
              autoPlayDelayMs: updateDto.delays.crashtestDelayMs,
            }
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

  // React to auth status changes
  watch(
    () => authStore.isAuthenticated,
    async (isAuthenticated) => {
      if (isAuthenticated && isLoaded.value) {
        await fetchBackend()
      } else if (!isAuthenticated) {
        // Just keep local
        preferences.value = loadLocal()
      }
    }
  )

  // Watch theme preferences and automatically update dynamic board/piece styles
  watch(
    () => [preferences.value.theme.board, preferences.value.theme.pieces],
    ([board, pieces]) => {
      if (board && pieces) {
        applyThemeStyle(board as string, pieces as string)
      }
    },
    { immediate: true }
  )

  function updateCoachTakeback(enabled: boolean, delay: number) {
    coachTakebackEnabled.value = enabled
    coachTakebackDelay.value = delay
    saveLocal()
  }

  // Engine selection (bot opponent)
  const isEngineSelectorOpen = ref(false)
  const selectedBotEngine = computed<EngineId>(() => (preferences.value.gameplay.botEngine as EngineId) || 'maia-2200')

  function toggleEngineSelector() {
    isEngineSelectorOpen.value = !isEngineSelectorOpen.value
  }

  async function setBotEngine(engineId: EngineId) {
    await updatePreferences({ gameplay: { botEngine: engineId } })
    isEngineSelectorOpen.value = false
    try {
      const { useGameStore } = await import('@/entities/game')
      const gameStore = useGameStore()
      gameStore.setBotEngineId(engineId)
    } catch (e) {
      logger.error('[PreferencesStore] Failed to notify gameStore of botEngine change', e)
    }
  }

  return {
    preferences,
    isLoaded,
    initialize,
    updatePreferences,
    coachTakebackEnabled,
    coachTakebackDelay,
    updateCoachTakeback,
    isEngineSelectorOpen,
    selectedBotEngine,
    toggleEngineSelector,
    setBotEngine,
  }
})
