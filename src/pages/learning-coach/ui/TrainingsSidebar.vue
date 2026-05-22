<!-- src/pages/learning-coach/ui/TrainingsSidebar.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NIcon,
  NRadioGroup,
  NRadioButton,
  NText,
  NScrollbar,
  useMessage,
} from 'naive-ui'
import { SchoolOutline } from '@vicons/ionicons5'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import { apiClient } from '@/shared/api/client'
import {
  FINISH_HIM_THEMES,
  THEORY_ENDING_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
} from '@/shared/types/api.types'

// Types
type LearningPuzzle = {
  puzzle_id: string
  initial_fen: string
  weak_side?: string
  winner?: string
  first_move?: string
  difficulty: string
  rating?: number
  tactical_rating?: number
  engm_rating?: number
  tactical_solution?: string
  category?: string
  sub_category?: string
  themes?: string[]
  game_modus?: string
}

// Props & Emits
interface Props {
  isLoading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'positionLoaded', payload: { puzzle: LearningPuzzle; source: string }): void
  (e: 'update:isLoading', val: boolean): void
}>()

// State
const { t } = useI18n()
const message = useMessage()

const activeTab = ref<'WINNING_ENDGAMES' | 'WINNING_TACTICS' | 'WINNING_OPENINGS'>('WINNING_ENDGAMES')
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

const OPENINGS_WHITE = [
  'Italian Game',
  "Queen's Gambit",
  'London System',
  'Ruy Lopez',
  'English Opening',
  'Scotch Game',
  "King's Indian Attack",
  'Vienna Game',
  'Zukertort Opening',
  'Four Knights Game',
  "Bishop's Opening",
  "King's Gambit",
  'Alapin Sicilian',
  'Closed Sicilian',
  'Grand Prix Attack',
  'Nimzowitsch-Larsen Attack',
  'Smith-Morra Gambit',
  'Blackmar-Diemer Gambit',
  'Mieses Opening',
  'Grob Opening',
]

const OPENINGS_BLACK = [
  'Sicilian Defense',
  'Open Game',
  'French Defense',
  'Caro-Kann Defense',
  'Scandinavian Defense',
  "King's Indian Defense",
  "Queen's Gambit Declined",
  'Slav Defense',
  'Nimzo-Indian Defense',
  'Pirc Defense',
  'Gruenfeld Defense',
  "Queen's Gambit Accepted",
  'Modern Defense',
  "Alekhine's Defense",
  "Queen's Indian Defense",
  'Philidor Defense',
  'Scandinavian Defense (Modern Variation)',
  'Dutch Defense',
  'Chigorin Defense',
  'Englund Gambit',
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
    list = FINISH_HIM_THEMES
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
    selectedEndgameTheme.value = FINISH_HIM_THEMES[0] || 'pawn'
  }
})

// Unified Load Functions
async function loadEndgame() {
  emit('update:isLoading', true)
  const type = selectedEndgameMode.value
  let endpoint = ''
  let source = ''

  if (type === 'THEORETICAL') {
    endpoint = `/theory-endings/puzzle?mode=win&difficulty=${selectedDifficulty.value}&category=${selectedEndgameTheme.value}`
    source = t('features.learningCoach.modes.theory')
  } else if (type === 'PRACTICAL') {
    endpoint = `/practical-chess/${selectedEndgameTheme.value}/puzzle?difficulty=${selectedDifficulty.value}`
    source = t('features.learningCoach.modes.practical')
  } else {
    endpoint = `/finish-him/start?theme=${selectedEndgameTheme.value}&difficulty=${selectedDifficulty.value}`
    source = t('features.learningCoach.modes.goto')
  }

  try {
    const data = await apiClient<LearningPuzzle>(endpoint)
    if (data && data.initial_fen) {
      emit('positionLoaded', { puzzle: data, source })
    } else {
      throw new Error('Invalid response structure')
    }
  } catch (err) {
    console.error('Failed to load puzzle:', err)
    message.error(t('features.finishHim.feedback.loadFailed', 'Stellung konnte nicht geladen werden.'))
  } finally {
    emit('update:isLoading', false)
  }
}

async function loadTactics() {
  emit('update:isLoading', true)
  const source = t('features.learningCoach.tabs.tactic')
  const endpoint = `/tactics/start?theme=${selectedTacticsTheme.value}&difficulty=${selectedDifficulty.value}`

  try {
    const data = await apiClient<LearningPuzzle>(endpoint)
    if (data && data.initial_fen) {
      emit('positionLoaded', { puzzle: data, source })
    } else {
      throw new Error('Invalid response structure')
    }
  } catch (err) {
    console.error('Failed to load tactics:', err)
    message.error(t('features.finishHim.feedback.loadFailed', 'Stellung konnte nicht geladen werden.'))
  } finally {
    emit('update:isLoading', false)
  }
}

function handleOpeningClick(name: string) {
  message.info(t('features.learningCoach.openingPlaceholder', { name }, `Eröffnung "${name}" ausgewählt (Placeholder).`))
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
        class="tab-btn btn-opening"
        :class="{ active: activeTab === 'WINNING_OPENINGS' }"
        @click="activeTab = 'WINNING_OPENINGS'"
      >
        {{ t('features.learningCoach.tabs.opening') }}
      </button>
    </div>

    <!-- Sidebar Content -->
    <div class="sidebar-scrollable-content">
      <n-scrollbar trigger="hover">
        <div class="tab-content-wrapper">
          <!-- Universal Difficulty Selector -->
          <div class="form-group difficulty-section">
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
                :columns="2"
                @update:value="loadTactics"
              />
            </div>
          </div>

          <!-- TAB 3: OPENINGS -->
          <div v-else-if="activeTab === 'WINNING_OPENINGS'" class="tab-panel flex-panel">
            <n-collapse :default-expanded-names="['white']">
              <!-- White Openings -->
              <n-collapse-item title="Weiß Eröffnungen" name="white">
                <div class="openings-list">
                  <n-button
                    v-for="op in OPENINGS_WHITE"
                    :key="op"
                    quaternary
                    block
                    class="opening-item"
                    @click="handleOpeningClick(op)"
                  >
                    {{ op }}
                  </n-button>
                </div>
              </n-collapse-item>

              <!-- Black Openings -->
              <n-collapse-item title="Schwarz Eröffnungen" name="black">
                <div class="openings-list">
                  <n-button
                    v-for="op in OPENINGS_BLACK"
                    :key="op"
                    quaternary
                    block
                    class="opening-item"
                    @click="handleOpeningClick(op)"
                  >
                    {{ op }}
                  </n-button>
                </div>
              </n-collapse-item>
            </n-collapse>
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
</style>
