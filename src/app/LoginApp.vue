<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n({ useScope: 'global' })
const authStore = useAuthStore()

const handleLogin = async () => {
  await authStore.login(['email:read', 'preference:read'])
}

const handleChangeLang = (lang: 'en' | 'ru' | 'de') => {
  changeLang(lang)
}
</script>

<template>
  <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-void text-text-primary font-display">
    <div class="flex flex-col items-center max-w-[440px] w-[90%] text-center p-6 bg-surface/80 backdrop-blur-md border border-border rounded-lg shadow-2xl">
      <div class="mb-8 flex flex-col items-center">
        <img
          src="/webp/extra_pawn_black.webp"
          alt="Logo"
          class="w-[180px] h-auto mb-5 object-contain"
        />
        <h1 class="text-3xl font-bold tracking-[0.15em] m-0 text-neon-cyan">
          EXTRAPAWN
        </h1>
      </div>

      <div class="mb-6">
        <h2 class="text-xl font-bold mb-3 text-text-primary">
          {{ t('pages.login.welcomeTitle') }}
        </h2>
        <p class="text-sm text-text-secondary leading-relaxed">
          {{ t('pages.login.welcomeText') }}
        </p>
      </div>

      <button
        type="button"
        class="w-full py-3.5 px-8 mb-8 rounded-md bg-neon-cyan text-void font-display font-bold text-base cursor-pointer transition-all hover:bg-cyan-deep border-0"
        @click="handleLogin"
      >
        {{ t('shared.nav.loginWithLichess') }}
      </button>

      <div class="flex items-center justify-center gap-2 pt-4 border-t border-border w-4/5">
        <template v-for="(lang, idx) in ['en', 'ru', 'de'] as const" :key="lang">
          <span v-if="idx > 0" class="text-border">|</span>
          <button
            type="button"
            class="bg-transparent border-0 text-sm font-semibold cursor-pointer px-2 py-1 transition-colors"
            :class="locale === lang ? 'text-neon-cyan' : 'text-text-secondary hover:text-text-primary'"
            @click="handleChangeLang(lang)"
          >
            {{ lang.toUpperCase() }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
