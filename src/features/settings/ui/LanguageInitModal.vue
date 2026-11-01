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
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-void/80 p-4 backdrop-blur-md"
    >
      <div
        class="relative flex w-full max-w-md flex-col items-center rounded-2xl border border-neon-cyan/30 bg-surface p-6 text-center text-text-primary sm:p-8"
      >
        <!-- Top Icon Badge -->
        <div
          class="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan"
        >
          <NIcon size="32">
            <GlobeOutline />
          </NIcon>
        </div>

        <!-- Header -->
        <h2
          class="mb-2 bg-gradient-to-br from-neon-cyan to-info-deep bg-clip-text font-display text-2xl font-bold text-transparent"
        >
          Выберите ваш язык / Select Language
        </h2>
        <p class="mb-6 text-sm leading-relaxed text-text-secondary">
          Пожалуйста, выберите язык для интерфейса и общения с ИИ-тренером<br />
          <span class="text-xs text-text-secondary">Choose your language / Wähle deine Sprache</span>
        </p>

        <!-- Language Buttons Grid -->
        <div class="flex w-full flex-col gap-3">
          <button
            type="button"
            :disabled="isSaving"
            class="group box-border flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-surface px-5 py-3.5 text-base font-semibold text-text-primary transition-all hover:border-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
            @click="handleSelectLanguage('ru')"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">🇷🇺</span>
              <div class="flex flex-col items-start">
                <span class="text-sm font-bold text-text-primary group-hover:text-neon-cyan">
                  Русский
                </span>
                <span class="text-xs text-text-secondary">Russian</span>
              </div>
            </div>
            <NIcon size="20" class="text-text-secondary group-hover:text-neon-cyan">
              <CheckmarkCircleOutline />
            </NIcon>
          </button>

          <button
            type="button"
            :disabled="isSaving"
            class="group box-border flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-surface px-5 py-3.5 text-base font-semibold text-text-primary transition-all hover:border-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
            @click="handleSelectLanguage('de')"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">🇩🇪</span>
              <div class="flex flex-col items-start">
                <span class="text-sm font-bold text-text-primary group-hover:text-neon-cyan">
                  Deutsch
                </span>
                <span class="text-xs text-text-secondary">German</span>
              </div>
            </div>
            <NIcon size="20" class="text-text-secondary group-hover:text-neon-cyan">
              <CheckmarkCircleOutline />
            </NIcon>
          </button>

          <button
            type="button"
            :disabled="isSaving"
            class="group box-border flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-surface px-5 py-3.5 text-base font-semibold text-text-primary transition-all hover:border-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
            @click="handleSelectLanguage('en')"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">🇬🇧</span>
              <div class="flex flex-col items-start">
                <span class="text-sm font-bold text-text-primary group-hover:text-neon-cyan">
                  English
                </span>
                <span class="text-xs text-text-secondary">English</span>
              </div>
            </div>
            <NIcon size="20" class="text-text-secondary group-hover:text-neon-cyan">
              <CheckmarkCircleOutline />
            </NIcon>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
