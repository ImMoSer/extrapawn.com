<!-- src/features/engine/ui/EngineSelector.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import i18n from '@/shared/config/i18n'
import type { EngineId } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ENGINE_NAMES } from '../config/constants'
import { useEngineSelectionStore } from '../model/engine-selection.store'

const engineStore = useEngineSelectionStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const t = i18n.global.t

const isAuthenticated = computed(() => authStore.isAuthenticated)

const availableEngines = computed(() => engineStore.availableEngines)
const selectedEngine = computed(() => engineStore.selectedEngine)

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
      t('features.auth.requiredForAction'),
      t('features.userCabinet.loginPrompt'),
      {
        confirmText: t('nav.loginWithLichess'),
        showCancel: true,
      },
    )

    if (userConfirmedLogin === 'confirm') {
      authStore.login()
    }
  }
}

const selectEngine = (engine: EngineId) => {
  engineStore.setEngine(engine)
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
  <div class="engine-selector" ref="dropdownRef" @click="handleEngineSelectorClick">
    <button
      class="selector-toggle"
      :disabled="!isAuthenticated"
      :title="!isAuthenticated ? t('features.auth.requiredForAction') : t('features.engine.select')"
    >
      {{ ENGINE_NAMES[selectedEngine] }}
      <span class="selector-arrow" :class="{ 'is-open': isOpen }">▼</span>
    </button>
    <div v-if="isOpen && isAuthenticated" class="engine-dropdown">
      <button
        v-for="engine in availableEngines"
        :key="engine"
        class="engine-item"
        :class="{ active: engine === selectedEngine }"
        @click.stop="selectEngine(engine)"
      >
        {{ ENGINE_NAMES[engine] }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.engine-selector {
  position: relative;
  display: flex;
  justify-content: flex-end;
  width: 100%;
  max-width: 250px;
}

.selector-toggle {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-default);
  border: 1px solid var(--color-border);
  border-radius: var(--panel-border-radius);
  padding: 10px 10px;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  transition:
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.selector-toggle:hover:not(:disabled) {
  border-color: var(--color-accent-primary);
}

.selector-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.selector-arrow {
  margin-left: 0px;
  font-size: var(--font-size-xsmall);
  transition: transform 0.2s ease;
}

.selector-arrow.is-open {
  transform: rotate(180deg);
}

.engine-dropdown {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-hover);
  border-radius: var(--panel-border-radius);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  z-index: 1010;
  width: 100%;
  max-height: 60vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.engine-item {
  background: none;
  border: none;
  color: var(--color-text-default);
  padding: 10px 15px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-size: var(--font-size-small);
  transition: background-color 0.2s ease;
}

.engine-item:hover {
  background-color: var(--color-border-hover);
}

.engine-item.active {
  background-color: var(--color-accent-primary);
  color: var(--color-text-dark);
  font-weight: bold;
}

/* Скрываем полосу прокрутки */
.engine-dropdown::-webkit-scrollbar {
  width: 5px;
}

.engine-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.engine-dropdown::-webkit-scrollbar-thumb {
  background: var(--color-border-hover);
  border-radius: 5px;
}

@media (orientation: portrait) {
  .selector-toggle,
  .engine-item {
    padding: 5px 5px;
    font-size: var(--font-size-xsmall);
  }
}
</style>
