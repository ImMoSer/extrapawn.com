<!-- src/pages/learning-coach/ui/TrainingsSidebar.vue -->
<script setup lang="ts">
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
} from '@/shared/types/api.types'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { SchoolOutline } from '@vicons/ionicons5'
import {
  NButton,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NText,
} from 'naive-ui'
import { OpeningStatsTable } from '@/features/opening-explorer'
import { useWorkoutStore, usePlayCoachStore } from '@/features/workout'
import { useGameStore, useBoardStore } from '@/entities/game'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t } = useI18n()
const workoutStore = useWorkoutStore()
const gameStore = useGameStore()
const boardStore = useBoardStore()
const playCoachStore = usePlayCoachStore()

const activeTab = ref<'WINNING_ENDGAMES' | 'WINNING_TACTICS' | 'PLAY_COACH'>('WINNING_ENDGAMES')

function togglePlayCoach() {
  if (playCoachStore.isActive) {
    playCoachStore.stop()
    gameStore.setGamePhase('IDLE')
  } else {
    gameStore.setGamePhase('PLAYING')
    playCoachStore.start()
  }
}
const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')
const selectedEndgameMode = ref<'GOTO' | 'THEORETICAL' | 'PRACTICAL'>('GOTO')

// Selections
const selectedEndgameTheme = ref<string>('pawn')
const selectedTacticsTheme = ref<string>('fork')

const TACTICS_THEMES = [
  'fork',
  'kingAttack',
  'sacrifice',
  'pin',
  'discoveredAttack',
  'advancedPawn',
  'attraction',
  'deflection',
  'defensiveMove',
  'quietMove',
  'hangingPiece',
  'skewer',
  'trappedPiece',
  'intermezzo',
  'clearance',
  'capturingDefender',
  'zugzwang',
  'backRankMate',
  'interference',
  'xRayAttack',
]

const TACTICS_ICON_UI: Record<string, string> = {
  fork: '⚔️',
  kingAttack: '👑',
  sacrifice: '💥',
  pin: '📌',
  discoveredAttack: '👀',
  advancedPawn: '🏃',
  attraction: '🧲',
  deflection: '🛡️',
  defensiveMove: '🧱',
  quietMove: '🤫',
  hangingPiece: '💎',
  skewer: '⚡',
  trappedPiece: '🕸️',
  intermezzo: '⏱️',
  clearance: '🧹',
  capturingDefender: '⚔️',
  zugzwang: '⏳',
  backRankMate: '🪜',
  interference: '🚧',
  xRayAttack: '🩻',
}

// Formatters
const formatThemeName = (theme: string, isTactic = false): string => {
  const key = isTactic ? `chess.tactics.${theme}` : `chess.themes.${theme}`
  const translation = t(key)
  if (translation && !translation.startsWith('chess.')) {
    return translation
  }
  return theme.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
}

const endgameThemeOptions = computed(() => {
  let list: readonly string[] = []

  if (selectedEndgameMode.value === 'THEORETICAL') {
    list = THEORY_ENDING_CATEGORIES
  } else if (selectedEndgameMode.value === 'PRACTICAL') {
    list = PRACTICAL_CHESS_CATEGORIES
  } else {
    list = FINISH_HIM_CATEGORIES
  }

  return list.map((theme) => ({
    label: formatThemeName(theme, false),
    value: theme,
    ...CHESS_CATEGORY_UI[theme],
  }))
})

const tacticsOptions = computed(() => {
  return TACTICS_THEMES.map((theme) => ({
    label: formatThemeName(theme, true),
    value: theme,
    icon: TACTICS_ICON_UI[theme] || '🧩',
  }))
})

// Auto-reset selected theme if it isn't in the new list of endgame mode
watch(selectedEndgameMode, (newMode) => {
  if (newMode === 'THEORETICAL') {
    selectedEndgameTheme.value = THEORY_ENDING_CATEGORIES[0] || 'pawn'
  } else if (newMode === 'PRACTICAL') {
    selectedEndgameTheme.value = PRACTICAL_CHESS_CATEGORIES[0] || 'extraPawn'
  } else {
    selectedEndgameTheme.value = FINISH_HIM_CATEGORIES[0] || 'pawn'
  }
})

watch(activeTab, (newTab) => {
  if (newTab === 'PLAY_COACH') {
    workoutStore.reset()
    gameStore.resetGame()
    boardStore.setupPosition('start')
  } else if (playCoachStore.isActive) {
    playCoachStore.stop()
  }
})

// Unified Load Functions
function loadEndgame() {
  playCoachStore.stop()
  const mode = selectedEndgameMode.value
  let type = ''
  let source = ''

  if (mode === 'THEORETICAL') {
    type = 'theory_endings'
    source = t('features.learningCoach.modes.theory')
  } else if (mode === 'PRACTICAL') {
    type = 'practical_chess'
    source = t('features.learningCoach.modes.practical')
  } else {
    type = 'finish_him'
    source = t('features.learningCoach.modes.goto')
  }

  emit('loadRequested', {
    type,
    category: selectedEndgameTheme.value,
    difficulty: selectedDifficulty.value,
    source,
  })
}

function loadTactics() {
  playCoachStore.stop()
  const source = t('features.learningCoach.tabs.tactic')
  emit('loadRequested', {
    type: 'tactics',
    category: selectedTacticsTheme.value,
    difficulty: selectedDifficulty.value,
    source,
  })
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
        :class="{ active: activeTab === 'WINNING_ENDGAMES' }"
        @click="activeTab = 'WINNING_ENDGAMES'"
      >
        {{ t('features.learningCoach.tabs.endgame') }}
      </button>
      <button
        class="tab-btn btn-tactic"
        :class="{ active: activeTab === 'WINNING_TACTICS' }"
        @click="activeTab = 'WINNING_TACTICS'"
      >
        {{ t('features.learningCoach.tabs.tactic') }}
      </button>
      <button
        class="tab-btn btn-coach"
        :class="{ active: activeTab === 'PLAY_COACH' }"
        @click="activeTab = 'PLAY_COACH'"
      >
        PlayCoach
      </button>
    </div>

    <!-- Sidebar Content -->
    <div class="sidebar-scrollable-content">
      <n-scrollbar trigger="hover">
        <div class="tab-content-wrapper">
          <!-- Universal Difficulty Selector -->
          <div v-if="activeTab !== 'PLAY_COACH'" class="form-group difficulty-section">
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
          <div v-if="activeTab === 'WINNING_ENDGAMES'" class="tab-panel">
            <div class="form-group">
              <n-text class="input-label">{{ t('features.learningCoach.modeLabel') }}</n-text>
              <n-radio-group v-model:value="selectedEndgameMode" size="medium" expand class="radio-grp">
                <n-radio-button value="GOTO">
                  {{ t('features.learningCoach.modes.goto') }}
                </n-radio-button>
                <n-radio-button value="THEORETICAL">
                  {{ t('features.learningCoach.modes.theory') }}
                </n-radio-button>
                <n-radio-button value="PRACTICAL">
                  {{ t('features.learningCoach.modes.practical') }}
                </n-radio-button>
              </n-radio-group>
            </div>

            <div class="form-group theme-group">
              <n-text class="input-label">{{ t('features.learningCoach.categoryLabel') }}</n-text>
              <VisualRadioGroup
                v-model:value="selectedEndgameTheme"
                :options="endgameThemeOptions"
                :columns="2"
                @update:value="loadEndgame"
              />
            </div>
          </div>

          <!-- TAB 2: TACTICS -->
          <div v-else-if="activeTab === 'WINNING_TACTICS'" class="tab-panel">
            <div class="form-group theme-group">
              <n-text class="input-label">{{ t('features.learningCoach.tacticsLabel') }}</n-text>
              <VisualRadioGroup
                v-model:value="selectedTacticsTheme"
                :options="tacticsOptions"
                :columns="3"
                @update:value="loadTactics"
              />
            </div>
          </div>

          <!-- TAB 4: PLAYCOACH -->
          <div v-else-if="activeTab === 'PLAY_COACH'" class="tab-panel">
            <template v-if="!playCoachStore.isActive">
              <div class="form-group">
                <n-text class="input-label">Spielstärke</n-text>
                <n-radio-group
                  v-model:value="playCoachStore.selectedRange"
                  size="medium"
                  expand
                  class="radio-grp"
                >
                  <n-radio-button value="1000-1499">1000-1499</n-radio-button>
                  <n-radio-button value="1500-1799">1500-1799</n-radio-button>
                  <n-radio-button value="1800-2200">1800-2200</n-radio-button>
                </n-radio-group>
              </div>

              <div class="form-group" style="margin-top: 12px">
                <n-text class="input-label">Deine Farbe</n-text>
                <n-radio-group
                  v-model:value="playCoachStore.userColor"
                  size="medium"
                  expand
                  class="radio-grp"
                >
                  <n-radio-button value="white">White</n-radio-button>
                  <n-radio-button value="black">Black</n-radio-button>
                </n-radio-group>
              </div>
            </template>

            <div v-else class="active-game-info">
              <div class="info-row">
                <span class="label">Spielstärke:</span>
                <span class="value">{{ playCoachStore.selectedRange }}</span>
              </div>
              <div class="info-row">
                <span class="label">Deine Farbe:</span>
                <span class="value">{{ playCoachStore.userColor === 'white' ? 'Weiß' : 'Schwarz' }}</span>
              </div>
            </div>

            <div class="form-group" style="margin-top: 16px">
              <n-button
                block
                strong
                :type="playCoachStore.isActive ? 'error' : 'primary'"
                @click="togglePlayCoach"
              >
                {{ playCoachStore.isActive ? 'Stop PlayCoach' : 'Start PlayCoach' }}
              </n-button>
            </div>

            <div v-if="playCoachStore.isActive" class="coach-stats-section" style="margin-top: 20px">
              <n-text class="input-label" style="margin-bottom: 8px; display: block"
                >Lichess Book Statistik</n-text
              >
              <OpeningStatsTable
                v-if="playCoachStore.coachStats"
                :moves="playCoachStore.coachStats.moves"
                :isReviewMode="true"
                :total="playCoachStore.coachStats.summary?.total || 0"
                :win_p="playCoachStore.coachStats.summary?.win_p || 0"
                :draw_p="playCoachStore.coachStats.summary?.draw_p || 0"
                :loss_p="playCoachStore.coachStats.summary?.loss_p || 0"
                :avg-elo="playCoachStore.coachStats.summary?.avgElo || 0"
              />
              <div v-else-if="playCoachStore.isLoading" class="loading-stats">Lade Statistik...</div>
              <div v-else class="out-of-book-msg">Theory ends here. Maia is now playing.</div>
            </div>
          </div>
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

.theme-group {
  margin-top: 4px;
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

.openings-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 350px;
  overflow-y: auto;
  padding-right: 4px;
}

.opening-item {
  justify-content: flex-start;
  font-weight: 500;
  text-align: left;
}

/* Neon buttons and boxes */
.action-btn {
  margin-top: 8px;
}

.btn-glow-purple {
  border-color: rgba(157, 78, 221, 0.6) !important;
}
.btn-glow-purple:hover {
  background: rgba(157, 78, 221, 0.15) !important;
  box-shadow: 0 0 8px rgba(157, 78, 221, 0.4);
}

.btn-glow-cyan {
  border-color: rgba(0, 242, 255, 0.6) !important;
}
.btn-glow-cyan:hover {
  background: rgba(0, 242, 255, 0.15) !important;
  box-shadow: 0 0 8px rgba(0, 242, 255, 0.4);
}

.loading-stats,
.out-of-book-msg {
  padding: 20px;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.out-of-book-msg {
  color: var(--color-accent);
  border-color: rgba(var(--color-accent-rgb), 0.2);
}

.active-game-info {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.info-row .label {
  color: var(--color-text-muted);
  font-weight: 500;
}

.info-row .value {
  color: var(--color-text-primary);
  font-weight: 700;
}
</style>
