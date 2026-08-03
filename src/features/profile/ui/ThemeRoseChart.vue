<script setup lang="ts">
import type { GameLaunchOptions, PlayPuzzleType, UserProfileStatEntry } from '@/shared/types/api.types'
import { CloseOutline, ExpandOutline } from '@vicons/ionicons5'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onMounted, onUnmounted, ref, type PropType } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'

import { useRouter } from 'vue-router'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent, TitleComponent])

const { t, te } = useI18n()
const router = useRouter()



import { tokens } from '@/shared/theme/tokens'

const PALETTE = [
  tokens.neonCyan,
  tokens.danger,
  tokens.acidGreen,
  tokens.neonPurple,
  tokens.warning,
  tokens.info,
  tokens.orange,
  tokens.magenta,
  tokens.mint,
  tokens.amber,
  tokens.highlight,
  tokens.success,
  tokens.orangeWarm,
  tokens.dangerDeep,
  tokens.cyanDeep,
  tokens.purpleDeep,
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
  const stats = props.stats || []

  const rawThemes = stats.filter((s) => {
    return s.game_mode === 'playPuzzle' &&
           s.sub_mode === activePuzzleType.value
  })

  return rawThemes.map((item) => {
    return {
      category: item.category,
      rating: item.rating,
      success: item.puzzles_solved,
      requested: item.puzzles_solved + item.puzzles_failed,
    }
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
  <div class="w-full bg-surface rounded-lg p-4 border border-border flex flex-col box-border">
    <div class="flex justify-between items-center mb-3">
      <div class="flex items-center gap-2">
        <h3 class="m-0 text-neon-cyan text-xl font-bold font-display">{{ title }}</h3>
        <n-button quaternary circle size="small" @click="showModal = true">
          <template #icon>
            <n-icon :component="ExpandOutline" />
          </template>
        </n-button>
      </div>

      <div>
        <n-radio-group v-model:value="viewMode" size="small">
          <n-radio-button value="rating">{{ t('pages.userCabinet.analyticsTable.rating') }}</n-radio-button>
          <n-radio-button value="accuracy">{{ t('pages.userCabinet.analyticsTable.accuracy') }}</n-radio-button>
        </n-radio-group>
      </div>
    </div>

    <div class="mb-2.5">
      <n-tabs type="segment" size="small" :value="activePuzzleType" @update:value="handleTabChange">
        <n-tab name="tactics">{{ t('pages.userCabinet.stats.modes.tactics') }}</n-tab>
        <n-tab name="finish_him">{{ t('pages.userCabinet.stats.modes.finishHim') }}</n-tab>
        <n-tab name="practical_chess">{{ t('pages.userCabinet.stats.modes.practical') }}</n-tab>
      </n-tabs>
    </div>

    <div class="w-full h-[70vh] max-md:h-[300px]">
      <v-chart v-if="chartData.length > 0" class="w-full h-full" :option="option" @click="onChartClick" autoresize />
      <div v-else class="flex justify-center items-center w-full h-full min-h-[250px]">
        <n-empty :description="t('pages.userCabinet.stats.noData')">
          <template #extra>
            <n-button type="primary" size="small" @click="router.push('/task-today')">
              {{ t('puzzleCategories.tierRestriction.makeTaskToday') }}
            </n-button>
          </template>
        </n-empty>
      </div>
    </div>

    <!-- Zoom Modal -->
    <n-modal v-model:show="showModal" preset="card" class="zoom-modal" :title="title" style="width: 90vw; max-width: 1200px">
      <div class="flex flex-col gap-4">
        <div class="flex justify-between items-center gap-4 flex-wrap">
           <n-tabs type="segment" :value="activePuzzleType" @update:value="handleTabChange">
            <n-tab name="tactics">{{ t('pages.userCabinet.stats.modes.tactics') }}</n-tab>
            <n-tab name="finish_him">{{ t('pages.userCabinet.stats.modes.finishHim') }}</n-tab>
            <n-tab name="practical_chess">{{ t('pages.userCabinet.stats.modes.practical') }}</n-tab>
          </n-tabs>
        </div>
        <div class="w-full h-[60vh]">
          <v-chart v-if="chartData.length > 0" class="w-full h-full" :option="option" autoresize />
          <div v-else class="flex justify-center items-center w-full h-full min-h-[250px]">
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

    <!-- Popup -->
    <Teleport to="body">
      <div v-if="activePopup.visible && activePopup.data" ref="popupRef" class="fixed z-[9999] bg-elevated/90 backdrop-blur-md border border-neon-cyan/50 rounded-lg p-3 shadow-elevated min-w-[200px]" :style="{ top: `${activePopup.y}px`, left: `${activePopup.x}px` }">
        <div class="flex justify-between items-center mb-2 border-b border-border pb-1.5">
          <span class="font-bold text-text-primary text-xs">{{ activePopup.data.modeName }}</span>
          <n-button circle size="tiny" type="error" ghost @click="activePopup.visible = false">
            <template #icon><n-icon :component="CloseOutline" /></template>
          </n-button>
        </div>
        <div class="flex flex-col gap-1 text-sm">
          <div class="text-base font-bold mb-2 text-neon-cyan font-display">{{ activePopup.data.themeName }}</div>
          <div class="flex justify-between text-xs">
            <span>{{ t('pages.userCabinet.analyticsTable.rating') }}:</span>
            <span class="font-condensed font-bold text-warning">{{ activePopup.data.rating }}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span>{{ t('pages.userCabinet.analyticsTable.accuracy') }}:</span>
            <span class="font-condensed font-bold" :class="activePopup.data.accuracy > 70 ? 'text-success' : 'text-warning'">{{ activePopup.data.accuracy }}%</span>
          </div>
          <div class="flex justify-between text-xs text-text-secondary">
            <span>{{ t('pages.userCabinet.stats.success') }}:</span>
            <span class="font-condensed">{{ activePopup.data.success }} / {{ activePopup.data.requested }}</span>
          </div>
        </div>
        <div class="mt-3">
          <n-button type="primary" block @click="onImproveClick" class="font-bold" :disabled="isLocked">
            {{ t('pages.userCabinet.stats.improve') }}
          </n-button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
