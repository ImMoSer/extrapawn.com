<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { ShieldCheckmarkOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useAuthStore } from '@/entities/user'
import logger from '@/shared/lib/logger'

const authStore = useAuthStore()
const route = useRoute()
const { t } = useI18n()

const isAccepted = ref(false)
const isSaving = ref(false)

const shouldShow = computed(() => {
  if (authStore.isLoading) return false
  if (!authStore.isAuthenticated || !authStore.userProfile) return false
  if (!authStore.userProfile.language) return false
  if (route.path === '/legal') return false
  return !authStore.userProfile.termsAcceptedAt
})

const handleConfirmTerms = async () => {
  if (!isAccepted.value || isSaving.value) return
  isSaving.value = true
  try {
    await authStore.acceptTerms()
  } catch (err) {
    logger.error('[LegalConsentModal] Error saving legal consent:', err)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shouldShow"
      class="fixed inset-0 z-9999 flex items-center justify-center bg-canvas/85 p-4"
    >
      <div
        class="relative flex max-h-[92vh] w-full max-w-lg flex-col items-center overflow-y-auto rounded-xl border border-border bg-surface p-5 text-left text-text-primary shadow-lg sm:p-7"
      >
        <!-- Top Icon Badge -->
        <div
          class="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-brand"
        >
          <NIcon size="26">
            <ShieldCheckmarkOutline />
          </NIcon>
        </div>

        <!-- Header -->
        <h2 class="mb-1.5 text-center font-display text-xl font-semibold text-text-primary">
          {{ t('legal.consentModal.title') }}
        </h2>
        <p class="mb-4 text-center text-xs leading-relaxed text-text-secondary sm:text-sm">
          {{ t('legal.consentModal.subtitle') }}
        </p>

        <!-- 3 Concise Points -->
        <div class="mb-4 flex w-full flex-col gap-2.5">
          <div class="rounded-lg border border-border bg-elevated/40 p-3">
            <div class="mb-0.5 text-xs font-bold text-text-primary sm:text-sm">
              {{ t('legal.consentModal.point1Title') }}
            </div>
            <div class="text-xs leading-relaxed text-text-secondary">
              {{ t('legal.consentModal.point1Text') }}
            </div>
          </div>

          <div class="rounded-lg border border-border bg-elevated/40 p-3">
            <div class="mb-0.5 text-xs font-bold text-text-primary sm:text-sm">
              {{ t('legal.consentModal.point2Title') }}
            </div>
            <div class="text-xs leading-relaxed text-text-secondary">
              {{ t('legal.consentModal.point2Text') }}
            </div>
          </div>

          <div class="rounded-lg border border-border bg-elevated/40 p-3">
            <div class="mb-0.5 text-xs font-bold text-text-primary sm:text-sm">
              {{ t('legal.consentModal.point3Title') }}
            </div>
            <div class="text-xs leading-relaxed text-text-secondary">
              {{ t('legal.consentModal.point3Text') }}
            </div>
          </div>
        </div>

        <!-- Checkbox with clickable Legal links -->
        <label
          class="mb-4 flex w-full cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-elevated p-3 text-xs leading-relaxed text-text-secondary"
        >
          <input
            v-model="isAccepted"
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span>
            {{ t('legal.consentModal.checkboxPrefix') }}
            <RouterLink
              to="/legal#terms"
              class="font-semibold text-brand underline hover:opacity-80"
              @click.stop
            >
              {{ t('legal.consentModal.termsLinkText') }}
            </RouterLink>
            {{ t('legal.consentModal.checkboxMiddle') }}
            <RouterLink
              to="/legal#privacy"
              class="font-semibold text-brand underline hover:opacity-80"
              @click.stop
            >
              {{ t('legal.consentModal.privacyLinkText') }}
            </RouterLink>
            <template v-if="t('legal.consentModal.checkboxSuffix')">
              {{ ' ' + t('legal.consentModal.checkboxSuffix') }}
            </template>
            (<RouterLink
              to="/legal#imprint"
              class="text-brand underline hover:opacity-80"
              @click.stop
            >{{ t('legal.consentModal.imprintLinkText') }}</RouterLink>).
          </span>
        </label>

        <!-- Confirm Button -->
        <button
          type="button"
          :disabled="!isAccepted || isSaving"
          class="w-full rounded-lg py-2.5 text-sm font-bold transition-colors"
          :class="
            isAccepted && !isSaving
              ? 'cursor-pointer bg-brand text-on-brand hover:bg-brand-deep'
              : 'cursor-not-allowed border border-border bg-elevated text-text-disabled'
          "
          @click="handleConfirmTerms"
        >
          {{ t('legal.consentModal.continueBtn') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

