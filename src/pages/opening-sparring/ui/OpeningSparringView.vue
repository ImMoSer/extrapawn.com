<!-- src/pages/OpeningSparringView.vue -->
<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { theoryGraphService, useTheoryStore } from '@/entities/opening'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import { EngineSelector } from '@/features/engine'
import { MozerBook } from '@/features/mozer-book'
import {
  OpeningSparringSettingsModal,
  OpeningSparringSummaryModal,
  SessionHistoryList,
  useOpeningSparringStore,
  useSparringLoop,
} from '@/features/opening-sparring'
import { useSmartHintStore } from '@/features/smart-hint'
import i18n from '@/shared/config/i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { ControlPanel, GameLayout, TopInfoPanel, useControlsStore } from '@/widgets/game-layout'
import { EyeOffOutline, EyeOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NText, NTooltip } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'

const t = i18n.global.t
const controlsStore = useControlsStore()
const openingStore = useOpeningSparringStore()
const theoryStore = useTheoryStore()
const gameStore = useGameStore()
const uiStore = useUiStore()
const analysisStore = useAnalysisStore()
const smartHintStore = useSmartHintStore()
const router = useRouter()
const route = useRoute()
const loop = useSparringLoop()

const isSettingsModalOpen = ref(true)
const showSummaryModal = ref(false)
const isNavigatingToPlayout = ref(false)
const lastSessionParams = ref<{ color: 'white' | 'black'; moves: string[]; slug?: string } | null>(
  null,
)

const isExamEnding = computed(() => openingStore.isTheoryOver || openingStore.isDeviation)

// Watch for game over in playout mode - transition to analysis/review directly
watch(
  () => gameStore.gamePhase,
  (phase) => {
    if (phase === 'GAMEOVER' && openingStore.isPlayoutMode) {
      // Delay slightly to let board update final state/sound
      setTimeout(() => {
        openingStore.enterReviewMode()
      }, 1000)
    }
  },
)

// Automatically handle analysis panel in Exam mode
watch(
  isExamEnding,
  async (isEnding) => {
    if (isEnding && !openingStore.isPlayoutMode && !openingStore.isReviewMode) {
      showSummaryModal.value = true
      await openingStore.runFinalEvaluation()
    } else if (!isEnding) {
      analysisStore.hidePanel()
      showSummaryModal.value = false
    }
  },
  { immediate: true },
)

const showAnalysisPanel = computed(() => {
  return openingStore.isReviewMode
})

// Trigger fetch when book is toggled back on
watch(
  () => openingStore.showMozerBook,
  (show) => {
    if (
      show &&
      !openingStore.isPlayoutMode &&
      !openingStore.isReviewMode &&
      gameStore.gamePhase === 'PLAYING'
    ) {
      loop.fetchStats()
    }
  },
)

onMounted(async () => {
  theoryStore.setForceSkipDebounceGlobal(true)
  if (route.params.openingSlug || route.params.color) {
    await handleRouteParams()
  }
})

async function handleRouteParams() {
  let slug = route.params.openingSlug as string | undefined
  let colorParam = route.params.color as string | undefined
  let color: 'white' | 'black' = 'white'
  let moves: string[] = []

  if (slug) {
    if (slug === 'white' || slug === 'black' || slug === 'for_white' || slug === 'for_black') {
      colorParam = slug
      slug = undefined
    } else if (slug === 'start') {
      slug = undefined
    }
  }

  if (colorParam) {
    const normalized = colorParam.replace('for_', '')
    if (normalized === 'white' || normalized === 'black') color = normalized
  }

  if (slug) {
    const opening = theoryGraphService.findOpeningBySlug(slug)
    if (opening) moves = opening.moves
  }

  if (slug || colorParam) {
    await startSession(color, moves, slug)
  }
}

onUnmounted(() => {
  theoryStore.setForceSkipDebounceGlobal(false)
  openingStore.reset()
  analysisStore.hidePanel()
  analysisStore.setPlayerColor(null)
  if (!isNavigatingToPlayout.value) {
    gameStore.resetGame()
  }
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

async function startSession(color: 'white' | 'black', moves: string[] = [], slug?: string) {
  lastSessionParams.value = { color, moves, slug }
  isSettingsModalOpen.value = false
  showSummaryModal.value = false
  analysisStore.setPlayerColor(color)
  analysisStore.hidePanel()
  smartHintStore.resetHints(3)

  if (slug) {
    router.replace({
      name: 'opening-sparring',
      params: { openingSlug: slug, color: `for_${color}` },
    })
  } else {
    router.replace({ name: 'opening-sparring' })
  }

  // initializeSession now handles GameStore setup and stats fetching internally
  await openingStore.initializeSession(color, moves, loop.createStrategy())
}

async function handleNewGame() {
  const confirmed = await uiStore.showConfirmation(
    t('features.gameplay.confirmExit.title'),
    'Start a new sparring?',
  )
  if (confirmed === 'confirm') {
    openingStore.reset()
    await gameStore.resetGame()
    isSettingsModalOpen.value = true
    showSummaryModal.value = false
  }
}

async function handleRestart() {
  const confirmed = await uiStore.showConfirmation(
    t('features.gameplay.confirmExit.title'),
    'Start a new sparring?',
  )
  if (confirmed === 'confirm') {
    openingStore.reset()
    await gameStore.resetGame()
    showSummaryModal.value = false
    if (lastSessionParams.value) {
      await startSession(
        lastSessionParams.value.color,
        lastSessionParams.value.moves,
        lastSessionParams.value.slug,
      )
    } else {
      isSettingsModalOpen.value = true
    }
  }
}

function handleSummaryPlayout() {
  showSummaryModal.value = false
  loop.startPlayout()
}

function handleSummaryAnalyze() {
  showSummaryModal.value = false
  openingStore.enterReviewMode()
  gameStore.setGamePhase('GAMEOVER')
}

async function handleSummaryRestart() {
  showSummaryModal.value = false
  openingStore.reset()
  await gameStore.resetGame()
  if (lastSessionParams.value) {
    await startSession(
      lastSessionParams.value.color,
      lastSessionParams.value.moves,
      lastSessionParams.value.slug,
    )
  } else {
    isSettingsModalOpen.value = true
  }
}

watch(
  () => [gameStore.gamePhase, openingStore.isPlayoutMode, isExamEnding.value],
  () => {
    const isPlaying = gameStore.gamePhase === 'PLAYING'
    const isTheoryPhase = !isExamEnding.value
    const isSparringActive = isTheoryPhase || openingStore.isPlayoutMode

    controlsStore.setControls({
      canRequestNew: true,
      canRestart: true,
      canResign: isPlaying && isSparringActive && !openingStore.isReviewMode,
      canShare: false,
      canRequestHint: isPlaying && isSparringActive && !openingStore.isReviewMode,
      onRequestNew: handleNewGame,
      onRestart: handleRestart,
    })
  },
  { immediate: true },
)

function goBack() {
  router.push({ name: 'welcome' })
}
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <div class="left-panel-content">
        <div class="mozer-book-header">
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                quaternary
                circle
                size="small"
                class="toggle-book-btn"
                @click="openingStore.showMozerBook = !openingStore.showMozerBook"
              >
                <template #icon>
                  <n-icon>
                    <EyeOutline v-if="openingStore.showMozerBook" />
                    <EyeOffOutline v-else />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ openingStore.showMozerBook ? 'Hide Book' : 'Show Book' }}
          </n-tooltip>
        </div>

        <div class="mozer-book-wrapper" v-if="openingStore.showMozerBook">
          <MozerBook
            :blurred="openingStore.isPlayoutMode"
            :is-paused="openingStore.isPlayoutMode"
          />
        </div>
        <div v-else class="book-placeholder">
          <div class="placeholder-content">
            <n-icon size="48" depth="3"><EyeOffOutline /></n-icon>
            <n-text depth="3">MozerBook is hidden</n-text>
            <n-button secondary size="small" @click="openingStore.showMozerBook = true">
              Show Theory
            </n-button>
          </div>
        </div>
      </div>

      <OpeningSparringSettingsModal
        v-if="isSettingsModalOpen"
        @start="startSession"
        @close="goBack"
      />
      <OpeningSparringSummaryModal
        :show="showSummaryModal"
        @close="showSummaryModal = false"
        @playout="handleSummaryPlayout"
        @analyze="handleSummaryAnalyze"
        @restart="handleSummaryRestart"
      >
        <template #engine-selector>
          <EngineSelector />
        </template>
      </OpeningSparringSummaryModal>
    </template>

    <template #top-info>
      <TopInfoPanel />
    </template>

    <template #center-column>
      <!-- Loader removed to prevent blinking -->
    </template>

    <template #controls>
      <ControlPanel />
    </template>

    <template #right-panel>
      <AnalysisPanel
        v-if="showAnalysisPanel"
        :show-pgn="false"
        style="margin-bottom: 12px; flex-shrink: 0"
      />

      <SessionHistoryList />

      <div v-if="openingStore.error" class="error-msg">
        {{ openingStore.error }}
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.left-panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.mozer-book-wrapper {
  flex: 1;
  min-height: 0; /* Important for flex child scroll */
}

.mozer-book-header {
  display: flex;
  justify-content: flex-end;
  padding: 0 8px;
}

.book-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin: 12px;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  opacity: 0.6;
}

.history-list-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.review-engine-container {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.loader-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-msg {
  color: #f44336;
  padding: 10px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  margin-top: 10px;
  text-align: center;
}

.opening-top-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(4px);
}

.opening-name-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 0.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.eco-tag {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  background: var(--color-accent-primary-alpha) !important;
  color: var(--color-accent-primary) !important;
}
</style>
