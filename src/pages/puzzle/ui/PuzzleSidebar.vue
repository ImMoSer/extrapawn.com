<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { useDemoplayStore } from '@/features/demoplay'
import { PuzzleHalloHeader, usePuzzleStore, type PuzzleSubmode } from '@/features/puzzle'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
  type SubscriptionTier,
} from '@/shared/types/api.types'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { CompassOutline, SchoolOutline } from '@vicons/ionicons5'
import {
  NButton,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NText,
  useDialog,
} from 'naive-ui'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  submode: PuzzleSubmode
}>()

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t, te } = useI18n()
const authStore = useAuthStore()
const dialog = useDialog()
const router = useRouter()

const TIER_LEVELS: Record<string, number> = {
  Guest: 0,
  Pawn: 1,
  pawn: 1,
  VIP: 3,
  vip: 3,
  Knight: 3,
  knight: 3,
  Bishop: 3,
  bishop: 3,
  Rook: 3,
  rook: 3,
  Queen: 3,
  queen: 3,
  King: 3,
  king: 3,
  administrator: 4,
}

const currentUserTier = computed<SubscriptionTier | 'Guest'>(() => {
  if (!authStore.isAuthenticated || !authStore.userProfile) {
    return 'Guest'
  }
  const tier = authStore.userProfile.subscriptionTier
  if (!(tier in TIER_LEVELS)) {
    throw new Error(`[PuzzleSidebar] Unexpected subscriptionTier: "${tier}". Fail-Fast!`)
  }
  return tier as SubscriptionTier
})

const currentUserLevel = computed<number>(() => {
  return TIER_LEVELS[currentUserTier.value] ?? 0
})



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
  const isDisabled = currentUserLevel.value < 1
  return themeOptions.value
    .filter(opt => keys.includes(opt.value))
    .map(opt => ({ ...opt, disabled: isDisabled }))
})

const premiumTierOptions = computed(() => {
  const keys = props.submode === 'tactics' ? premiumTacticKeys : premiumEndgameKeys
  const isDisabled = currentUserLevel.value < 2
  return themeOptions.value
    .filter(opt => keys.includes(opt.value))
    .map(opt => ({ ...opt, disabled: isDisabled }))
})

const premiumPlusTierOptions = computed(() => {
  const keys = props.submode === 'tactics' ? premiumPlusTacticKeys : premiumPlusEndgameKeys
  const isDisabled = currentUserLevel.value < 3
  return themeOptions.value
    .filter(opt => keys.includes(opt.value))
    .map(opt => ({ ...opt, disabled: isDisabled }))
})

function showRestrictionModal(messageText: string) {
  dialog.warning({
    title: t('puzzleCategories.tierRestriction.title'),
    content: messageText,
    positiveText: t('puzzleCategories.tierRestriction.upgradeBtn'),
    negativeText: t('puzzleCategories.tierRestriction.cancelBtn'),
    onPositiveClick: () => {
      router.push('/pricing')
    }
  })
}

function handleDisabledClick(tierType: 'basic' | 'premium' | 'premiumPlus') {
  if (tierType === 'basic') {
    showRestrictionModal(t('puzzleCategories.tierRestriction.basic'))
  } else if (tierType === 'premium') {
    showRestrictionModal(t('puzzleCategories.tierRestriction.premium'))
  } else if (tierType === 'premiumPlus') {
    showRestrictionModal(t('puzzleCategories.tierRestriction.premiumPlus'))
  } else {
    throw new Error(`[PuzzleSidebar] Unsupported tier restriction type: "${tierType}". Fail-Fast!`)
  }
}

const puzzleStore = usePuzzleStore()
const demoplayStore = useDemoplayStore()
const isDiscoveryModeActive = computed(() => puzzleStore.isDiscoveryMode)

const selectedDifficulty = computed({
  get: () => (puzzleStore.activeParams.difficulty as 'Novice' | 'Pro' | 'Master') || 'Novice',
  set: (newDiff) => {
    if (newDiff === 'Novice' && currentUserLevel.value < 1) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.basic'))
      return
    }
    if (newDiff === 'Pro' && currentUserLevel.value < 2) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.premium'))
      return
    }
    if (newDiff === 'Master' && currentUserLevel.value < 3) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.premiumPlus'))
      return
    }

    demoplayStore.demoplayCount = 1
    demoplayStore.hasJustReset = true
    puzzleStore.activeParams.difficulty = newDiff
    if (isDiscoveryModeActive.value) {
      puzzleStore.startDiscovery(props.submode)
    } else {
      loadPuzzle()
    }
  }
})

const activeThemeValue = computed({
  get: () => puzzleStore.isDiscoveryMode ? '' : (puzzleStore.activeParams.category || ''),
  set: (val) => {
    demoplayStore.demoplayCount = 1
    demoplayStore.hasJustReset = true
    puzzleStore.isDiscoveryMode = false
    puzzleStore.discoveryQueue = []
    puzzleStore.activeParams.category = val
  }
})

function toggleDiscovery() {
  demoplayStore.demoplayCount = 1
  demoplayStore.hasJustReset = true
  if (isDiscoveryModeActive.value) {
    puzzleStore.isDiscoveryMode = false
    puzzleStore.discoveryQueue = []
    resetThemeToDefault()
    loadPuzzle()
  } else {
    puzzleStore.activeParams.category = undefined
    puzzleStore.startDiscovery(props.submode)
  }
}

function resetThemeToDefault() {
  // If an active puzzle matching the submode is already loaded, sync the category from it
  if (puzzleStore.activePuzzle && puzzleStore.activePuzzle.puzzle_type === props.submode) {
    puzzleStore.activeParams.category = puzzleStore.activePuzzle.category
    return
  }

  // Otherwise set default category for this submode
  if (props.submode === 'tactics') {
    puzzleStore.activeParams.category = 'fork'
  } else if (props.submode === 'theory_endings') {
    puzzleStore.activeParams.category = THEORY_ENDING_CATEGORIES[0] || 'pawnEnding'
  } else if (props.submode === 'practical_chess') {
    puzzleStore.activeParams.category = PRACTICAL_CHESS_CATEGORIES[0] || 'extraPawn'
  } else if (props.submode === 'finish_him') {
    puzzleStore.activeParams.category = FINISH_HIM_CATEGORIES[0] || 'pawnEnding'
  } else {
     throw new Error(`[PuzzleSidebar] Unsupported submode reset: ${props.submode}. Fail-Fast!`)
  }
}

watch(() => props.submode, () => {
  resetThemeToDefault()
}, { immediate: true })

function loadPuzzle() {
  let source = ''
  if (props.submode === 'tactics') source = t('features.coach.tabs.tactic')
  else if (props.submode === 'theory_endings') source = t('features.coach.modes.theory')
  else if (props.submode === 'practical_chess') source = t('features.coach.modes.practical')
  else if (props.submode === 'finish_him') source = t('features.coach.modes.goto')
  else {
     throw new Error(`[PuzzleSidebar] Unsupported submode source naming: ${props.submode}. Fail-Fast!`)
  }

  emit('loadRequested', {
    type: props.submode,
    category: puzzleStore.activeParams.category || '',
    difficulty: selectedDifficulty.value,
    source,
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
            <n-text class="input-label">{{ t('features.coach.difficultyLabel') }}</n-text>
            <n-radio-group v-model:value="selectedDifficulty" size="medium" expand class="radio-grp">
              <n-radio-button value="Novice" :class="{ 'disabled-diff': currentUserLevel < 1 }">
                {{ t('puzzleCategories.difficulties.level_novice') }}
              </n-radio-button>
              <n-radio-button value="Pro" :class="{ 'disabled-diff': currentUserLevel < 2 }">
                {{ t('puzzleCategories.difficulties.level_pro') }}
              </n-radio-button>
              <n-radio-button value="Master" :class="{ 'disabled-diff': currentUserLevel < 3 }">
                {{ t('puzzleCategories.difficulties.level_master') }}
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
              {{ props.submode === 'tactics' ? t('features.coach.tacticsLabel') : t('features.coach.categoryLabel') }}
            </n-text>
            <div class="tiered-groups-container">
              <VisualRadioGroup
                v-model:value="activeThemeValue"
                :options="basicTierOptions"
                :min-width="115"
                class="tier-basic"
                @update:value="loadPuzzle"
                @click-disabled="handleDisabledClick('basic')"
              />
              <div class="group-divider"></div>
              <VisualRadioGroup
                v-model:value="activeThemeValue"
                :options="premiumTierOptions"
                :min-width="115"
                class="tier-premium"
                @update:value="loadPuzzle"
                @click-disabled="handleDisabledClick('premium')"
              />
              <div class="group-divider"></div>
              <VisualRadioGroup
                v-model:value="activeThemeValue"
                :options="premiumPlusTierOptions"
                :min-width="115"
                class="tier-premium-plus"
                @update:value="loadPuzzle"
                @click-disabled="handleDisabledClick('premiumPlus')"
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
