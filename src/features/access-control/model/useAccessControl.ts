import { computed } from 'vue'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'

export function useAccessControl() {
  const authStore = useAuthStore()
  const uiStore = useUiStore()

  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const userProfile = computed(() => authStore.userProfile)
  const tier = computed(() => userProfile.value?.subscriptionTier || 'Free')

  const hasFullAccessUser = computed<boolean>(() => true)
  const userTierRank = computed<number>(() => 99)
  const isUserPawn = computed<boolean>(() => false)

  const canAccessCabinet = (): boolean => true
  const canAccessRepertoire = (): boolean => true
  const canStartPlan = (): boolean => true
  const canPlayTheme = (_themeTier?: 'basic' | 'premium' | 'premiumPlus'): boolean => true
  const canUseDifficulty = (_difficulty: string): boolean => true

  /**
   * Primary Guard: Since ExtraPawn is 100% free, always returns true.
   */
  async function requireFullAccess(
    _customMessage?: string,
    _cancelRedirectPath: string | false = '/'
  ): Promise<boolean> {
    return true
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
