<!-- src/components/SettingsMenu.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import { soundService } from '@/shared/lib/sound.service'
import { SettingsOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '../index'

const themeStore = useThemeStore()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)
const { t, locale } = useI18n()

const isOpen = ref(false)
const activePanel = ref<'main' | 'board' | 'pieces' | 'sounds' | 'animation'>('main')
const dropdownPosition = ref({ top: '0px', left: '0px' })
const toggleButton = ref<HTMLButtonElement | null>(null)

const voiceVolume = ref(soundService.getVoiceVolume())
const boardVolume = ref(soundService.getBoardVolume())

const animationDuration = computed({
  get: () => themeStore.currentTheme.animationDuration,
  set: (value) => themeStore.setAnimationDuration(value),
})

const toggleMenu = async (event: MouseEvent) => {
  event.stopPropagation()
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    if (toggleButton.value) {
      const rect = toggleButton.value.getBoundingClientRect()
      const isLandscape = window.matchMedia(
        '(orientation: landscape) and (min-width: 769px)',
      ).matches
      if (isLandscape) {
        dropdownPosition.value = {
          top: `${rect.top}px`,
          left: `${rect.right + 10}px`,
        }
      } else {
        dropdownPosition.value = {
          top: `${rect.bottom + 10}px`,
          left: `${rect.right - 250}px`, // 250 is the width of the dropdown
        }
      }
    }
  }
  if (!isOpen.value) {
    activePanel.value = 'main'
  }
}

const handleBoardChange = (boardName: string) => {
  themeStore.setBoard(boardName)
}

const handlePieceSetChange = (pieceSetName: string) => {
  themeStore.setPieceSet(pieceSetName)
}

const handleLanguageChange = (lang: 'en' | 'ru' | 'de') => {
  changeLang(lang)
}

const handleVoiceVolumeChange = (event: Event) => {
  const value = parseFloat((event.target as HTMLInputElement).value)
  voiceVolume.value = value
  soundService.setVoiceVolume(value)
}

const handleBoardVolumeChange = (event: Event) => {
  const value = parseFloat((event.target as HTMLInputElement).value)
  boardVolume.value = value
  soundService.setBoardVolume(value)
}

const handleAnimationDurationChange = (event: Event) => {
  const value = parseInt((event.target as HTMLInputElement).value, 10)
  animationDuration.value = value
}

const handleAuthAction = () => {
  if (isAuthenticated.value) {
    authStore.logout()
  } else {
    authStore.login()
  }
  closeMenu()
}

const closeMenu = () => {
  isOpen.value = false
  activePanel.value = 'main'
}

onMounted(() => {
  window.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu)
})
</script>

<template>
  <div class="settings-menu-container" @click.stop>
    <button
      ref="toggleButton"
      class="settings-toggle-button"
      @click="toggleMenu"
      :title="t('features.settings.title')"
    >
      <n-icon class="settings-gear-icon">
        <SettingsOutline />
      </n-icon>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="dropdown-menu" :style="dropdownPosition" @click.stop>
        <!-- Главная панель -->
        <div v-if="activePanel === 'main'" class="panel main-panel">
          <div class="language-switcher">
            <div class="language-buttons">
              <button
                class="lang-button"
                :class="{ active: locale === 'en' }"
                @click="handleLanguageChange('en')"
              >
                EN
              </button>
              <button
                class="lang-button"
                :class="{ active: locale === 'ru' }"
                @click="handleLanguageChange('ru')"
              >
                RU
              </button>
              <button
                class="lang-button"
                :class="{ active: locale === 'de' }"
                @click="handleLanguageChange('de')"
              >
                DE
              </button>
            </div>
          </div>
          <button class="panel-button" @click="activePanel = 'board'">
            {{ t('features.settings.selectBoard') }}
          </button>
          <button class="panel-button" @click="activePanel = 'pieces'">
            {{ t('features.settings.selectPieces') }}
          </button>
          <button class="panel-button" @click="activePanel = 'animation'">
            {{ t('features.settings.animation.title') }}
          </button>
          <button class="panel-button" @click="activePanel = 'sounds'">
            {{ t('features.settings.sounds.title') }}
          </button>
          <button class="panel-button auth-button" @click="handleAuthAction">
            {{ isAuthenticated ? t('nav.logout') : t('nav.login') }}
          </button>
        </div>

        <!-- Панель выбора доски -->
        <div v-if="activePanel === 'board'" class="panel">
          <div class="panel-header">
            <button class="back-button" @click="activePanel = 'main'">
              &lt; {{ t('features.settings.back') }}
            </button>
            <h4>{{ t('features.settings.selectBoard') }}</h4>
          </div>
          <div class="board-selector-grid">
            <div
              v-for="board in themeStore.availableBoards"
              :key="board.name"
              class="selector-item board-item"
              :class="{ selected: board.name === themeStore.currentTheme.board }"
              @click="handleBoardChange(board.name)"
            >
              <img :src="`/board/jpg_png/${board.thumbnailFile}`" :alt="board.name" />
            </div>
          </div>
        </div>

        <!-- Панель выбора фигур -->
        <div v-if="activePanel === 'pieces'" class="panel">
          <div class="panel-header">
            <button class="back-button" @click="activePanel = 'main'">
              &lt; {{ t('features.settings.back') }}
            </button>
            <h4>{{ t('features.settings.selectPieces') }}</h4>
          </div>
          <div class="piece-selector-list">
            <div
              v-for="pieceSet in themeStore.availablePieceSets"
              :key="pieceSet.name"
              class="selector-item piece-item"
              :class="{ selected: pieceSet.name === themeStore.currentTheme.pieces }"
              @click="handlePieceSetChange(pieceSet.name)"
            >
              <img :src="pieceSet.previewPieceFile" :alt="pieceSet.name" />
            </div>
          </div>
        </div>

        <!-- Панель настроек анимации -->
        <div v-if="activePanel === 'animation'" class="panel">
          <div class="panel-header">
            <button class="back-button" @click="activePanel = 'main'">
              &lt; {{ t('features.settings.back') }}
            </button>
            <h4>{{ t('features.settings.animation.title') }}</h4>
          </div>
          <div class="animation-settings">
            <div class="setting-item">
              <label for="animation-duration">{{
                t('features.settings.animation.duration')
              }}</label>
              <input
                id="animation-duration"
                type="range"
                min="0"
                max="500"
                step="100"
                :value="animationDuration"
                @input="handleAnimationDurationChange"
                class="volume-slider"
              />
              <span class="duration-value">{{ animationDuration }}ms</span>
            </div>
          </div>
        </div>

        <!-- Панель настроек звука -->
        <div v-if="activePanel === 'sounds'" class="panel">
          <div class="panel-header">
            <button class="back-button" @click="activePanel = 'main'">
              &lt; {{ t('features.settings.back') }}
            </button>
            <h4>{{ t('features.settings.sounds.title') }}</h4>
          </div>
          <div class="sound-settings">
            <div class="volume-slider-container">
              <label for="voice-volume">{{ t('features.settings.sounds.voice') }}</label>
              <input
                id="voice-volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                :value="voiceVolume"
                @input="handleVoiceVolumeChange"
                class="volume-slider"
              />
            </div>
            <div class="volume-slider-container">
              <label for="board-volume">{{ t('features.settings.sounds.board') }}</label>
              <input
                id="board-volume"
                type="range"
                min="0"
                max="1"
                step="0.1"
                :value="boardVolume"
                @input="handleBoardVolumeChange"
                class="volume-slider"
              />
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.settings-menu-container {
  position: relative;
  display: inline-block;
}

.settings-toggle-button {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  transition: transform 0.3s ease;
}

.settings-gear-icon {
  font-size: 1.85rem;
  color: var(--neon-yellow);
  filter: drop-shadow(0 0 8px rgba(255, 230, 0, 0.3));
}

.settings-toggle-button:hover {
  transform: rotate(60deg) scale(1.1);
}

.dropdown-menu {
  position: fixed;
  margin-top: 10px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-hover);
  border-radius: var(--panel-border-radius);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  width: 250px;
  padding: 10px;
}

.panel-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}
.panel-header h4 {
  margin: 0;
  flex-grow: 1;
  text-align: center;
  color: var(--color-text-muted);
}
.back-button {
  background: none;
  border: none;
  color: var(--color-text-link);
  cursor: pointer;
  font-size: var(--font-size-small);
}

.main-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-button {
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-default);
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 100%;
  text-align: left;
}
.panel-button:hover {
  background-color: var(--color-border-hover);
}

.board-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
  max-height: 40vh;
  overflow-y: auto;
}

.piece-selector-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 10px;
  max-height: 40vh;
  overflow-y: auto;
}

.selector-item {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  transition: all 0.2s ease-in-out;
  padding: 4px;
  background-color: var(--color-bg-tertiary);
}
.selector-item:hover {
  transform: scale(1.05);
}
.selector-item.selected {
  border-color: var(--color-accent-success);
}
.selector-item img {
  width: 100%;
  display: block;
  border-radius: 4px;
}
.piece-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
}
.piece-item img {
  max-width: 80%;
  max-height: 80%;
}

.auth-button {
  margin-top: 10px;
  border-top: 1px solid var(--color-border);
  padding-top: 10px;
}

.language-switcher {
  display: flex;
  justify-content: center;
  align-items: center;
}
.language-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--color-bg-primary);
  padding: 4px;
  border-radius: 5px;
}
.lang-button {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 4px 8px;
  border-radius: 3px;
}
.lang-button:hover {
  color: var(--color-text-default);
}
.lang-button.active {
  color: var(--color-text-on-accent);
  background-color: var(--color-accent-primary);
}

.sound-settings,
.animation-settings {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px 0;
}

.volume-slider-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.volume-slider-container label,
.setting-item label {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.volume-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: 5px;
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.volume-slider:hover {
  opacity: 1;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--color-accent-primary);
  cursor: pointer;
  border-radius: 50%;
}

.volume-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--color-accent-primary);
  cursor: pointer;
  border-radius: 50%;
  border: none;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.duration-value {
  font-size: var(--font-size-small);
  color: var(--color-text-default);
  min-width: 50px;
  text-align: right;
}
</style>
