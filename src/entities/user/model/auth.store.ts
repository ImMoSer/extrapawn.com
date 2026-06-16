// src/stores/auth.store.ts
import logger from '@/shared/lib/logger'
import type { UserSessionProfile, UserStatsUpdate } from '@/shared/types/api.types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '../api/AuthService'

export const useAuthStore = defineStore('auth', () => {
  // --- STATE ---
  const userProfile = ref<UserSessionProfile | null>(null)
  const isAuthenticated = ref<boolean>(false)
  const isLoading = ref<boolean>(true)
  const error = ref<string | null>(null)
  const isLoginModalVisible = ref<boolean>(false)
  
  // Developer/Test username override
  const targetLichessUsername = ref<string>('')

  // --- GETTERS ---
  const getUserProfile = computed(() => userProfile.value)
  const getIsAuthenticated = computed(() => isAuthenticated.value)
  const getIsLoading = computed(() => isLoading.value)
  const getError = computed(() => error.value)
  const effectiveLichessUsername = computed(() => {
    return targetLichessUsername.value || userProfile.value?.id || ''
  })

  // --- ACTIONS ---

  function _syncState() {
    const serviceState = authService.getState()
    userProfile.value = serviceState.userProfile
    isAuthenticated.value = serviceState.isAuthenticated
    isLoading.value = serviceState.isProcessing
    error.value = serviceState.error
    logger.debug('[AuthStore] State synchronized with AuthService', serviceState)
  }

  async function initialize() {
    logger.info('[AuthStore] Initializing...')
    authService.subscribe(_syncState)
    await authService.handleAuthentication()
  }

  function login() {
    isLoginModalVisible.value = true
  }

  function cancelLogin() {
    isLoginModalVisible.value = false
  }

  async function confirmLogin(scopes: string[]) {
    await authService.login(scopes)
    _syncState()
  }

  async function logout() {
    await authService.logout()
    _syncState()
  }

  async function checkSession() {
    await authService.checkSession()
    _syncState()
  }

  function updateUserStats(statsUpdate: UserStatsUpdate) {
    authService.updateUserStatsFromResponse(statsUpdate)
    _syncState()
  }

  function isDailyLimitExceeded(): boolean {
    if (!userProfile.value) return false
    const today = new Date().toISOString().split('T')[0]
    const key = `limit_exceeded_${userProfile.value.id}_${userProfile.value.subscriptionTier}_${today}`
    return localStorage.getItem(key) === 'true'
  }

  function setDailyLimitExceeded(exceeded: boolean = true) {
    if (!userProfile.value) return
    const today = new Date().toISOString().split('T')[0]
    const key = `limit_exceeded_${userProfile.value.id}_${userProfile.value.subscriptionTier}_${today}`
    if (exceeded) {
      localStorage.setItem(key, 'true')
    } else {
      localStorage.removeItem(key)
    }
  }

  return {
    // State
    userProfile,
    isAuthenticated,
    isLoading,
    error,
    isLoginModalVisible,
    targetLichessUsername,
    effectiveLichessUsername,
    // Getters
    getUserProfile,
    getIsAuthenticated,
    getIsLoading,
    getError,
    // Actions
    initialize,
    login,
    cancelLogin,
    confirmLogin,
    logout,
    checkSession,
    updateUserStats,
    isDailyLimitExceeded,
    setDailyLimitExceeded,
  }
})
