<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LogInOutline } from '@vicons/ionicons5'
import { GAME_MODES } from '@/shared/config/gameModes.config'

const authStore = useAuthStore()
const { t, locale } = useI18n()

const { isAuthenticated, isLoading, error } = storeToRefs(authStore)

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
  GAME_MODES.user_cabinet,
]

const isMobile = ref(false)
const updateMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  updateMobile()
  window.addEventListener('resize', updateMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobile)
})

const filteredMenuItems = computed(() => {
  return menuItems
})
</script>

<template>
  <div
    class="box-border flex h-full w-full items-start justify-center overflow-y-auto px-3 py-5 md:items-center md:overflow-hidden md:p-2.5"
  >
    <div
      class="relative z-10 flex h-auto max-h-none w-full max-w-[1000px] flex-col items-center justify-center gap-4 md:max-h-full md:gap-[2vh]"
    >
      <!-- Hero Section -->
      <div class="flex shrink-0 flex-col items-center gap-2 md:gap-[15px]">
        <div class="flex flex-col items-center gap-2 md:gap-5">
          <img
            src="/webp/extra_pawn_black.webp"
            alt="EXTRAPAWN"
            class="h-20 w-auto drop-shadow-[0_0_15px_color-mix(in_srgb,var(--color-neon-cyan)_20%,transparent)] md:h-[clamp(100px,25vh,500px)]"
          />
          <div class="flex flex-col items-center gap-1 md:gap-[5px]">
            <h1 class="brand-text m-0 text-[2rem] leading-none md:text-[clamp(2rem,6vw,4.5rem)]">
              EXTRAPAWN
            </h1>
            <p
              class="m-0 text-center text-xs font-normal tracking-[0.15rem] text-text-secondary uppercase opacity-70 md:text-[clamp(0.7rem,1.5vw,1.2rem)] md:tracking-[0.25rem]"
            >
              {{ t('pages.welcome.slogan') }}
            </p>
          </div>
        </div>

        <!-- Login Button (Visible only if not authenticated) -->
        <div v-if="!isAuthenticated" class="mt-[5px]">
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
      <n-grid
        :x-gap="isMobile ? 10 : 20"
        :y-gap="isMobile ? 10 : 20"
        cols="2 s:3 m:3 l:3"
        responsive="screen"
        class="flex max-h-none w-full grow content-center justify-center md:max-h-[60vh]"
      >
        <n-grid-item v-for="item in filteredMenuItems" :key="item.path">
          <router-link :to="item.path" custom v-slot="{ navigate }">
            <n-card
              hoverable
              class="group relative flex h-full cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border border-border bg-surface/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-[var(--card-glow-color)] hover:bg-elevated/80 hover:shadow-[0_0_25px_-5px_var(--card-glow-color)] md:rounded-[var(--radius-lg)]"
              :content-style="{
                padding: '0',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }"
              @click="navigate"
              :bordered="false"
              :style="{ '--card-glow-color': item.color }"
            >
              <div
                class="relative z-10 flex w-full flex-col items-center justify-center gap-1.5 px-2 py-3 text-center md:gap-2 md:px-4 md:py-6"
              >
                <n-icon
                  :size="isMobile ? 24 : 34"
                  :color="item.color"
                  class="transition-transform duration-300 group-hover:scale-110"
                >
                  <component :is="item.icon" />
                </n-icon>
                <n-text
                  class="font-display text-[0.8rem] font-bold tracking-[1px] text-text-primary uppercase transition-colors duration-300 group-hover:text-text-primary md:text-[1.1rem] md:tracking-[1.5px]"
                >
                  {{ t(item.labelKey) }}
                </n-text>
              </div>
            </n-card>
          </router-link>
        </n-grid-item>
      </n-grid>

      <!-- Language Switcher -->
      <div class="mt-auto shrink-0 py-2.5">
        <n-space justify="center" size="small">
          <button
            class="cursor-pointer border-none bg-transparent px-1.5 text-[0.9rem] transition-colors"
            :class="
              locale === 'en'
                ? 'font-bold text-neon-cyan'
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
                ? 'font-bold text-neon-cyan'
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
                ? 'font-bold text-neon-cyan'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleChangeLang('de')"
          >
            DE
          </button>
        </n-space>
      </div>
    </div>
  </div>
</template>
