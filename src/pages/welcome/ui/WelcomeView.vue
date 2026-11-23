<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { GAME_MODES } from '@/shared/config/gameModes.config'
import { changeLang } from '@/shared/config/i18n'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import { LogInOutline } from '@vicons/ionicons5'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getRandomChessQuote,
  loadChessQuotes,
  type ChessQuote,
} from '../model/quotes.service'

const authStore = useAuthStore()
const { t, locale } = useI18n()

const { isAuthenticated, isLoading, error } = storeToRefs(authStore)

const quotesList = ref<ChessQuote[]>([])
const currentQuote = ref<ChessQuote | null>(null)

const localizedQuoteText = computed(() => {
  if (!currentQuote.value) {
    return ''
  }
  return locale.value === 'ru' ? currentQuote.value.translation_ru : currentQuote.value.text
})

const selectNextRandomQuote = () => {
  if (quotesList.value.length === 0) {
    return
  }
  currentQuote.value = getRandomChessQuote(quotesList.value, currentQuote.value?.id)
}

const handleLogin = async () => {
  if (isLoading.value) {
    return
  }
  await authStore.login()
}

const handleChangeLang = (lang: 'en' | 'ru' | 'de') => {
  changeLang(lang)
}

const menuItems = [
  GAME_MODES.training_center,
  GAME_MODES.warmup,
  GAME_MODES.courses,
  GAME_MODES.user_cabinet,
]

onMounted(async () => {
  const loadedQuotes = await loadChessQuotes()
  quotesList.value = loadedQuotes
  currentQuote.value = getRandomChessQuote(loadedQuotes)
})
</script>

<template>
  <AppPageShell vertical-center>
    <div class="relative z-10 flex w-full flex-col items-center justify-center gap-5 @3xl:gap-7">
      <!-- Hero Section -->
      <div class="flex shrink-0 flex-col items-center gap-3 @3xl:gap-4">
        <div class="flex flex-col items-center gap-2.5 @3xl:gap-4">
          <img
            src="/webp/extra_pawn_black.webp"
            alt="EXTRAPAWN"
            width="256"
            height="256"
            fetchpriority="high"
            class="h-24 w-auto object-contain @2xl:h-[clamp(112px,22dvh,260px)]"
          />
          <div class="flex flex-col items-center gap-1.5 @3xl:gap-2">
            <h1 class="brand-text m-0 text-[2rem] leading-none @2xl:text-[clamp(2.25rem,4.5vw,3.75rem)]">
              EXTRAPAWN
            </h1>
            <blockquote
              v-if="currentQuote"
              class="m-0 flex max-w-[680px] cursor-pointer flex-col items-center gap-1 px-2 text-center transition-opacity duration-200 select-none hover:opacity-100"
              @click="selectNextRandomQuote"
            >
              <p
                class="m-0 text-xs leading-relaxed font-normal text-text-secondary italic @2xl:text-[0.95rem]"
              >
                "{{ localizedQuoteText }}"
              </p>
              <footer
                class="text-[0.7rem] font-medium tracking-[0.08rem] text-text-primary @2xl:text-[0.85rem]"
              >
                - {{ currentQuote.author }} -
              </footer>
            </blockquote>
          </div>
        </div>

        <!-- Login Button (Visible only if not authenticated) -->
        <div v-if="!isAuthenticated" class="mt-1">
          <n-button
            type="primary"
            size="large"
            :loading="isLoading"
            @click="handleLogin"
          >
            <template #icon>
              <n-icon><LogInOutline /></n-icon>
            </template>
            {{ t('shared.nav.loginWithLichess') }}
          </n-button>
        </div>

        <n-text v-if="error" type="error">
          {{ `Error: ${error}` }}
        </n-text>
      </div>

      <!-- Mode Selection Grid -->
      <div class="grid w-full grid-cols-2 gap-3 @3xl:gap-5">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          custom
          v-slot="{ navigate }"
        >
          <n-card
            hoverable
            class="group relative flex h-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hover hover:bg-elevated"
            :content-style="{
              padding: '0',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }"
            :bordered="false"
            @click="navigate"
          >
            <div
              class="relative z-10 flex w-full flex-col items-center justify-center gap-2 px-3 py-5 text-center @3xl:gap-2.5 @3xl:px-5 @3xl:py-8"
            >
              <n-icon
                :color="item.color"
                class="text-[26px] transition-transform duration-200 group-hover:scale-105 @3xl:text-[34px]"
              >
                <component :is="item.icon" />
              </n-icon>
              <n-text
                class="font-display text-[0.8rem] font-bold tracking-[1px] text-text-primary uppercase transition-colors duration-200 @3xl:text-[1.05rem] @3xl:tracking-[1.5px]"
              >
                {{ t(item.labelKey) }}
              </n-text>
            </div>
          </n-card>
        </router-link>

        <!-- Owner-only AI Study tile -->
        <router-link
          v-if="authStore.isOwner"
          :to="GAME_MODES.study.path"
          custom
          v-slot="{ navigate }"
        >
          <n-card
            hoverable
            class="group relative col-span-2 flex h-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-brand/40 bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:bg-elevated"
            :content-style="{
              padding: '0',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }"
            :bordered="false"
            @click="navigate"
          >
            <div
              class="relative z-10 flex w-full items-center justify-center gap-3 px-4 py-4 text-center @3xl:py-5"
            >
              <n-icon
                :color="GAME_MODES.study.color"
                class="text-[26px] transition-transform duration-200 group-hover:scale-105 @3xl:text-[30px]"
              >
                <component :is="GAME_MODES.study.icon" />
              </n-icon>
              <n-text
                class="font-display text-[0.85rem] font-bold tracking-[1.2px] text-text-primary uppercase @3xl:text-[1.05rem] @3xl:tracking-[1.5px]"
              >
                {{ t(GAME_MODES.study.labelKey) }}
              </n-text>
              <span
                class="rounded-sm border border-brand/50 bg-elevated px-1.5 py-0.5 font-condensed text-[0.68rem] font-bold tracking-wider text-brand uppercase"
              >
                AI
              </span>
            </div>
          </n-card>
        </router-link>
      </div>

      <!-- Language Switcher -->
      <div class="shrink-0 py-2">
        <n-space justify="center" size="small">
          <button
            class="cursor-pointer border-none bg-transparent px-1.5 text-[0.9rem] transition-colors"
            :class="
              locale === 'en'
                ? 'font-bold text-text-primary underline underline-offset-4'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleChangeLang('en')"
          >
            EN
          </button>
          <span class="text-text-secondary opacity-50">|</span>
          <button
            class="cursor-pointer border-none bg-transparent px-1.5 text-[0.9rem] transition-colors"
            :class="
              locale === 'ru'
                ? 'font-bold text-text-primary underline underline-offset-4'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleChangeLang('ru')"
          >
            RU
          </button>
          <span class="text-text-secondary opacity-50">|</span>
          <button
            class="cursor-pointer border-none bg-transparent px-1.5 text-[0.9rem] transition-colors"
            :class="
              locale === 'de'
                ? 'font-bold text-text-primary underline underline-offset-4'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleChangeLang('de')"
          >
            DE
          </button>
        </n-space>
      </div>
    </div>
  </AppPageShell>
</template>
