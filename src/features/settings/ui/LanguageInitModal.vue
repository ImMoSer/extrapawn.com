<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import { GlobeOutline, CheckmarkCircleOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import logger from '@/shared/lib/logger'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const isSaving = ref(false)

const shouldShow = computed(() => {
  if (authStore.isLoading) return false
  if (!authStore.isAuthenticated || !authStore.userProfile) return false
  return !authStore.userProfile.language
})

const handleSelectLanguage = async (lang: 'ru' | 'de' | 'en') => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    logger.info(`[LanguageInitModal] User selected language: ${lang}`)

    changeLang(lang)

    await preferencesStore.updatePreferences({
      gameplay: {
        language: lang,
      },
    })

    if (authStore.userProfile) {
      authStore.userProfile.language = lang
      localStorage.setItem('user_profile', JSON.stringify(authStore.userProfile))
    }
  } catch (err) {
    logger.error('[LanguageInitModal] Error saving language choice:', err)
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
        class="relative flex w-full max-w-md flex-col items-center rounded-xl border border-border bg-surface p-6 text-center text-text-primary shadow-lg sm:p-8"
      >
        <!-- Top Icon Badge -->
        <div
          class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-elevated text-brand"
        >
          <NIcon size="26">
            <GlobeOutline />
          </NIcon>
        </div>

        <!-- Header -->
        <h2 class="mb-2 font-display text-xl font-semibold text-text-primary">
          Выберите ваш язык / Select Language
        </h2>
        <p class="mb-6 text-sm leading-relaxed text-text-secondary">
          Пожалуйста, выберите язык для интерфейса и аналитики<br />
          <span class="text-xs text-text-secondary">Choose your language / Wähle deine Sprache</span>
        </p>

        <!-- Language Buttons Grid -->
        <div class="flex w-full flex-col gap-2.5">
          <button
            type="button"
            :disabled="isSaving"
            class="group box-border flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-elevated/40 px-4 py-3 text-base font-medium text-text-primary transition-colors hover:border-brand hover:bg-elevated disabled:opacity-50"
            @click="handleSelectLanguage('ru')"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">🇷🇺</span>
              <div class="flex flex-col items-start">
                <span class="text-sm font-semibold text-text-primary">
                  Русский
                </span>
                <span class="text-xs text-text-secondary">Russian</span>
              </div>
            </div>
            <NIcon size="20" class="text-text-secondary group-hover:text-brand">
              <CheckmarkCircleOutline />
            </NIcon>
          </button>

          <button
            type="button"
            :disabled="isSaving"
            class="group box-border flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-elevated/40 px-4 py-3 text-base font-medium text-text-primary transition-colors hover:border-brand hover:bg-elevated disabled:opacity-50"
            @click="handleSelectLanguage('de')"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">🇩🇪</span>
              <div class="flex flex-col items-start">
                <span class="text-sm font-semibold text-text-primary">
                  Deutsch
                </span>
                <span class="text-xs text-text-secondary">German</span>
              </div>
            </div>
            <NIcon size="20" class="text-text-secondary group-hover:text-brand">
              <CheckmarkCircleOutline />
            </NIcon>
          </button>

          <button
            type="button"
            :disabled="isSaving"
            class="group box-border flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-elevated/40 px-4 py-3 text-base font-medium text-text-primary transition-colors hover:border-brand hover:bg-elevated disabled:opacity-50"
            @click="handleSelectLanguage('en')"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">🇬🇧</span>
              <div class="flex flex-col items-start">
                <span class="text-sm font-semibold text-text-primary">
                  English
                </span>
                <span class="text-xs text-text-secondary">English</span>
              </div>
            </div>
            <NIcon size="20" class="text-text-secondary group-hover:text-brand">
              <CheckmarkCircleOutline />
            </NIcon>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
