<!-- src/pages/giftcode/ui/GiftCodeRedeemPage.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/entities/user'
import { apiClient } from '@/shared/api/client'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useMessage } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const uiStore = useUiStore()
const message = useMessage()

const isProcessing = ref(true)

onMounted(async () => {
  const code = String(route.params.code || '').trim()
  if (!code || code.length !== 8) {
    message.warning(t('puzzleCategories.tierRestriction.giftInvalid'))
    router.replace('/')
    return
  }

  // Wait if auth is still loading
  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = authStore.$subscribe(() => {
        if (!authStore.isLoading) {
          unwatch()
          resolve()
        }
      })
    })
  }

  // If user is authenticated, attempt instant redemption
  if (authStore.isAuthenticated) {
    try {
      const res = await apiClient<{ success: boolean; tier: string; expiresAt: string }>(
        '/billing/redeem',
        {
          method: 'POST',
          body: JSON.stringify({ code })
        }
      )

      if (res.success) {
        message.success(t('puzzleCategories.tierRestriction.giftSuccess'))
        await authStore.checkSession()
        await uiStore.showConfirmation(
          t('puzzleCategories.tierRestriction.giftSuccess'),
          t('puzzleCategories.tierRestriction.message'),
          {
            confirmText: t('shared.buttons.confirm'),
            showCancel: false,
            variant: 'primary',
            icon: 'info'
          }
        )
      }
    } catch {
      message.error(t('puzzleCategories.tierRestriction.giftInvalid'))
    } finally {
      isProcessing.value = false
      router.replace('/')
    }
  } else {
    // If not authenticated, store code in localStorage and prompt login
    localStorage.setItem('pending_gift_code', code)
    localStorage.setItem('redirect_after_login', '/')
    message.info(t('shared.auth.requiredForAction'))
    authStore.login()
    router.replace('/')
  }
})
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
    <div v-if="isProcessing" class="flex flex-col items-center gap-4">
      <div class="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
      <p class="text-text-primary font-display font-medium text-lg">
        {{ t('puzzleCategories.tierRestriction.activateBtn') }}...
      </p>
    </div>
  </div>
</template>
