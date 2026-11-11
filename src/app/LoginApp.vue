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
  <div class="fixed inset-0 z-9999 flex items-center justify-center bg-canvas text-text-primary font-display">
    <div class="flex flex-col items-center max-w-[420px] w-[90%] text-center p-8 bg-surface border border-border rounded-xl shadow-lg">
      <div class="mb-7 flex flex-col items-center">
        <img
          src="/webp/extra_pawn_black.webp"
          alt="Logo"
          width="144"
          height="144"
          fetchpriority="high"
          class="w-36 h-auto mb-4 object-contain"
        />
        <h1 class="brand-text text-2xl m-0">
          EXTRAPAWN
        </h1>
      </div>

      <div class="mb-6">
        <h2 class="text-lg font-semibold mb-2 text-text-primary">
          {{ t('pages.login.welcomeTitle') }}
        </h2>
        <p class="text-sm text-text-secondary leading-relaxed">
          {{ t('pages.login.welcomeText') }}
        </p>
      </div>

      <button
        type="button"
        class="w-full py-3 px-6 mb-6 rounded-md bg-brand text-on-brand font-display font-medium text-sm cursor-pointer transition-colors hover:bg-brand-deep border-0"
        @click="handleLogin"
      >
        {{ t('shared.nav.loginWithLichess') }}
      </button>

      <div class="flex items-center justify-center gap-2 pt-4 border-t border-border w-full">
        <template v-for="(lang, idx) in ['en', 'ru', 'de'] as const" :key="lang">
          <span v-if="idx > 0" class="text-border">|</span>
          <button
            type="button"
            class="bg-transparent border-0 text-xs font-medium cursor-pointer px-2.5 py-1 rounded-sm transition-colors"
            :class="
              locale === lang
                ? 'bg-elevated text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleChangeLang(lang)"
          >
            {{ lang.toUpperCase() }}
          </button>
        </template>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-text-secondary">
        <a
          href="/about"
          class="text-text-secondary no-underline transition-colors hover:text-brand"
        >
          {{ t('shared.nav.about') }}
        </a>
        <span class="text-border">•</span>
        <a
          href="/legal#imprint"
          class="text-text-secondary no-underline transition-colors hover:text-brand"
        >
          {{ t('legal.tabs.imprint') }}
        </a>
        <span class="text-border">•</span>
        <a
          href="/legal#privacy"
          class="text-text-secondary no-underline transition-colors hover:text-brand"
        >
          {{ t('legal.tabs.privacy') }}
        </a>
        <span class="text-border">•</span>
        <a
          href="/legal#terms"
          class="text-text-secondary no-underline transition-colors hover:text-brand"
        >
          {{ t('legal.tabs.terms') }}
        </a>
      </div>
    </div>
  </div>
</template>
