<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import i18n from '@/shared/config/i18n'
import { AVAILABLE_ENGINES, ENGINE_NAMES, type EngineId } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const preferencesStore = usePreferencesStore()
const gameStore = useGameStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const t = i18n.global.t

const isAuthenticated = computed(() => authStore.isAuthenticated)

const availableEngines = computed(() => AVAILABLE_ENGINES)
const selectedEngine = computed(() => preferencesStore.selectedBotEngine)

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const handleEngineSelectorClick = async () => {
  if (isAuthenticated.value) {
    toggleDropdown()
  } else {
    const userConfirmedLogin = await uiStore.showConfirmation(
      t('shared.auth.requiredForAction'),
      t('pages.userCabinet.loginPrompt'),
      {
        confirmText: t('shared.nav.loginWithLichess'),
        showCancel: true,
      },
    )

    if (userConfirmedLogin === 'confirm') {
      void authStore.login()
    }
  }
}

const selectEngine = (engine: EngineId) => {
  void preferencesStore.setBotEngine(engine)
  gameStore.setBotEngineId(engine)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="dropdownRef"
    class="relative flex w-full max-w-[250px] justify-end"
    @click="handleEngineSelectorClick"
  >
    <button
      class="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-elevated px-2.5 py-2 text-xs font-bold whitespace-nowrap text-text-primary transition-colors hover:enabled:border-neon-cyan disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5 sm:text-sm"
      :disabled="!isAuthenticated"
      :title="!isAuthenticated ? t('shared.auth.requiredForAction') : t('features.engine.select')"
    >
      {{ ENGINE_NAMES[selectedEngine] }}
      <span
        class="text-xs transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      >
        ▼
      </span>
    </button>
    <div
      v-if="isOpen && isAuthenticated"
      class="absolute top-[calc(100%+5px)] right-0 z-[1010] flex max-h-[60vh] w-max min-w-full flex-col overflow-y-auto rounded-xl border border-border-hover bg-surface"
    >
      <button
        v-for="engine in availableEngines"
        :key="engine"
        class="w-full cursor-pointer border-none px-3.5 py-2 text-left text-xs whitespace-nowrap transition-colors sm:py-2.5 sm:text-sm"
        :class="
          engine === selectedEngine
            ? 'bg-neon-cyan font-bold text-void'
            : 'bg-transparent text-text-primary hover:bg-border-hover'
        "
        @click.stop="selectEngine(engine)"
      >
        {{ ENGINE_NAMES[engine] }}
      </button>
    </div>
  </div>
</template>
