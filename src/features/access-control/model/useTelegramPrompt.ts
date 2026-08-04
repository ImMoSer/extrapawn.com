import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import logger from '@/shared/lib/logger'

const DISMISS_KEY = 'telegram_prompt_dismissed_until'
const TTL_24_HOURS_MS = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export function useTelegramPrompt() {
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const { t } = useI18n()
  const hasPrompted = ref(false)

  function isDismissed(): boolean {
    const rawValue = localStorage.getItem(DISMISS_KEY)
    if (!rawValue) return false
    const dismissedUntil = Number(rawValue)
    if (isNaN(dismissedUntil)) return false
    return Date.now() < dismissedUntil
  }

  function markAsDismissed(): void {
    const expireTime = Date.now() + TTL_24_HOURS_MS
    localStorage.setItem(DISMISS_KEY, expireTime.toString())
    logger.info(`[TelegramPrompt] Proactive prompt dismissed until ${new Date(expireTime).toISOString()}`)
  }

  async function checkAndPrompt(): Promise<void> {
    if (hasPrompted.value) return
    if (authStore.isLoading) return
    if (!authStore.isAuthenticated || !authStore.userProfile) return

    // Wait until user has selected their language (language is non-null)
    if (!authStore.userProfile.language) {
      logger.debug('[TelegramPrompt] Postponed Telegram prompt: language is not set yet')
      return
    }

    // If user already linked Telegram, do nothing and ensure dismiss key is cleaned up
    if (authStore.userProfile.telegram) {
      localStorage.removeItem(DISMISS_KEY)
      return
    }

    // Check 24-hour TTL dismiss status
    if (isDismissed()) {
      logger.debug('[TelegramPrompt] Skipped proactive prompt due to active 24h TTL')
      return
    }

    // Do not override an already active modal
    if (uiStore.isModalVisible) return

    hasPrompted.value = true
    logger.info('[TelegramPrompt] Triggering proactive Telegram link offer modal')

    await uiStore.showConfirmation(
      t('puzzleCategories.tierRestriction.proactiveTitle'),
      t('puzzleCategories.tierRestriction.proactiveMessage'),
      {
        confirmText: t('puzzleCategories.tierRestriction.upgradeBtn'),
        cancelText: t('puzzleCategories.tierRestriction.cancelBtn'),
        showCancel: true,
        variant: 'primary',
        icon: 'lock',
        telegramAttached: false,
      }
    )

    // Mark as dismissed for 24 hours regardless of user action (close, cancel, or navigate)
    markAsDismissed()
  }

  onMounted(() => {
    checkAndPrompt()
  })

  watch(
    () => [authStore.isAuthenticated, authStore.userProfile, authStore.isLoading],
    () => {
      checkAndPrompt()
    },
    { deep: true }
  )

  return {
    checkAndPrompt,
    isDismissed,
    markAsDismissed,
  }
}
