<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/entities/user'
import { usePreferencesStore } from '../model/preferences.store'
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
  // Show if user.language is null / undefined / empty
  return !authStore.userProfile.language
})

const handleSelectLanguage = async (lang: 'ru' | 'de' | 'en') => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    logger.info(`[LanguageInitModal] User selected language: ${lang}`)

    // 1. Instantly apply language in UI i18n
    changeLang(lang)

    // 2. Save preference to backend (Fastify updates user_preferences & app_user.language)
    await preferencesStore.updatePreferences({
      gameplay: {
        language: lang
      }
    })

    // 3. Update local userProfile reactive state so modal hides
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
    <Transition name="fade">
      <div
        v-if="shouldShow"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <div
          class="relative w-full max-w-md bg-surface-dark border border-neon-cyan/30 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-neon-cyan/10 text-text-primary flex flex-col items-center text-center animate-scale-in"
        >
          <!-- Top Icon Badge -->
          <div
            class="w-16 h-16 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan mb-5 shadow-lg shadow-neon-cyan/20"
          >
            <NIcon size="32">
              <GlobeOutline />
            </NIcon>
          </div>

          <!-- Header -->
          <h2 class="text-2xl font-bold font-heading mb-2 text-gradient">
            Выберите ваш язык / Select Language
          </h2>
          <p class="text-text-secondary text-sm mb-6 leading-relaxed">
            Пожалуйста, выберите язык для интерфейса и общения с ИИ-тренером<br />
            <span class="text-xs text-text-muted">Choose your language / Wähle deine Sprache</span>
          </p>

          <!-- Language Buttons Grid -->
          <div class="flex flex-col gap-3 w-full">
            <button
              type="button"
              :disabled="isSaving"
              class="w-full py-3.5 px-5 rounded-xl bg-surface border border-border/60 hover:border-neon-cyan hover:bg-neon-cyan/10 text-text-primary font-semibold text-base flex items-center justify-between transition-all cursor-pointer group box-border disabled:opacity-50"
              @click="handleSelectLanguage('ru')"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">🇷🇺</span>
                <div class="flex flex-col items-start">
                  <span class="font-bold text-sm text-text-primary group-hover:text-neon-cyan">Русский</span>
                  <span class="text-xs text-text-muted">Russian</span>
                </div>
              </div>
              <NIcon size="20" class="text-text-muted group-hover:text-neon-cyan">
                <CheckmarkCircleOutline />
              </NIcon>
            </button>

            <button
              type="button"
              :disabled="isSaving"
              class="w-full py-3.5 px-5 rounded-xl bg-surface border border-border/60 hover:border-neon-cyan hover:bg-neon-cyan/10 text-text-primary font-semibold text-base flex items-center justify-between transition-all cursor-pointer group box-border disabled:opacity-50"
              @click="handleSelectLanguage('de')"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">🇩🇪</span>
                <div class="flex flex-col items-start">
                  <span class="font-bold text-sm text-text-primary group-hover:text-neon-cyan">Deutsch</span>
                  <span class="text-xs text-text-muted">German</span>
                </div>
              </div>
              <NIcon size="20" class="text-text-muted group-hover:text-neon-cyan">
                <CheckmarkCircleOutline />
              </NIcon>
            </button>

            <button
              type="button"
              :disabled="isSaving"
              class="w-full py-3.5 px-5 rounded-xl bg-surface border border-border/60 hover:border-neon-cyan hover:bg-neon-cyan/10 text-text-primary font-semibold text-base flex items-center justify-between transition-all cursor-pointer group box-border disabled:opacity-50"
              @click="handleSelectLanguage('en')"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl">🇬🇧</span>
                <div class="flex flex-col items-start">
                  <span class="font-bold text-sm text-text-primary group-hover:text-neon-cyan">English</span>
                  <span class="text-xs text-text-muted">English</span>
                </div>
              </div>
              <NIcon size="20" class="text-text-muted group-hover:text-neon-cyan">
                <CheckmarkCircleOutline />
              </NIcon>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes scaleIn {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.animate-scale-in {
  animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.text-gradient {
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
