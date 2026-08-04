<script setup lang="ts">
import { ref, watch } from 'vue'
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
import { usePreferencesStore, type UserPreferencesDto } from '../model/preferences.store'
import { useCrashtestStore } from '@/features/crashtest'

const themeStore = useThemeStore()
const authStore = useAuthStore()
const crashtestStore = useCrashtestStore()
const preferencesStore = usePreferencesStore()

const { isAuthenticated } = storeToRefs(authStore)
const { t } = useI18n()

const isOpen = ref(false)
const boardTabRef = ref<HTMLElement | null>(null)
const expandedCollapseNames = ref<string[]>([])

const handleCollapseChange = (expandedNames: string[]) => {
  if (expandedNames.includes('board_pieces')) {
    setTimeout(() => {
      boardTabRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 150)
  }
}

// Local draft preferences state that is cloned from the store when opening the drawer
const draftPreferences = ref<UserPreferencesDto>(
  JSON.parse(JSON.stringify(preferencesStore.preferences))
)

const initializeDraft = () => {
  draftPreferences.value = JSON.parse(JSON.stringify(preferencesStore.preferences))
}

// Re-initialize draft when the drawer is opened
watch(isOpen, (newVal) => {
  if (newVal) {
    initializeDraft()
  }
})

const handleSave = async () => {
  // Apply language change
  changeLang(draftPreferences.value.gameplay.language)
  // Save updated preferences to store & backend
  await preferencesStore.updatePreferences(draftPreferences.value)
  // Close the drawer
  isOpen.value = false
}

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

    <n-drawer
      v-model:show="isOpen"
      :width="380"
      placement="right"
      resizable
      class="settings-drawer"
    >
      <n-drawer-content closable :title="t('features.settings.title')" class="settings-drawer-content">
        <div class="drawer-inner-layout">
          
          <!-- 1. Top level Language Selector -->
          <div class="settings-section-card language-section-card">
            <div class="section-label">{{ t('features.settings.language') }}</div>
            <div class="language-selector">
              <button
                v-for="lang in ['en', 'de', 'ru']"
                :key="lang"
                class="lang-btn"
                :class="{ active: draftPreferences.gameplay.language === lang }"
                @click="draftPreferences.gameplay.language = lang as 'en' | 'de' | 'ru'"
              >
                {{ lang.toUpperCase() }}
              </button>
            </div>
          </div>

          <!-- 2. Sound & Audio Settings (Top level) -->
          <div class="settings-section-card">
            <div class="section-label" style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <n-icon><VolumeHighOutline /></n-icon>
              <span>{{ t('features.settings.sounds.title') }}</span>
            </div>
            
            <div style="margin-bottom: 10px;">
              <div class="section-label" style="font-size: 0.7rem; color: #71717a;">{{ t('features.settings.sounds.voice') }}</div>
              <div class="slider-row">
                <n-slider v-model:value="draftPreferences.audio.voiceVolume" :min="0" :max="1" :step="0.1" />
                <span class="value-badge">{{ Math.round(draftPreferences.audio.voiceVolume * 100) }}%</span>
              </div>
            </div>

            <div>
              <div class="section-label" style="font-size: 0.7rem; color: #71717a;">{{ t('features.settings.sounds.board') }}</div>
              <div class="slider-row">
                <n-slider v-model:value="draftPreferences.audio.boardVolume" :min="0" :max="1" :step="0.1" />
                <span class="value-badge">{{ Math.round(draftPreferences.audio.boardVolume * 100) }}%</span>
              </div>
            </div>
          </div>

          <!-- 3. Animation Duration (Top level, extracted from board tab) -->
          <div class="settings-section-card">
            <div class="section-label">{{ t('features.settings.animationDuration') }}</div>
            <div class="slider-row">
              <n-slider v-model:value="draftPreferences.theme.animationDuration" :min="0" :max="500" :step="50" />
              <span class="value-badge">{{ draftPreferences.theme.animationDuration }}ms</span>
            </div>
          </div>

          <!-- 4. Gameplay & Bot Delays (Top level) -->
          <div class="settings-section-card">
            <div class="section-label" style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
              <n-icon><GameControllerOutline /></n-icon>
              <span>{{ t('features.settings.gameplayBotDelays') }}</span>
            </div>

            <!-- Bot Thinking Delay -->
            <div style="margin-bottom: 12px;">
              <div class="section-label" style="font-size: 0.7rem; color: #71717a;">{{ t('features.settings.botThinkingDelay') }}</div>
              <div class="slider-row">
                <n-slider v-model:value="draftPreferences.delays.botDelayMs" :min="50" :max="5000" :step="50" />
                <span class="value-badge">{{ draftPreferences.delays.botDelayMs }}ms</span>
              </div>
            </div>

            <!-- Dev Crashtest Move Delay -->
            <div v-if="crashtestStore.isMo3ep" class="settings-section-card dev-crashtest-card" style="margin-bottom: 8px;">
              <div class="section-label" style="color: var(--neon-bordeaux, #d9004c); font-weight: bold;">Crashtest Speed (Overrides All)</div>
              <div class="slider-row">
                <n-slider v-model:value="draftPreferences.delays.crashtestDelayMs" :min="0" :max="1000" :step="50" />
                <span class="value-badge" style="background: rgba(217, 0, 76, 0.2); border-color: rgba(217, 0, 76, 0.4);">{{ draftPreferences.delays.crashtestDelayMs }}ms</span>
              </div>
            </div>

            <!-- Dev Crashtest switch -->
            <div v-if="crashtestStore.isMo3ep" class="settings-section-card dev-crashtest-card" style="margin-bottom: 8px;">
              <div class="dev-crashtest-row">
                <span class="dev-crashtest-label">{{ t('features.settings.devCrashtest') }}</span>
                <n-switch v-model:value="draftPreferences.gameplay.global_crashtest" size="medium" />
              </div>
            </div>          </div>

          <!-- 5. Board & Pieces Tab at the Bottom -->
          <div ref="boardTabRef">
            <n-collapse v-model:expanded-names="expandedCollapseNames" @update:expanded-names="handleCollapseChange">
              <n-collapse-item name="board_pieces">
                <template #header>
                  <div class="collapse-header-title">
                    <n-icon><ColorPaletteOutline /></n-icon>
                    <span>{{ t('features.settings.selectBoard') }} & {{ t('features.settings.selectPieces') }}</span>
                  </div>
                </template>
                
                <div class="settings-section-card">
                  <div class="section-label">{{ t('features.settings.board') }}</div>
                  <div class="board-selector-grid">
                    <div
                      v-for="board in themeStore.availableBoards"
                      :key="board.name"
                      class="selector-item board-item"
                      :class="{ selected: board.name === draftPreferences.theme.board }"
                      @click="draftPreferences.theme.board = board.name"
                    >
                      <img :src="`/board/jpg_png/${board.thumbnailFile}`" :alt="board.name" />
                    </div>
                  </div>
                </div>

                <div class="settings-section-card">
                  <div class="section-label">{{ t('features.settings.pieces') }}</div>
                  <div class="piece-selector-grid">
                    <div
                      v-for="pieceSet in themeStore.availablePieceSets"
                      :key="pieceSet.name"
                      class="selector-item piece-item"
                      :class="{ selected: pieceSet.name === draftPreferences.theme.pieces }"
                      @click="draftPreferences.theme.pieces = pieceSet.name"
                    >
                      <img :src="pieceSet.previewPieceFile" :alt="pieceSet.name" />
                    </div>
                  </div>
                </div>
              </n-collapse-item>
            </n-collapse>
          </div>

          <!-- Bottom Save and authentication buttons -->
          <div class="drawer-footer">
            <n-button
              block
              size="large"
              class="save-btn"
              @click="handleSave"
            >
              {{ t('features.settings.save') }}
            </n-button>

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
              {{ isAuthenticated ? t('shared.nav.logout') : t('shared.nav.login') }}
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

/* Crashtest Row */
.dev-crashtest-card {
  background: rgba(217, 0, 76, 0.05);
  border: 1px dashed rgba(217, 0, 76, 0.25);
}

.dev-crashtest-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dev-crashtest-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--neon-bordeaux, #d9004c);
}



/* Drawer Footer and Auth/Save buttons */
.drawer-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.save-btn {
  font-weight: 800 !important;
  letter-spacing: 1px !important;
  border-radius: 8px !important;
  background: linear-gradient(135deg, var(--neon-cyan, #00e5ff), var(--neon-blue, #0055ff)) !important;
  color: #fff !important;
  border: none !important;
  transition: all 0.3s ease !important;
}

.save-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 229, 255, 0.4);
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

<style>
.settings-drawer,
.settings-drawer .n-drawer-content {
  background-color: var(--bg-1, #0a0b14) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
</style>
