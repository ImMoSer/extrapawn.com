<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import type { GameLaunchOptions, PlayPuzzleType, SubscriptionTier, UserProfileStatEntry } from '@/shared/types/api.types'
import { CloseOutline, ExpandOutline } from '@vicons/ionicons5'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useDialog } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, type PropType } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent, TitleComponent])

const { t, te } = useI18n()
const authStore = useAuthStore()
const dialog = useDialog()
const router = useRouter()

const TIER_LEVELS: Record<SubscriptionTier | 'Guest', number> = {
  Guest: 0,
  Pawn: 1,
  Knight: 2,
  Bishop: 2,
  Rook: 3,
  Queen: 3,
  King: 3,
  administrator: 4,
}

const currentUserTier = computed<SubscriptionTier | 'Guest'>(() => {
  if (!authStore.isAuthenticated || !authStore.userProfile) {
    return 'Guest'
  }
  const tier = authStore.userProfile.subscriptionTier
  if (!(tier in TIER_LEVELS)) {
    throw new Error(`[ThemeRoseChart] Unexpected subscriptionTier: "${tier}". Fail-Fast!`)
  }
  return tier as SubscriptionTier
})

const currentUserLevel = computed<number>(() => {
  return TIER_LEVELS[currentUserTier.value] ?? 0
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

const basicEndgameKeys = ['pawnEnding', 'rookEnding', 'bishopVsPawns', 'knightVsPawns', 'rookVsPawns', 'extraPawn', 'extrapawn']
const premiumEndgameKeys = ['sameColorBishops', 'oppositeColorBishops', 'knightEnding', 'bishopVsKnight', 'doubleRookEnding', 'rookVsMinor', 'queenEnding']
const premiumPlusEndgameKeys = ['queenVsRook', 'rookVsTwoMinors', 'queenVsMinors', 'queenVsRookMinor', 'queenMinorVsQueenMinor', 'rookMinorVsRook', 'rookMinorVsRookMinor']

const basicTacticKeys = ['hangingPiece', 'fork', 'pin', 'backRankMate', 'skewer', 'discoveredAttack']
const premiumTacticKeys = ['capturingDefender', 'attraction', 'deflection', 'trappedPiece', 'kingAttack', 'advancedPawn', 'xRayAttack']
const premiumPlusTacticKeys = ['sacrifice', 'intermezzo', 'clearance', 'interference', 'quietMove', 'defensiveMove', 'zugzwang']

const PALETTE = [
  '#00e5ff', // 1. Cyan (Extrem hell/kalt)
  '#ff073a', // 2. Red (Dunkler/heiß) -> Maximaler Split zu Cyan
  '#39ff14', // 3. Acid Green (Grell/Leuchtend)
  '#7a00ff', // 4. Violet (Dunkel/Absorbierend) -> Schluckt das Grün
  '#ffe600', // 5. Yellow (Maximaler Helligkeits-Schnitt zu Violett)
  '#0055ff', // 6. Blue (Tiefblau gegen Gelb)
  '#ff5500', // 7. Orange (Komplementär zu Blau)
  '#b000ff', // 8. Purple (Wechsel zu Dunkel-Magenta-Ton)
  '#aaff00', // 9. Toxic (Grellgelb-Grün gegen Lila)
  '#ff00c8', // 10. Magenta (Heißer Kontrast zu Toxic)
  '#00ffcc', // 11. Mint (Eisiger Kontrast zu Magenta)
  '#d9004c', // 12. Bordeaux (Dunkel/Satt gegen Mint)
  '#66ccff', // 13. Ice Blue (Hell gegen Bordeaux)
  '#ff9900', // 14. Amber (Warm/Dunkelorange gegen Ice Blue)
  '#ff007a', // 15. Pink (Knallig gegen Amber)
  '#00ff99', // 16. Green Mint (Kalt gegen Pink)
  '#ff3366', // 17. Raspberry (Dunkles Pink-Rot)
  '#00aaff', // 18. Sky (Hellblau gegen Raspberry)
  '#ff66cc', // 19. Bubblegum (Hellpink)
  '#00ff55'  // 20. Lime (Grellgrün - schließt perfekt ab zu Cyan auf Position 1)
]

interface ThemeStat {
  category: string
  rating: number
  success: number
  requested: number
}

interface RoseParam {
  data: {
    raw: ThemeStat
  }
  name: string
  event: {
    event: MouseEvent
  }
}

interface PopupData {
  modeName: string
  subModeName: string
  themeName: string
  rating: number
  accuracy: number
  success: number
  requested: number
  category: string
  puzzleType: PlayPuzzleType
  difficulty: string
}

const props = defineProps({
  stats: {
    type: Array as PropType<UserProfileStatEntry[]>,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  initialPuzzleType: {
    type: String as PropType<PlayPuzzleType>,
    default: 'tactics',
  },
})

const emit = defineEmits<{
  (e: 'improve', options: GameLaunchOptions): void
}>()

const activePuzzleType = ref<PlayPuzzleType>(props.initialPuzzleType)
const _activeDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')
const activeDifficulty = computed({
  get: () => _activeDifficulty.value,
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
    _activeDifficulty.value = newDiff
  }
})

const activePopup = ref<{ visible: boolean; x: number; y: number; data: PopupData | null }>({
  visible: false,
  x: 0,
  y: 0,
  data: null,
})
const popupRef = ref<HTMLElement | null>(null)
const lastOpenTime = ref(0)
const isLocked = ref(false)

// Close popup when clicking outside
const handleClickOutside = (event: MouseEvent | TouchEvent) => {
  if (Date.now() - lastOpenTime.value < 100) return

  if (
    activePopup.value.visible &&
    popupRef.value &&
    !popupRef.value.contains(event.target as Node)
  ) {
    activePopup.value.visible = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('touchstart', handleClickOutside, { passive: true })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchstart', handleClickOutside)
})

const viewMode = ref<'rating' | 'accuracy'>('rating')
const showModal = ref(false)

const currentThemes = computed<ThemeStat[]>(() => {
  const stats = props.stats || []

  const rawThemes = stats.filter((s) => {
    return s.game_mode === 'playPuzzle' &&
           s.sub_mode === activePuzzleType.value &&
           s.difficulty === activeDifficulty.value
  })

  return rawThemes.map((item) => {
    return {
      category: item.category,
      rating: item.rating,
      success: item.puzzles_solved,
      requested: item.puzzles_solved + item.puzzles_failed,
    }
  }).filter((item) => {
    const cat = item.category
    const isTactic = activePuzzleType.value === 'tactics'
    const tierLevel = currentUserLevel.value

    const isBasic = isTactic ? basicTacticKeys.includes(cat) : basicEndgameKeys.includes(cat)
    if (isBasic) return tierLevel >= 1

    const isPremium = isTactic ? premiumTacticKeys.includes(cat) : premiumEndgameKeys.includes(cat)
    if (isPremium) return tierLevel >= 2

    const isPremiumPlus = isTactic ? premiumPlusTacticKeys.includes(cat) : premiumPlusEndgameKeys.includes(cat)
    if (isPremiumPlus) return tierLevel >= 3

    return tierLevel >= 3
  })
})

const chartData = computed(() => {
  const baseThemes = currentThemes.value
    .map((item) => {
      const accuracy = item.requested > 0 ? (item.success / item.requested) * 100 : 0
      return {
        name: item.category,
        value: viewMode.value === 'rating' ? item.rating : Math.round(accuracy),
        raw: item,
      }
    })
    .sort((a, b) => b.value - a.value)

  return baseThemes.map((item, i) => {
    const colorIdx = i % PALETTE.length
    return {
      ...item,
      itemStyle: {
        color: PALETTE[colorIdx],
      },
    }
  })
})

const option = computed(() => {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: false,
    },
    series: [
      {
        name: props.title,
        type: 'pie',
        radius: ['10%', '70%'],
        center: ['50%', '50%'],
        roseType: 'radius',
        itemStyle: {
          borderRadius: 5,
        },
        label: {
          show: true,
          color: '#CCCCCC',
          formatter: (params: unknown) => {
            const p = params as RoseParam
            const theme = p.name
            let themeName = theme
            if (te(`puzzleCategories.tactics.${theme}`)) themeName = t(`puzzleCategories.tactics.${theme}`)
            else if (te(`puzzleCategories.themes.${theme}`)) themeName = t(`puzzleCategories.themes.${theme}`)
            else if (te(`puzzleCategories.subThemes.${theme}`)) themeName = t(`puzzleCategories.subThemes.${theme}`)

            return themeName.length > 100 ? themeName.slice(0, 100) + '..' : themeName
          },
        },
        emphasis: {
          label: {
            show: true,
            fontWeight: 'bold',
          },
        },
        data: chartData.value,
      },
    ],
  }
})

const onChartClick = (params: unknown) => {
  const p = params as RoseParam
  const data = p.data.raw
  const accuracy = data.requested > 0 ? Math.round((data.success / data.requested) * 100) : 0
  const theme = data.category

  let themeName = theme
  if (te(`puzzleCategories.tactics.${theme}`)) themeName = t(`puzzleCategories.tactics.${theme}`)
  else if (te(`puzzleCategories.themes.${theme}`)) themeName = t(`puzzleCategories.themes.${theme}`)
  else if (te(`puzzleCategories.subThemes.${theme}`)) themeName = t(`puzzleCategories.subThemes.${theme}`)

  const ev = p.event.event as Event
  let x = window.innerWidth / 2
  let y = window.innerHeight / 2

  if ('clientX' in ev) {
    x = (ev as MouseEvent).clientX
    y = (ev as MouseEvent).clientY
  }

  if (p.event.event.stopImmediatePropagation) {
    p.event.event.stopImmediatePropagation()
  }

  isLocked.value = true
  setTimeout(() => {
    isLocked.value = false
  }, 1200)

  lastOpenTime.value = Date.now()

  const getModeTranslationKey = (type: PlayPuzzleType): string => {
    switch (type) {
      case 'tactics': return 'pages.userCabinet.stats.modes.tactics'
      case 'finish_him': return 'pages.userCabinet.stats.modes.finishHim'
      case 'practical_chess': return 'pages.userCabinet.stats.modes.practical'
      case 'theory_endings': return 'pages.userCabinet.stats.modes.theory'
      default: return ''
    }
  }

  const modeName = t(getModeTranslationKey(activePuzzleType.value))
  const subModeName = activeDifficulty.value

  activePopup.value = {
    visible: true,
    x: x + 10,
    y: y + 10,
    data: {
      modeName,
      subModeName,
      themeName,
      rating: Math.round(data.rating),
      accuracy,
      success: data.success,
      requested: data.requested,
      category: theme,
      puzzleType: activePuzzleType.value,
      difficulty: activeDifficulty.value,
    },
  }

  nextTick(() => {
    if (popupRef.value) {
      const rect = popupRef.value.getBoundingClientRect()
      let safeX = activePopup.value.x
      let safeY = activePopup.value.y
      const padding = 1
      if (safeX + rect.width + padding > window.innerWidth) safeX = window.innerWidth - rect.width - padding
      if (safeY + rect.height + padding > window.innerHeight) safeY = window.innerHeight - rect.height - padding
      if (safeX < padding) safeX = padding
      if (safeY < padding) safeY = padding
      activePopup.value.x = safeX
      activePopup.value.y = safeY
    }
  })
}

const onImproveClick = () => {
  if (!activePopup.value.data || isLocked.value) return
  const { category, puzzleType, difficulty } = activePopup.value.data
  emit('improve', {
    mode: puzzleType,
    theme: category,
    subMode: 'win',
    difficulty: difficulty,
  })
}

const handleTabChange = (type: PlayPuzzleType) => {
  activePuzzleType.value = type
}
</script>

<template>
  <div class="theme-rose-container">
    <div class="chart-header">
      <div class="header-left-group">
        <h3 class="chart-title">{{ title }}</h3>
        <n-button quaternary circle size="small" @click="showModal = true" class="zoom-btn">
          <template #icon>
            <n-icon :component="ExpandOutline" />
          </template>
        </n-button>
      </div>

      <div class="header-right-group">
        <n-radio-group v-model:value="viewMode" size="small">
          <n-radio-button value="rating">{{ t('pages.userCabinet.analyticsTable.rating') }}</n-radio-button>
          <n-radio-button value="accuracy">{{ t('pages.userCabinet.analyticsTable.accuracy') }}</n-radio-button>
        </n-radio-group>
      </div>
    </div>

    <div class="puzzle-type-selector">
      <n-tabs type="segment" size="small" :value="activePuzzleType" @update:value="handleTabChange">
        <n-tab name="tactics">{{ t('pages.userCabinet.stats.modes.tactics') }}</n-tab>
        <n-tab name="finish_him">{{ t('pages.userCabinet.stats.modes.finishHim') }}</n-tab>
        <n-tab name="practical_chess">{{ t('pages.userCabinet.stats.modes.practical') }}</n-tab>
      </n-tabs>
    </div>

    <div class="chart-wrapper">
      <v-chart v-if="chartData.length > 0" class="chart" :option="option" @click="onChartClick" autoresize />
      <div v-else class="empty-chart-container">
        <n-empty :description="t('pages.userCabinet.stats.noData')">
          <template #extra>
            <n-button type="primary" size="small" @click="router.push('/task-today')">
              {{ t('puzzleCategories.tierRestriction.makeTaskToday') }}
            </n-button>
          </template>
        </n-empty>
      </div>
    </div>

    <div class="chart-footer">
      <n-radio-group v-model:value="activeDifficulty" size="small">
        <n-radio-button value="Novice" :class="{ 'disabled-diff': currentUserLevel < 1 }">{{ t('puzzleCategories.difficulties.level_novice') }}</n-radio-button>
        <n-radio-button value="Pro" :class="{ 'disabled-diff': currentUserLevel < 2 }">{{ t('puzzleCategories.difficulties.level_pro') }}</n-radio-button>
        <n-radio-button value="Master" :class="{ 'disabled-diff': currentUserLevel < 3 }">{{ t('puzzleCategories.difficulties.level_master') }}</n-radio-button>
      </n-radio-group>
    </div>

    <!-- Zoom Modal (simplified for now) -->
    <n-modal v-model:show="showModal" preset="card" class="zoom-modal" :title="title" style="width: 90vw; max-width: 1200px">
      <div class="modal-content">
        <div class="modal-controls">
           <n-tabs type="segment" :value="activePuzzleType" @update:value="handleTabChange">
            <n-tab name="tactics">{{ t('pages.userCabinet.stats.modes.tactics') }}</n-tab>
            <n-tab name="finish_him">{{ t('pages.userCabinet.stats.modes.finishHim') }}</n-tab>
            <n-tab name="practical_chess">{{ t('pages.userCabinet.stats.modes.practical') }}</n-tab>
          </n-tabs>

          <n-radio-group v-model:value="activeDifficulty" size="medium">
            <n-radio-button value="Novice" :class="{ 'disabled-diff': currentUserLevel < 1 }">{{ t('puzzleCategories.difficulties.level_novice') }}</n-radio-button>
            <n-radio-button value="Pro" :class="{ 'disabled-diff': currentUserLevel < 2 }">{{ t('puzzleCategories.difficulties.level_pro') }}</n-radio-button>
            <n-radio-button value="Master" :class="{ 'disabled-diff': currentUserLevel < 3 }">{{ t('puzzleCategories.difficulties.level_master') }}</n-radio-button>
          </n-radio-group>
        </div>
        <div class="modal-chart-wrapper">
          <v-chart v-if="chartData.length > 0" class="chart" :option="option" autoresize />
          <div v-else class="empty-chart-container">
            <n-empty :description="t('pages.userCabinet.stats.noData')">
              <template #extra>
                <n-button type="primary" size="small" @click="router.push('/task-today')">
                  {{ t('puzzleCategories.tierRestriction.makeTaskToday') }}
                </n-button>
              </template>
            </n-empty>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- Popup remains same as before -->
    <Teleport to="body">
      <div v-if="activePopup.visible && activePopup.data" ref="popupRef" class="chart-popup" :style="{ top: `${activePopup.y}px`, left: `${activePopup.x}px` }">
        <div class="popup-header">
          <span class="popup-title">{{ activePopup.data.modeName }} {{ activePopup.data.subModeName }}</span>
          <n-button circle size="tiny" type="error" ghost @click="activePopup.visible = false" class="close-btn">
            <template #icon><n-icon :component="CloseOutline" /></template>
          </n-button>
        </div>
        <div class="popup-content">
          <div class="popup-theme-name">{{ activePopup.data.themeName }}</div>
          <div class="popup-row">
            <span>{{ t('pages.userCabinet.analyticsTable.rating') }}:</span>
            <span class="rating-val">{{ activePopup.data.rating }}</span>
          </div>
          <div class="popup-row">
            <span>{{ t('pages.userCabinet.analyticsTable.accuracy') }}:</span>
            <span class="accuracy-val" :class="{ 'high-acc': activePopup.data.accuracy > 70, 'low-acc': activePopup.data.accuracy <= 70 }">{{ activePopup.data.accuracy }}%</span>
          </div>
          <div class="popup-row">
            <span>{{ t('pages.userCabinet.stats.success') }}:</span>
            <span>{{ activePopup.data.success }} / {{ activePopup.data.requested }}</span>
          </div>
        </div>
        <div class="popup-footer">
          <n-button type="primary" block @click="onImproveClick" class="improve-btn" :disabled="isLocked" :class="{ 'is-locked': isLocked }">
            {{ t('pages.userCabinet.stats.improve') }}
          </n-button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Keep existing styles, adding tab styling if needed */
.puzzle-type-selector {
  margin-bottom: 10px;
}

.theme-rose-container {
  width: 100%;
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  padding: 15px;
  border: 1px solid var(--color-border);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-title {
  margin: 0;
  color: var(--color-accent-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.chart-wrapper {
  width: 100%;
  height: 70vh;
}

.chart {
  width: 100%;
  height: 100%;
}

.chart-footer {
  display: flex;
  justify-content: center;
  margin-top: 15px;
}

/* Popup and other styles omitted for brevity, but should be preserved */
.chart-popup {
  position: fixed;
  z-index: 9999;
  background-color: var(--glass-bg, var(--color-bg-tertiary));
  backdrop-filter: var(--glass-blur, blur(12px));
  border: 1px solid color-mix(in srgb, var(--neon-cyan) 50%, transparent);
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 200px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 6px;
}

.popup-title {
  font-weight: bold;
  color: var(--color-text-primary);
}

.popup-theme-name {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--neon-cyan);
}

.popup-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 0.9rem;
}

.rating-val {
  color: #f39c12;
  font-weight: bold;
}

.high-acc {
  color: var(--color-success);
}

.low-acc {
  color: #f39c12;
}

.improve-btn {
  margin-top: 10px;
  font-weight: bold;
}

@media (max-width: 768px) {
  .chart-wrapper {
    height: 300px;
  }
}

/* Disabled difficulty button styling */
:deep(.n-radio-group .n-radio-button.disabled-diff) {
  opacity: 0.45;
  cursor: not-allowed !important;
}
:deep(.n-radio-group .n-radio-button.disabled-diff *) {
  cursor: not-allowed !important;
}

.empty-chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 250px;
}
</style>
