<script setup lang="ts">
import { SchoolOutline, CompassOutline } from '@vicons/ionicons5'
import {
  NIcon,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NText,
  NButton,
} from 'naive-ui'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
} from '@/shared/types/api.types'
import { usePuzzleStore, type PuzzleSubmode } from '@/features/puzzle'

const props = defineProps<{
  submode: PuzzleSubmode
}>()

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t } = useI18n()

const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')
const selectedTheme = ref<string>('')

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

const formatThemeName = (theme: string): string => {
  const key = props.submode === 'tactics' ? `chess.tactics.${theme}` : `chess.themes.${theme}`
  const translation = t(key)
  if (translation && !translation.startsWith('chess.')) {
    return translation
  }
  return theme.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
}

const themeOptions = computed(() => {
  if (props.submode === 'tactics') {
    return TACTICS_THEMES.map((theme) => ({
      label: formatThemeName(theme),
      value: theme,
      icon: TACTICS_ICON_UI[theme] || '🧩',
    }))
  }

  let list: readonly string[] = []
  if (props.submode === 'theory_endings') {
    list = THEORY_ENDING_CATEGORIES
  } else if (props.submode === 'practical_chess') {
    list = PRACTICAL_CHESS_CATEGORIES
  } else if (props.submode === 'finish_him') {
    list = FINISH_HIM_CATEGORIES
  } else {
    throw new Error(`[PuzzleSidebar] Unsupported submode: ${props.submode}. Fail-Fast!`)
  }

  return list.map((theme) => ({
    label: formatThemeName(theme),
    value: theme,
    ...CHESS_CATEGORY_UI[theme],
  }))
})

const puzzleStore = usePuzzleStore()
const isDiscoveryModeActive = computed(() => puzzleStore.isDiscoveryMode)

function toggleDiscovery() {
  if (isDiscoveryModeActive.value) {
    puzzleStore.isDiscoveryMode = false
    puzzleStore.discoveryQueue = []
    resetThemeToDefault()
    loadPuzzle()
  } else {
    selectedTheme.value = ''
    puzzleStore.startDiscovery(props.submode)
  }
}

const activeThemeValue = computed({
  get: () => isDiscoveryModeActive.value ? '' : selectedTheme.value,
  set: (val) => {
    selectedTheme.value = val
    puzzleStore.isDiscoveryMode = false
    puzzleStore.discoveryQueue = []
  }
})

function resetThemeToDefault() {
  if (props.submode === 'tactics') {
    selectedTheme.value = 'fork'
  } else if (props.submode === 'theory_endings') {
    selectedTheme.value = THEORY_ENDING_CATEGORIES[0] || 'pawn'
  } else if (props.submode === 'practical_chess') {
    selectedTheme.value = PRACTICAL_CHESS_CATEGORIES[0] || 'extraPawn'
  } else if (props.submode === 'finish_him') {
    selectedTheme.value = FINISH_HIM_CATEGORIES[0] || 'pawn'
  } else {
     throw new Error(`[PuzzleSidebar] Unsupported submode reset: ${props.submode}. Fail-Fast!`)
  }
}

watch(() => props.submode, () => {
  resetThemeToDefault()
  if (isDiscoveryModeActive.value) {
    selectedTheme.value = ''
    puzzleStore.startDiscovery(props.submode)
  } else {
    loadPuzzle()
  }
}, { immediate: true })

watch(selectedDifficulty, (newDiff) => {
  puzzleStore.activeParams.difficulty = newDiff
  if (isDiscoveryModeActive.value) {
    puzzleStore.startDiscovery(props.submode)
  }
})

function loadPuzzle() {
  let source = ''
  if (props.submode === 'tactics') source = t('features.learningCoach.tabs.tactic')
  else if (props.submode === 'theory_endings') source = t('features.learningCoach.modes.theory')
  else if (props.submode === 'practical_chess') source = t('features.learningCoach.modes.practical')
  else if (props.submode === 'finish_him') source = t('features.learningCoach.modes.goto')
  else {
     throw new Error(`[PuzzleSidebar] Unsupported submode source naming: ${props.submode}. Fail-Fast!`)
  }

  emit('loadRequested', {
    type: props.submode,
    category: selectedTheme.value,
    difficulty: selectedDifficulty.value,
    source,
  })
}

const headerTitle = computed(() => {
  if (props.submode === 'tactics') return t('features.learningCoach.tabs.tactic')
  if (props.submode === 'theory_endings') return t('welcome.submodes.theory_endings', 'Theory Endings')
  if (props.submode === 'practical_chess') return t('welcome.submodes.practical_chess', 'Practical Chess')
  if (props.submode === 'finish_him') return t('welcome.submodes.finish_him', 'Finish Him')
  throw new Error(`[PuzzleSidebar] Unknown submode header: ${props.submode}. Fail-Fast!`)
})
</script>

<template>
  <div class="trainings-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <n-icon size="24" class="header-icon"><SchoolOutline /></n-icon>
      <n-text class="header-title">{{ headerTitle }}</n-text>
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

          <div class="discovery-section-wrapper">
            <n-button
              type="primary"
              block
              size="large"
              class="discovery-btn"
              :class="{ 'active': isDiscoveryModeActive }"
              @click="toggleDiscovery"
            >
              <template #icon>
                <n-icon><CompassOutline /></n-icon>
              </template>
              {{ isDiscoveryModeActive ? 'Discovery Mode: ON' : 'Start Discovery Mode' }}
            </n-button>
          </div>

          <div class="form-group theme-group">
            <n-text class="input-label">
              {{ props.submode === 'tactics' ? t('features.learningCoach.tacticsLabel') : t('features.learningCoach.categoryLabel') }}
            </n-text>
            <VisualRadioGroup
              v-model:value="activeThemeValue"
              :options="themeOptions"
              :columns="props.submode === 'tactics' ? 3 : 2"
              @update:value="loadPuzzle"
            />
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

.discovery-section-wrapper {
  margin-top: 8px;
  margin-bottom: 8px;
}

.discovery-btn {
  background: linear-gradient(135deg, #7b2cbf 0%, #3a0ca3 100%) !important;
  color: white !important;
  font-family: 'Outfit', sans-serif !important;
  font-weight: 700 !important;
  border: 1px solid rgba(157, 78, 221, 0.4) !important;
  border-radius: 12px !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  box-shadow: 0 4px 15px rgba(123, 44, 191, 0.2) !important;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.discovery-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(123, 44, 191, 0.4), 0 0 10px rgba(99, 226, 183, 0.2) !important;
  border-color: #63e2b7 !important;
}

.discovery-btn.active {
  background: linear-gradient(135deg, #00f5d4 0%, #00bbf9 100%) !important;
  border-color: #00f5d4 !important;
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.6) !important;
  animation: pulseGlow 2s infinite ease-in-out;
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 15px rgba(0, 245, 212, 0.4);
  }
  50% {
    box-shadow: 0 0 25px rgba(0, 245, 212, 0.8);
  }
}
</style>
