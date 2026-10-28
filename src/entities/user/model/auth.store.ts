import logger from '@/shared/lib/logger'
import type { UserSessionProfile, UserStatsUpdate } from '@/shared/types/api.types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL as string
const PROFILE_STORAGE_KEY = 'user_profile'

if (!BACKEND_API_URL) {
  throw new Error(
    '[AuthStore] Critical Configuration Error: VITE_BACKEND_API_URL is not defined in .env. Fail-Fast!',
  )
}

export const useAuthStore = defineStore('auth', () => {
  const userProfile = ref<UserSessionProfile | null>(null)
  const isAuthenticated = ref<boolean>(false)
  const isLoading = ref<boolean>(true)
  const error = ref<string | null>(null)
  const targetLichessUsername = ref<string>('')

  const getUserProfile = computed(() => userProfile.value)
  const getIsAuthenticated = computed(() => isAuthenticated.value)
  const getIsLoading = computed(() => isLoading.value)
  const getError = computed(() => error.value)
  const effectiveLichessUsername = computed(() => {
    return targetLichessUsername.value || userProfile.value?.id || ''
  })
  const isMo3ep = computed(() => {
    const profile = userProfile.value
    if (!profile) return false
    return profile.id === 'mo3ep' || profile.username === 'MO3EP'
  })

  function restoreFromStorage() {
    try {
      const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY)
      if (savedProfile) {
        const parsed: UserSessionProfile = JSON.parse(savedProfile)
        userProfile.value = parsed
        isAuthenticated.value = true
        isLoading.value = false
        logger.info(`[AuthStore] Restored profile for "${parsed.username}" from localStorage.`)
      } else {
        isLoading.value = true
      }
    } catch (e) {
      logger.error('[AuthStore] Error restoring profile from storage:', e)
    }
  }

  function clearAuthDataLocal() {
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    sessionStorage.removeItem('lichess_study_ready')
    userProfile.value = null
    isAuthenticated.value = false
    isLoading.value = false
    error.value = null
  }

  async function checkSession(): Promise<void> {
    if (!userProfile.value) {
      isLoading.value = true
    }
    error.value = null
    try {
      const response = await fetch(`${BACKEND_API_URL}/auth/lichess/profile`, {
        credentials: 'include',
      })

      if (response.ok) {
        const profile: UserSessionProfile = await response.json()
        userProfile.value = profile
        isAuthenticated.value = true
        isLoading.value = false
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
        logger.info(`[AuthStore] Session valid. User "${profile.username}" authenticated.`)
      } else {
        logger.info('[AuthStore] No active web session found.')
        clearAuthDataLocal()
      }
    } catch (err) {
      logger.error('[AuthStore] Error checking web session:', err)
      clearAuthDataLocal()
      error.value = 'features.errors.backendConnectionFailed'
    }
  }

  async function initialize(): Promise<boolean> {
    restoreFromStorage()
    if (userProfile.value && isAuthenticated.value) {
      void checkSession()
      return true
    }
    await checkSession()
    return isAuthenticated.value
  }

  async function login(scopes: string[] = ['email:read', 'preference:read']): Promise<void> {
    logger.info('[AuthStore] Redirecting to backend for Lichess login...')
    isLoading.value = true
    let url = `${BACKEND_API_URL}/auth/lichess/login`
    if (scopes.length > 0) {
      url += `?scopes=${encodeURIComponent(scopes.join(' '))}`
    }
    window.location.href = url
  }

  async function logout(): Promise<void> {
    logger.info('[AuthStore] Redirecting to backend for logout...')
    isLoading.value = true
    clearAuthDataLocal()
    window.location.href = `${BACKEND_API_URL}/auth/lichess/logout`
  }

  function updateUserStats(statsUpdate: UserStatsUpdate) {
    if (!userProfile.value) return
    const currentUserId = userProfile.value.id
    if (statsUpdate.id && statsUpdate.id.toLowerCase() !== currentUserId.toLowerCase()) {
      logger.error(
        `[AuthStore] updateUserStats ID mismatch! Profile: ${currentUserId}, Update: ${statsUpdate.id}`,
      )
      return
    }
    userProfile.value = {
      ...userProfile.value,
      ...statsUpdate,
    }
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile.value))
  }

  return {
    userProfile,
    isAuthenticated,
    isLoading,
    error,
    targetLichessUsername,
    effectiveLichessUsername,
    isMo3ep,
    getUserProfile,
    getIsAuthenticated,
    getIsLoading,
    getError,
    initialize,
    login,
    logout,
    checkSession,
    updateUserStats,
    clearAuthDataLocal,
  }
})
