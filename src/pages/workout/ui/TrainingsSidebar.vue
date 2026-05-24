<!-- src/pages/learning-coach/ui/TrainingsSidebar.vue -->
<script setup lang="ts">
import { SchoolOutline } from '@vicons/ionicons5'
import {
  NIcon,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NText,
} from 'naive-ui'
import { useGameModeStore } from '@/features/workout'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EndgamesTab from './tabs/EndgamesTab.vue'
import TacticsTab from './tabs/TacticsTab.vue'
import PlayCoachTab from './tabs/PlayCoachTab.vue'

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t } = useI18n()
const gameModeStore = useGameModeStore()

const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')

function handleLoadRequested(payload: { type: string; category: string; difficulty: string; source: string }) {
  emit('loadRequested', payload)
}
</script>

<template>
  <div class="trainings-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <n-icon size="24" class="header-icon"><SchoolOutline /></n-icon>
      <n-text class="header-title">{{ t('features.learningCoach.title') }}</n-text>
    </div>

    <!-- Custom Navigation Tabs -->
    <div class="tab-switcher">
      <button
        class="tab-btn btn-endgame"
        :class="{ active: gameModeStore.activeMode === 'WINNING_ENDGAMES' }"
        @click="gameModeStore.activeMode = 'WINNING_ENDGAMES'"
      >
        {{ t('features.learningCoach.tabs.endgame') }}
      </button>
      <button
        class="tab-btn btn-tactic"
        :class="{ active: gameModeStore.activeMode === 'WINNING_TACTICS' }"
        @click="gameModeStore.activeMode = 'WINNING_TACTICS'"
      >
        {{ t('features.learningCoach.tabs.tactic') }}
      </button>
      <button
        class="tab-btn btn-coach"
        :class="{ active: gameModeStore.activeMode === 'PLAY_COACH' }"
        @click="gameModeStore.activeMode = 'PLAY_COACH'"
      >
        PlayCoach
      </button>
    </div>

    <!-- Sidebar Content -->
    <div class="sidebar-scrollable-content">
      <n-scrollbar trigger="hover">
        <div class="tab-content-wrapper">
          <!-- Universal Difficulty Selector -->
          <div v-if="gameModeStore.activeMode !== 'PLAY_COACH'" class="form-group difficulty-section">
            <n-text class="input-label">{{ t('features.learningCoach.difficultyLabel') }}</n-text>
            <n-radio-group v-model:value="selectedDifficulty" size="medium" expand class="radio-grp">
              <n-radio-button value="Novice">
                {{ t('common.difficulties.level_novice') }}
              </n-radio-button>
              <n-radio-button value="Pro">
                {{ t('common.difficulties.level_pro') }}
              </n-radio-button>
              <n-radio-button value="Master">
                {{ t('common.difficulties.level_master') }}
              </n-radio-button>
            </n-radio-group>
          </div>

          <!-- TAB 1: ENDGAMES -->
          <EndgamesTab
            v-if="gameModeStore.activeMode === 'WINNING_ENDGAMES'"
            :difficulty="selectedDifficulty"
            @load-requested="handleLoadRequested"
          />

          <!-- TAB 2: TACTICS -->
          <TacticsTab
            v-else-if="gameModeStore.activeMode === 'WINNING_TACTICS'"
            :difficulty="selectedDifficulty"
            @load-requested="handleLoadRequested"
          />

          <!-- TAB 4: PLAYCOACH -->
          <PlayCoachTab
            v-else-if="gameModeStore.activeMode === 'PLAY_COACH'"
          />
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.trainings-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-icon {
  color: var(--neon-purple);
  filter: drop-shadow(0 0 4px var(--neon-purple));
}

.header-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.75px;
  color: var(--color-text-primary);
  text-transform: uppercase;
}

.tab-switcher {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 2px;
  flex-shrink: 0;
}

.tab-btn {
  background: none;
  border: none;
  padding: 8px 2px;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--color-text-muted);
  border-radius: 6px;
  cursor: pointer;
  text-transform: uppercase;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  text-align: center;
}

.tab-btn:hover {
  color: var(--color-text-default);
  background: rgba(255, 255, 255, 0.04);
}

.tab-btn.active.btn-endgame {
  background: rgba(157, 78, 221, 0.15);
  color: #9d4ede;
  box-shadow: inset 0 0 0 1px rgba(157, 78, 221, 0.3);
}

.tab-btn.active.btn-tactic {
  background: rgba(0, 242, 255, 0.15);
  color: #00f2ff;
  box-shadow: inset 0 0 0 1px rgba(0, 242, 255, 0.3);
}

.tab-btn.active.btn-opening {
  background: rgba(57, 255, 20, 0.15);
  color: #39ff14;
  box-shadow: inset 0 0 0 1px rgba(57, 255, 20, 0.3);
}

.tab-btn.active.btn-coach {
  background: rgba(255, 165, 0, 0.15);
  color: #ffa500;
  box-shadow: inset 0 0 0 1px rgba(255, 165, 0, 0.3);
}

.sidebar-scrollable-content {
  flex: 1;
  min-height: 0;
}

.tab-content-wrapper {
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.radio-grp {
  width: 100%;
}

:deep(.n-radio-group .n-radio-button) {
  flex: 1;
  text-align: center;
}
</style>
