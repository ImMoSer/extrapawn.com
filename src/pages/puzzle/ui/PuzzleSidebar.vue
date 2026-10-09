<script setup lang="ts">
import { DEFAULT_SUBMODE_CATEGORY, PuzzleHalloHeader, usePuzzleStore, type PuzzleSubmode } from '@/features/puzzle'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
} from '@/shared/types/api.types'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { SchoolOutline } from '@vicons/ionicons5'
import {
  NIcon,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NText,
} from 'naive-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  submode: PuzzleSubmode
}>()

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string; golden_tactics?: boolean }): void
}>()

const { t, te } = useI18n()

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
  doubleCheck: '🎯',
  mate: '👑',
  mateIn1: '1️⃣',
  mateIn2: '2️⃣',
  mateIn3: '3️⃣',
}

const formatThemeName = (theme: string): string => {
  if (props.submode === 'tactics') {
    const key = `puzzleCategories.tactics.${theme}`
    if (te(key)) return t(key)
  } else {
    const keyTheme = `puzzleCategories.themes.${theme}`
    if (te(keyTheme)) return t(keyTheme)
    const keySubTheme = `puzzleCategories.subThemes.${theme}`
    if (te(keySubTheme)) return t(keySubTheme)
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

const basicEndgameKeys = ['pawnEnding', 'rookEnding', 'bishopVsPawns', 'knightVsPawns', 'rookVsPawns', 'extraPawn', 'extrapawn']
const premiumEndgameKeys = ['sameColorBishops', 'oppositeColorBishops', 'knightEnding', 'bishopVsKnight', 'doubleRookEnding', 'rookVsMinor', 'queenEnding']
const premiumPlusEndgameKeys = ['queenVsRook', 'rookVsTwoMinors', 'queenVsMinors', 'queenVsRookMinor', 'queenMinorVsQueenMinor', 'rookMinorVsRook', 'rookMinorVsRookMinor']

const basicTacticKeys = ['hangingPiece', 'fork', 'pin', 'backRankMate', 'skewer', 'discoveredAttack']
const premiumTacticKeys = ['capturingDefender', 'attraction', 'deflection', 'trappedPiece', 'kingAttack', 'advancedPawn', 'xRayAttack']
const premiumPlusTacticKeys = ['sacrifice', 'intermezzo', 'clearance', 'interference', 'quietMove', 'defensiveMove', 'zugzwang']

const basicTierOptions = computed(() => {
  const keys = props.submode === 'tactics' ? basicTacticKeys : basicEndgameKeys
  return themeOptions.value
    .filter(opt => keys.includes(opt.value))
    .map(opt => ({ ...opt, disabled: false }))
})

const premiumTierOptions = computed(() => {
  const keys = props.submode === 'tactics' ? premiumTacticKeys : premiumEndgameKeys
  return themeOptions.value
    .filter(opt => keys.includes(opt.value))
    .map(opt => ({ ...opt, disabled: false }))
})

const premiumPlusTierOptions = computed(() => {
  const keys = props.submode === 'tactics' ? premiumPlusTacticKeys : premiumPlusEndgameKeys
  return themeOptions.value
    .filter(opt => keys.includes(opt.value))
    .map(opt => ({ ...opt, disabled: false }))
})

const puzzleStore = usePuzzleStore()

const isGoldenActive = computed(() => {
  return props.submode === 'tactics' && !!puzzleStore.activeParams.golden_tactics
})

const selectedDifficulty = computed({
  get: () => (puzzleStore.activeParams.difficulty as 'Novice' | 'Pro' | 'Master') || 'Novice',
  set: (newDiff) => {
    puzzleStore.activeParams.difficulty = newDiff
    loadPuzzle()
  }
})

const activeThemeValue = computed({
  get: () => {
    if (isGoldenActive.value) return ''
    return puzzleStore.activeParams.category || ''
  },
  set: (val) => {
    if (val) {
      selectTheme(val)
    }
  }
})

function selectGoldenTactics() {
  if (props.submode !== 'tactics') return
  puzzleStore.activeParams.golden_tactics = true
  puzzleStore.activeParams.category = ''
  loadPuzzle(true)
}

function selectTheme(theme: string) {
  puzzleStore.activeParams.golden_tactics = false
  puzzleStore.activeParams.category = theme
  loadPuzzle(false)
}

function resetThemeToDefault() {
  // If an active puzzle matching the submode is already loaded, sync the category from it
  if (puzzleStore.activePuzzle && puzzleStore.activePuzzle.puzzle_type === props.submode) {
    if (puzzleStore.activePuzzle.is_golden || puzzleStore.activeParams.golden_tactics) {
      puzzleStore.activeParams.golden_tactics = true
      puzzleStore.activeParams.category = ''
      return
    }
    puzzleStore.activeParams.golden_tactics = false
    puzzleStore.activeParams.category = puzzleStore.activePuzzle.category
    return
  }

  // Otherwise set default category for this submode
  const defaultCat = DEFAULT_SUBMODE_CATEGORY[props.submode]
  if (defaultCat) {
    puzzleStore.activeParams.golden_tactics = false
    puzzleStore.activeParams.category = defaultCat
  } else {
    throw new Error(`[PuzzleSidebar] Unsupported submode reset: ${props.submode}. Fail-Fast!`)
  }
}

watch(() => props.submode, () => {
  resetThemeToDefault()
}, { immediate: true })

function loadPuzzle(goldenOverride?: boolean) {
  const isGolden = typeof goldenOverride === 'boolean' ? goldenOverride : isGoldenActive.value
  let source = ''
  if (props.submode === 'tactics') {
    source = isGolden
      ? t('puzzleCategories.tactics.goldenTactics', 'Золотая коллекция')
      : t('features.coach.tabs.tactic')
  } else if (props.submode === 'theory_endings') source = t('features.coach.modes.theory')
  else if (props.submode === 'practical_chess') source = t('features.coach.modes.practical')
  else if (props.submode === 'finish_him') source = t('features.coach.modes.goto')
  else {
     throw new Error(`[PuzzleSidebar] Unsupported submode source naming: ${props.submode}. Fail-Fast!`)
  }

  emit('loadRequested', {
    type: props.submode,
    category: isGolden ? '' : (puzzleStore.activeParams.category || ''),
    difficulty: selectedDifficulty.value,
    source,
    golden_tactics: isGolden,
  })
}

const isPuzzleActive = computed(() => {
  return !!puzzleStore.activePuzzle && puzzleStore.activePuzzle.puzzle_type === props.submode
})
</script>

<template>
  <div class="trainings-sidebar">
    <!-- Header -->
    <div class="sidebar-header" :class="{ 'with-card': isPuzzleActive }">
      <template v-if="!isPuzzleActive">
        <n-icon size="24" class="header-icon"><SchoolOutline /></n-icon>
        <PuzzleHalloHeader :submode="props.submode" />
      </template>
      <template v-else>
        <PuzzleHalloHeader :submode="props.submode" />
      </template>
    </div>

    <!-- Sidebar Content -->
    <div class="sidebar-scrollable-content">
      <n-scrollbar trigger="hover">
        <div class="tab-content-wrapper">
          <!-- Universal Difficulty Selector -->
          <div class="form-group difficulty-section">
            <div class="flex items-center justify-between mb-2 select-none">
              <n-text class="input-label">{{ t('features.coach.difficultyLabel') }}</n-text>

              <!-- Auto-Next Toggle -->
              <div
                @click="puzzleStore.toggleAutoNext()"
                class="flex items-center gap-2 cursor-pointer group py-0.5 px-1 rounded hover:bg-elevated/40 transition-colors"
                title="Автопереход к следующей задаче при решении"
              >
                <span class="text-xs font-bold uppercase tracking-wider text-text-secondary group-hover:text-neon-cyan transition-colors">
                  AUTO
                </span>
                <div
                  class="w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 border border-border/40"
                  :class="puzzleStore.autoNextPuzzle ? 'bg-neon-cyan/90 shadow-[0_0_8px_rgba(0,245,212,0.4)]' : 'bg-elevated'"
                >
                  <div
                    class="w-4 h-4 rounded-full bg-void shadow-md transform transition-transform duration-200 ease-in-out"
                    :class="puzzleStore.autoNextPuzzle ? 'translate-x-4' : 'translate-x-0'"
                  />
                </div>
              </div>
            </div>

            <n-radio-group v-model:value="selectedDifficulty" size="medium" expand class="radio-grp">
              <n-radio-button value="Novice">
                {{ t('puzzleCategories.difficulties.level_novice') }}
              </n-radio-button>
              <n-radio-button value="Pro">
                {{ t('puzzleCategories.difficulties.level_pro') }}
              </n-radio-button>
              <n-radio-button value="Master">
                {{ t('puzzleCategories.difficulties.level_master') }}
              </n-radio-button>
            </n-radio-group>
          </div>

          <!-- Golden Tactics Feature Card (Only in tactics mode) -->
          <div v-if="props.submode === 'tactics'" class="golden-tactics-section">
            <div
              class="golden-tactics-card"
              :class="{ active: isGoldenActive }"
              @click="selectGoldenTactics"
              role="button"
              tabindex="0"
            >
              <div class="golden-card-glow"></div>
              <div class="golden-card-badge">TOP</div>
              <div class="golden-card-content">
                <div class="golden-icon-container">
                  <span class="golden-icon">🏆</span>
                </div>
                <div class="golden-info">
                  <div class="golden-title">
                    {{ t('puzzleCategories.tactics.goldenTactics', 'Золотая коллекция') }}
                  </div>
                  <div class="golden-desc">
                    {{ t('puzzleCategories.tactics.goldenTacticsDesc', '10 000+ избранных задач') }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group theme-group">
            <n-text class="input-label">
              {{ props.submode === 'tactics' ? t('features.coach.tacticsLabel') : t('features.coach.categoryLabel') }}
            </n-text>
            <div class="tiered-groups-container">
              <VisualRadioGroup
                :value="activeThemeValue"
                :options="basicTierOptions"
                :min-width="115"
                class="tier-basic"
                @update:value="selectTheme"
              />
              <div class="group-divider"></div>
              <VisualRadioGroup
                :value="activeThemeValue"
                :options="premiumTierOptions"
                :min-width="115"
                class="tier-premium"
                @update:value="selectTheme"
              />
              <div class="group-divider"></div>
              <VisualRadioGroup
                :value="activeThemeValue"
                :options="premiumPlusTierOptions"
                :min-width="115"
                class="tier-premium-plus"
                @update:value="selectTheme"
              />
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
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.sidebar-header.with-card {
  box-sizing: border-box;
  display: block;
  padding: 8px;
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

.golden-tactics-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
}

.golden-tactics-card {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.07) 0%, rgba(20, 20, 26, 0.85) 100%);
  border: 1px solid rgba(255, 215, 0, 0.28);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  user-select: none;
}

.golden-tactics-card:hover {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.14) 0%, rgba(30, 28, 20, 0.9) 100%);
  border-color: rgba(255, 215, 0, 0.65);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.18), 0 0 12px rgba(255, 215, 0, 0.12);
}

.golden-tactics-card.active {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(42, 36, 22, 0.95) 100%);
  border-color: #ffd700;
  box-shadow: 0 0 22px rgba(255, 215, 0, 0.4), inset 0 0 12px rgba(255, 215, 0, 0.18);
}

.golden-card-glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.22) 0%, transparent 70%);
  pointer-events: none;
}

.golden-card-badge {
  position: absolute;
  top: 6px;
  right: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 1px 6px;
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  border: 1px solid rgba(255, 215, 0, 0.45);
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.golden-card-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.golden-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 215, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.3);
  font-size: 1.25rem;
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.golden-tactics-card.active .golden-icon-container {
  background: rgba(255, 215, 0, 0.28);
  border-color: #ffd700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
  transform: scale(1.05);
}

.golden-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.golden-title {
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.25s ease;
}

.golden-tactics-card.active .golden-title {
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
}

.golden-desc {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.2;
}

.golden-tactics-card.active .golden-desc {
  color: rgba(255, 235, 150, 0.9);
}

.theme-group {
  margin-top: 4px;
}

.tiered-groups-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08) 20%, rgba(255, 255, 255, 0.08) 80%, transparent);
  margin-top: 4px;
  margin-bottom: 4px;
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

/* Tier Colors styling */

/* Basic Tier (Green) */
:deep(.tier-basic .visual-card) {
  border-color: rgba(99, 226, 183, 0.15) !important;
}
:deep(.tier-basic .visual-card:hover) {
  background: rgba(99, 226, 183, 0.05) !important;
  border-color: rgba(99, 226, 183, 0.6) !important;
  box-shadow: 0 0 8px rgba(99, 226, 183, 0.2) !important;
}
:deep(.tier-basic .visual-card.active) {
  background: rgba(99, 226, 183, 0.12) !important;
  border-color: #63e2b7 !important;
  box-shadow: 0 0 12px rgba(99, 226, 183, 0.4) !important;
}

/* Premium Tier (Yellow/Gold) */
:deep(.tier-premium .visual-card) {
  border-color: rgba(243, 156, 18, 0.15) !important;
}
:deep(.tier-premium .visual-card:hover) {
  background: rgba(243, 156, 18, 0.05) !important;
  border-color: rgba(243, 156, 18, 0.6) !important;
  box-shadow: 0 0 8px rgba(243, 156, 18, 0.2) !important;
}
:deep(.tier-premium .visual-card.active) {
  background: rgba(243, 156, 18, 0.12) !important;
  border-color: #f39c12 !important;
  box-shadow: 0 0 12px rgba(243, 156, 18, 0.4) !important;
}

/* Premium Plus Tier (Red/Rose) */
:deep(.tier-premium-plus .visual-card) {
  border-color: rgba(230, 57, 70, 0.15) !important;
}
:deep(.tier-premium-plus .visual-card:hover) {
  background: rgba(230, 57, 70, 0.05) !important;
  border-color: rgba(230, 57, 70, 0.6) !important;
  box-shadow: 0 0 8px rgba(230, 57, 70, 0.2) !important;
}
:deep(.tier-premium-plus .visual-card.active) {
  background: rgba(230, 57, 70, 0.12) !important;
  border-color: #e63946 !important;
  box-shadow: 0 0 12px rgba(230, 57, 70, 0.4) !important;
}

/* Disabled difficulty button styling */
:deep(.n-radio-group .n-radio-button.disabled-diff) {
  opacity: 0.45;
  cursor: not-allowed !important;
}
:deep(.n-radio-group .n-radio-button.disabled-diff *) {
  cursor: not-allowed !important;
}
</style>
