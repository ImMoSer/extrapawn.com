import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { hasFullAccess, isPawn, getTierRank } from '@/shared/config/tier.config'

export function useAccessControl() {
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const router = useRouter()

  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const userProfile = computed(() => authStore.userProfile)
  const tier = computed(() => userProfile.value?.subscriptionTier)

  const hasFullAccessUser = computed<boolean>(() => {
    if (!isAuthenticated.value || !userProfile.value) return false
    return hasFullAccess(tier.value)
  })

  const userTierRank = computed<number>(() => {
    return getTierRank(tier.value)
  })

  const isUserPawn = computed<boolean>(() => {
    return isPawn(tier.value)
  })

  const canAccessCabinet = (): boolean => hasFullAccessUser.value
  const canAccessRepertoire = (): boolean => hasFullAccessUser.value
  const canStartPlan = (): boolean => hasFullAccessUser.value

  const canPlayTheme = (themeTier?: 'basic' | 'premium' | 'premiumPlus'): boolean => {
    if (!themeTier || themeTier === 'basic') return true
    return hasFullAccessUser.value
  }

  const canUseDifficulty = (difficulty: string): boolean => {
    if (difficulty === 'Novice') return true
    return hasFullAccessUser.value
  }

  /**
   * Primary Guard: Checks full access, triggers Paywall restriction modal if unauthorized,
   * handles user decision (upgrade -> /pricing, cancel -> cancelRedirectPath if set).
   * Returns boolean (true if access granted, false if restricted).
   */
  async function requireFullAccess(
    customMessage?: string,
    cancelRedirectPath: string | false = '/'
  ): Promise<boolean> {
    if (hasFullAccessUser.value) return true

    const res = await uiStore.showRestrictionModal(customMessage)
    if (res === 'confirm') {
      if (router) {
        await router.push('/pricing')
      }
    } else if (res === 'cancel' && cancelRedirectPath !== false) {
      if (router) {
        await router.push(cancelRedirectPath)
      }
    }
    return false
  }

  /**
   * Auth Guard: Checks authentication, prompts login if guest.
   */
  async function requireAuth(
    promptTitle?: string,
    promptMessage?: string
  ): Promise<boolean> {
    if (isAuthenticated.value) return true

    const res = await uiStore.showConfirmation(
      promptTitle || 'Anmeldung erforderlich',
      promptMessage || 'Bitte melde dich an, um fortzufahren.',
      {
        confirmText: 'Mit Lichess anmelden',
        showCancel: true,
      }
    )

    if (res === 'confirm') {
      authStore.login()
    }
    return false
  }

  return {
    isAuthenticated,
    userProfile,
    tier,
    hasFullAccessUser,
    userTierRank,
    isUserPawn,
    canAccessCabinet,
    canAccessRepertoire,
    canStartPlan,
    canPlayTheme,
    canUseDifficulty,
    requireFullAccess,
    requireAuth,
  }
}
