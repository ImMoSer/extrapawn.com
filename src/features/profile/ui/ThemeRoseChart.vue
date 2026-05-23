<script setup lang="ts">
import type { GameLaunchOptions, PlayPuzzleType } from '@/shared/types/api.types'
import { CloseOutline, ExpandOutline } from '@vicons/ionicons5'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onMounted, onUnmounted, ref, type PropType } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent, TitleComponent])

const { t, te } = useI18n()

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
    type: Object as PropType<Record<PlayPuzzleType, { modes: Record<string, Record<string, ThemeStat[]>> }>>,
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
const activeDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')

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
  const puzzleData = props.stats[activePuzzleType.value]
  if (!puzzleData || !puzzleData.modes) return []

  return puzzleData.modes['win']?.[activeDifficulty.value] || []
})

const chartData = computed(() => {
  return currentThemes.value
    .map((item) => {
      const accuracy = item.requested > 0 ? (item.success / item.requested) * 100 : 0
      return {
        name: item.category,
        value: viewMode.value === 'rating' ? item.rating : Math.round(accuracy),
        raw: item,
      }
    })
    .sort((a, b) => b.value - a.value)
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
            if (te(`chess.tactics.${theme}`)) themeName = t(`chess.tactics.${theme}`)
            else if (te(`chess.themes.${theme}`)) themeName = t(`chess.themes.${theme}`)
            else if (te(`chess.subThemes.${theme}`)) themeName = t(`chess.subThemes.${theme}`)

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
  if (te(`chess.tactics.${theme}`)) themeName = t(`chess.tactics.${theme}`)
  else if (te(`chess.themes.${theme}`)) themeName = t(`chess.themes.${theme}`)
  else if (te(`chess.subThemes.${theme}`)) themeName = t(`chess.subThemes.${theme}`)

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

  const modeName = t(`features.userCabinet.stats.modes.${activePuzzleType.value}`)
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
          <n-radio-button value="rating">{{ t('features.userCabinet.analyticsTable.rating') }}</n-radio-button>
          <n-radio-button value="accuracy">{{ t('features.userCabinet.analyticsTable.accuracy') }}</n-radio-button>
        </n-radio-group>
      </div>
    </div>

    <div class="puzzle-type-selector">
      <n-tabs type="segment" size="small" :value="activePuzzleType" @update:value="handleTabChange">
        <n-tab name="tactics">{{ t('features.userCabinet.stats.modes.tactics') }}</n-tab>
        <n-tab name="finish_him">{{ t('features.userCabinet.stats.modes.finishHim') }}</n-tab>
        <n-tab name="practical_chess">{{ t('features.userCabinet.stats.modes.practical') }}</n-tab>
        <n-tab name="theory_endings">{{ t('features.userCabinet.stats.modes.theory') }}</n-tab>
      </n-tabs>
    </div>

    <div class="chart-wrapper">
      <v-chart class="chart" :option="option" @click="onChartClick" autoresize />
    </div>

    <div class="chart-footer">
      <n-radio-group v-model:value="activeDifficulty" size="small">
        <n-radio-button value="Novice">Novice</n-radio-button>
        <n-radio-button value="Pro">Pro</n-radio-button>
        <n-radio-button value="Master">Master</n-radio-button>
      </n-radio-group>
    </div>

    <!-- Zoom Modal (simplified for now) -->
    <n-modal v-model:show="showModal" preset="card" class="zoom-modal" :title="title" style="width: 90vw; max-width: 1200px">
      <div class="modal-content">
        <div class="modal-controls">
           <n-tabs type="segment" :value="activePuzzleType" @update:value="handleTabChange">
            <n-tab name="tactics">{{ t('features.userCabinet.stats.modes.tactics') }}</n-tab>
            <n-tab name="finish_him">{{ t('features.userCabinet.stats.modes.finishHim') }}</n-tab>
            <n-tab name="practical_chess">{{ t('features.userCabinet.stats.modes.practical') }}</n-tab>
            <n-tab name="theory_endings">{{ t('features.userCabinet.stats.modes.theory') }}</n-tab>
          </n-tabs>

          <n-radio-group v-model:value="activeDifficulty" size="medium">
            <n-radio-button value="Novice">Novice</n-radio-button>
            <n-radio-button value="Pro">Pro</n-radio-button>
            <n-radio-button value="Master">Master</n-radio-button>
          </n-radio-group>
        </div>
        <div class="modal-chart-wrapper">
          <v-chart class="chart" :option="option" autoresize />
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
            <span>{{ t('features.userCabinet.analyticsTable.rating') }}:</span>
            <span class="rating-val">{{ activePopup.data.rating }}</span>
          </div>
          <div class="popup-row">
            <span>{{ t('features.userCabinet.analyticsTable.accuracy') }}:</span>
            <span class="accuracy-val" :class="{ 'high-acc': activePopup.data.accuracy > 70, 'low-acc': activePopup.data.accuracy <= 70 }">{{ activePopup.data.accuracy }}%</span>
          </div>
          <div class="popup-row">
            <span>{{ t('features.userCabinet.stats.success') }}:</span>
            <span>{{ activePopup.data.success }} / {{ activePopup.data.requested }}</span>
          </div>
        </div>
        <div class="popup-footer">
          <n-button type="primary" block @click="onImproveClick" class="improve-btn" :disabled="isLocked" :class="{ 'is-locked': isLocked }">
            {{ t('features.userCabinet.stats.improve') }}
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
  height: 600px;
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
</style>
