<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import {
  SettingsOutline,
  LogOutOutline,
  LogInOutline,
  VolumeHighOutline,
  GameControllerOutline,
  ColorPaletteOutline
} from '@vicons/ionicons5'
import {
  NIcon,
  NSwitch,
  NDrawer,
  NDrawerContent,
  NCollapse,
  NCollapseItem,
  NSlider,
  NButton
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '../index'
import { usePreferencesStore } from '../model/preferences.store'
import { useAutoplayStore } from '@/features/autoplay'

const themeStore = useThemeStore()
const authStore = useAuthStore()
const autoplayStore = useAutoplayStore()
const preferencesStore = usePreferencesStore()

const { isAuthenticated } = storeToRefs(authStore)
const { t, locale } = useI18n()

const isOpen = ref(false)

// Computed bindings to Preferences Store
const currentBoard = computed({
  get: () => preferencesStore.preferences.theme.board,
  set: (val) => themeStore.setBoard(val)
})

const currentPieces = computed({
  get: () => preferencesStore.preferences.theme.pieces,
  set: (val) => themeStore.setPieceSet(val)
})

const animationDuration = computed({
  get: () => preferencesStore.preferences.theme.animationDuration,
  set: (val) => themeStore.setAnimationDuration(val)
})

const voiceVolume = computed({
  get: () => preferencesStore.preferences.audio.voiceVolume,
  set: (val) => preferencesStore.updatePreferences({ audio: { voiceVolume: val } })
})

const boardVolume = computed({
  get: () => preferencesStore.preferences.audio.boardVolume,
  set: (val) => preferencesStore.updatePreferences({ audio: { boardVolume: val } })
})

const selectedLanguage = computed({
  get: () => preferencesStore.preferences.gameplay.language,
  set: (val) => {
    changeLang(val)
    preferencesStore.updatePreferences({ gameplay: { language: val } })
  }
})

const globalAutoplay = computed({
  get: () => preferencesStore.preferences.gameplay.global_autoplay,
  set: (val) => preferencesStore.updatePreferences({ gameplay: { global_autoplay: val } })
})

// Delay bindings
const initialBotDelayMs = computed({
  get: () => preferencesStore.preferences.delays.initialBotDelayMs,
  set: (val) => preferencesStore.updatePreferences({ delays: { initialBotDelayMs: val } })
})
const botDelayMs = computed({
  get: () => preferencesStore.preferences.delays.botDelayMs,
  set: (val) => preferencesStore.updatePreferences({ delays: { botDelayMs: val } })
})
const nextPuzzleDelayMs = computed({
  get: () => preferencesStore.preferences.delays.nextPuzzleDelayMs,
  set: (val) => preferencesStore.updatePreferences({ delays: { nextPuzzleDelayMs: val } })
})
const restartDelayMs = computed({
  get: () => preferencesStore.preferences.delays.restartDelayMs,
  set: (val) => preferencesStore.updatePreferences({ delays: { restartDelayMs: val } })
})
const autoPlayDelayMs = computed({
  get: () => preferencesStore.preferences.delays.autoPlayDelayMs,
  set: (val) => preferencesStore.updatePreferences({ delays: { autoPlayDelayMs: val } })
})

const handleAuthAction = () => {
  if (isAuthenticated.value) {
    authStore.logout()
  } else {
    authStore.login()
  }
  isOpen.value = false
}
</script>

<template>
  <div class="settings-menu-container">
    <button
      class="settings-toggle-button"
      @click="isOpen = true"
      :title="t('features.settings.title')"
    >
      <n-icon class="settings-gear-icon">
        <SettingsOutline />
      </n-icon>
    </button>

    <n-drawer v-model:show="isOpen" :width="380" placement="right" resizable>
      <n-drawer-content closable title="Preferences" class="settings-drawer-content">
        <div class="drawer-inner-layout">
          
          <!-- Collapse Accordion Section -->
          <n-collapse :default-expanded-names="['ui']" accordion>
            
            <!-- 1. Theme & UI Styling -->
            <n-collapse-item name="ui">
              <template #header>
                <div class="collapse-header-title">
                  <n-icon><ColorPaletteOutline /></n-icon>
                  <span>{{ t('features.settings.selectBoard') }} & {{ t('features.settings.selectPieces') }}</span>
                </div>
              </template>
              
              <div class="settings-section-card">
                <div class="section-label">Chess Board</div>
                <div class="board-selector-grid">
                  <div
                    v-for="board in themeStore.availableBoards"
                    :key="board.name"
                    class="selector-item board-item"
                    :class="{ selected: board.name === currentBoard }"
                    @click="currentBoard = board.name"
                  >
                    <img :src="`/board/jpg_png/${board.thumbnailFile}`" :alt="board.name" />
                  </div>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">Chess Pieces</div>
                <div class="piece-selector-grid">
                  <div
                    v-for="pieceSet in themeStore.availablePieceSets"
                    :key="pieceSet.name"
                    class="selector-item piece-item"
                    :class="{ selected: pieceSet.name === currentPieces }"
                    @click="currentPieces = pieceSet.name"
                  >
                    <img :src="pieceSet.previewPieceFile" :alt="pieceSet.name" />
                  </div>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">Animation Duration</div>
                <div class="slider-row">
                  <n-slider v-model:value="animationDuration" :min="0" :max="500" :step="100" />
                  <span class="value-badge">{{ animationDuration }}ms</span>
                </div>
              </div>
            </n-collapse-item>

            <!-- 2. Sound & Audio Settings -->
            <n-collapse-item name="audio">
              <template #header>
                <div class="collapse-header-title">
                  <n-icon><VolumeHighOutline /></n-icon>
                  <span>{{ t('features.settings.sounds.title') }}</span>
                </div>
              </template>
              
              <div class="settings-section-card">
                <div class="section-label">{{ t('features.settings.sounds.voice') }}</div>
                <div class="slider-row">
                  <n-slider v-model:value="voiceVolume" :min="0" :max="1" :step="0.1" />
                  <span class="value-badge">{{ Math.round(voiceVolume * 100) }}%</span>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">{{ t('features.settings.sounds.board') }}</div>
                <div class="slider-row">
                  <n-slider v-model:value="boardVolume" :min="0" :max="1" :step="0.1" />
                  <span class="value-badge">{{ Math.round(boardVolume * 100) }}%</span>
                </div>
              </div>
            </n-collapse-item>

            <!-- 3. Gameplay, Language & Bot Delays -->
            <n-collapse-item name="gameplay">
              <template #header>
                <div class="collapse-header-title">
                  <n-icon><GameControllerOutline /></n-icon>
                  <span>Gameplay & Bot Delays</span>
                </div>
              </template>

              <!-- Language selector -->
              <div class="settings-section-card">
                <div class="section-label">Language</div>
                <div class="language-selector">
                  <button
                    v-for="lang in ['en', 'de', 'ru']"
                    :key="lang"
                    class="lang-btn"
                    :class="{ active: locale === lang }"
                    @click="selectedLanguage = lang as 'en' | 'de' | 'ru'"
                  >
                    {{ lang.toUpperCase() }}
                  </button>
                </div>
              </div>

              <!-- Bot Delay sliders -->
              <div class="settings-section-card">
                <div class="section-label">Initial Bot Delay</div>
                <div class="slider-row">
                  <n-slider v-model:value="initialBotDelayMs" :min="0" :max="1000" :step="50" />
                  <span class="value-badge">{{ initialBotDelayMs }}ms</span>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">Bot Thinking Delay</div>
                <div class="slider-row">
                  <n-slider v-model:value="botDelayMs" :min="0" :max="1000" :step="50" />
                  <span class="value-badge">{{ botDelayMs }}ms</span>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">Next Puzzle Delay</div>
                <div class="slider-row">
                  <n-slider v-model:value="nextPuzzleDelayMs" :min="0" :max="2000" :step="100" />
                  <span class="value-badge">{{ nextPuzzleDelayMs }}ms</span>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">Restart Delay</div>
                <div class="slider-row">
                  <n-slider v-model:value="restartDelayMs" :min="0" :max="2000" :step="100" />
                  <span class="value-badge">{{ restartDelayMs }}ms</span>
                </div>
              </div>

              <div class="settings-section-card">
                <div class="section-label">Autoplay Move Delay</div>
                <div class="slider-row">
                  <n-slider v-model:value="autoPlayDelayMs" :min="0" :max="2000" :step="100" />
                  <span class="value-badge">{{ autoPlayDelayMs }}ms</span>
                </div>
              </div>

              <!-- Dev Autoplay switch -->
              <div v-if="autoplayStore.isMo3ep" class="settings-section-card dev-autoplay-card">
                <div class="dev-autoplay-row">
                  <span class="dev-autoplay-label">Dev Autoplay</span>
                  <n-switch v-model:value="globalAutoplay" size="medium" />
                </div>
              </div>
            </n-collapse-item>
          </n-collapse>

          <!-- Bottom authentication buttons -->
          <div class="drawer-footer">
            <n-button
              block
              size="large"
              class="auth-action-btn"
              :class="{ 'logout-mode': isAuthenticated }"
              @click="handleAuthAction"
            >
              <template #icon>
                <n-icon v-if="isAuthenticated"><LogOutOutline /></n-icon>
                <n-icon v-else><LogInOutline /></n-icon>
              </template>
              {{ isAuthenticated ? t('nav.logout') : t('nav.login') }}
            </n-button>
          </div>

        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped>
.settings-menu-container {
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

/* Glassmorphism drawer content inner rules */
.drawer-inner-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
  padding-bottom: 24px;
}

.collapse-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  color: #e4e4e7;
}

.settings-section-card {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.settings-section-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #a1a1aa;
  font-weight: 700;
  margin-bottom: 10px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.value-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--neon-yellow, #f7d547);
  background: rgba(247, 213, 71, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 54px;
  text-align: center;
}

/* Board grid selector */
.board-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding: 2px;
}

/* Pieces grid selector */
.piece-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 8px;
  max-height: 150px;
  overflow-y: auto;
  padding: 2px;
}

.selector-item {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.selector-item:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.05);
}

.selector-item.selected {
  border-color: var(--neon-bordeaux, #d9004c);
  box-shadow: 0 0 8px rgba(217, 0, 76, 0.4);
}

.selector-item img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 6px;
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

/* Horizontal language buttons selector */
.language-selector {
  display: flex;
  gap: 6px;
  background: rgba(255, 255, 255, 0.02);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.lang-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #a1a1aa;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.lang-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.04);
}

.lang-btn.active {
  background: var(--neon-bordeaux, #d9004c);
  color: #fff;
  box-shadow: 0 0 12px rgba(217, 0, 76, 0.35);
}

/* Autoplay Row */
.dev-autoplay-card {
  background: rgba(217, 0, 76, 0.05);
  border: 1px dashed rgba(217, 0, 76, 0.25);
}

.dev-autoplay-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dev-autoplay-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--neon-bordeaux, #d9004c);
}

/* Drawer Footer and Auth button */
.drawer-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.auth-action-btn {
  font-weight: 800 !important;
  letter-spacing: 1px !important;
  border-radius: 8px !important;
  background-color: var(--color-accent-success, #22c55e) !important;
  color: #fff !important;
  border: none !important;
  transition: all 0.3s ease !important;
}

.auth-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
}

.auth-action-btn.logout-mode {
  background-color: var(--neon-bordeaux, #d9004c) !important;
}

.auth-action-btn.logout-mode:hover {
  box-shadow: 0 4px 15px rgba(217, 0, 76, 0.4);
}

/* Naive UI Drawer Customizations */
:deep(.n-drawer-header__title) {
  font-weight: 800 !important;
  font-size: 1.15rem !important;
  color: #fff !important;
}

:deep(.n-drawer-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
}

:deep(.n-collapse-item__header-main) {
  width: 100%;
}
</style>
