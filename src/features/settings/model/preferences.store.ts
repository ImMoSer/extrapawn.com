import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { registerVolumeProvider } from '@/shared/lib/sound.service'
import { registerEngineConfigProvider } from '@/shared/lib/engine/coach/engine'

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL as string
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
  global_autoplay: boolean
}

export interface DelayPreferences {
  initialBotDelayMs: number
  botDelayMs: number
  nextPuzzleDelayMs: number
  restartDelayMs: number
  autoPlayDelayMs: number
}

export interface UserPreferencesDto {
  theme: ThemePreferences
  engine: EnginePreferences
  audio: AudioPreferences
  gameplay: GameplayPreferences
  delays: DelayPreferences
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
    global_autoplay: false,
  },
  delays: {
    initialBotDelayMs: 100,
    botDelayMs: 100,
    nextPuzzleDelayMs: 100,
    restartDelayMs: 100,
    autoPlayDelayMs: 100,
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
  const preferences = ref<UserPreferencesDto>({ ...DEFAULT_USER_PREFERENCES })
  const isLoaded = ref(false)

  // Register shared providers to comply with Feature-Sliced Design
  registerVolumeProvider({
    getVoiceVolume: () => preferences.value.audio.voiceVolume,
    getBoardVolume: () => preferences.value.audio.boardVolume,
    setVoiceVolume: (vol) => updatePreferences({ audio: { voiceVolume: vol } }),
    setBoardVolume: (vol) => updatePreferences({ audio: { boardVolume: vol } }),
  })

  registerEngineConfigProvider({
    getEnginePrefs: () => ({
      useServerCoach: preferences.value.engine.useServerCoach,
      depth: preferences.value.engine.depth,
      multipv: preferences.value.engine.multipv,
    }),
    setUseServerCoach: (val: boolean) => updatePreferences({ engine: { useServerCoach: val } }),
    setEngineDefaults: (options: { depth?: number; multipv?: number }) => updatePreferences({ engine: options }),
  })

  let saveTimeout: number | null = null

  // Load initial preferences
  function loadLocal(): UserPreferencesDto {
    try {
      const backup = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (backup) {
        return deepMerge(DEFAULT_USER_PREFERENCES, JSON.parse(backup))
      }
    } catch (err) {
      logger.error('[PreferencesStore] Failed to parse local preferences:', err)
    }
    return { ...DEFAULT_USER_PREFERENCES }
  }

  function saveLocal() {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(preferences.value))
    } catch (err) {
      logger.error('[PreferencesStore] Failed to save local preferences:', err)
    }
  }

  async function fetchBackend() {
    if (!authStore.isAuthenticated) {
      return
    }
    try {
      const response = await fetch(`${BACKEND_API_URL}/users/me/preferences`, {
        credentials: 'include',
      })
      if (response.ok) {
        const backendPrefs = await response.json()
        preferences.value = deepMerge(DEFAULT_USER_PREFERENCES, backendPrefs)
        saveLocal()
        logger.info('[PreferencesStore] Preferences loaded from backend.')
      } else {
        logger.warn('[PreferencesStore] Failed to load preferences from backend, status:', response.status)
      }
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
          const response = await fetch(`${BACKEND_API_URL}/users/me/preferences`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateDto),
            credentials: 'include',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
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

  return {
    preferences,
    isLoaded,
    initialize,
    updatePreferences,
  }
})
