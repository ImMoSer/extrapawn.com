<script setup lang="ts">
import { useSpeedrunStore } from '../model/speedrun.store'
import { GameLayout } from '@/widgets/game-layout'
import { NButton, NIcon, NText, NProgress, NList, NListItem, NScrollbar, NThing } from 'naive-ui'
import { CloseCircleOutline, RefreshOutline as RestartIcon } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import { useStudyStore, type StudyChapter } from '@/features/study'
import { useI18n } from 'vue-i18n'
import SpeedrunSetupModal from './SpeedrunSetupModal.vue'

const { t } = useI18n()
const speedrunStore = useSpeedrunStore()
const studyStore = useStudyStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const route = useRoute()

const showSetupModal = ref(false)
const pendingChapters = ref<StudyChapter[]>([])

onMounted(() => {
  const studyId = route.query.studyId as string
  if (studyId) {
    const chapters = studyStore.chapters.filter(c => c.studyId === studyId && c.chapter_type === 'speedrun')
    if (chapters.length > 0) {
      pendingChapters.value = chapters
      showSetupModal.value = true
    } else {
      router.push('/study')
    }
  } else if (!speedrunStore.isPlaying) {
    router.push('/study')
  }
})

function handleConfirmStart() {
  speedrunStore.startSpeedrun(pendingChapters.value)
}

function handleCancelStart() {
  router.push('/study')
}

const formattedTime = computed(() => {
  return speedrunStore.formatMs(speedrunStore.currentTimeMs)
})

const targetText = computed(() => {
  const result = speedrunStore.currentChapter?.tags.Result
  if (result === '1/2-1/2') return t('chess.types.draw')
  return t('chess.types.win')
})

const targetClass = computed(() => {
  const result = speedrunStore.currentChapter?.tags.Result
  return result === '1/2-1/2' ? 'target-draw' : 'target-win'
})

const progressPercentage = computed(() => {
  if (speedrunStore.totalChapters === 0) return 0
  return (speedrunStore.currentChapterIndex / speedrunStore.totalChapters) * 100
})

function handleQuit() {
  speedrunStore.quitSpeedrun()
  router.push('/study')
}

function handleRestart() {
  speedrunStore.restartCurrentChapter()
}

function handleJump(index: number) {
  // Only allow jumping to chapters that haven't been completed yet
  // OR the current one (which is effectively a restart)
  if (speedrunStore.chapterTimes[index] === undefined || speedrunStore.currentChapterIndex === index) {
    speedrunStore.jumpToChapter(index)
  }
}

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

// Ensure cleanup if user navigates away
onUnmounted(() => {
  analysisStore.hidePanel()
  if (speedrunStore.isPlaying) {
    speedrunStore.quitSpeedrun()
  }
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <div class="speedrun-sidebar">
        <h2 class="speedrun-title">{{ t('features.speedrun.title') }}</h2>
        
        <div v-if="speedrunStore.isFinished" class="speedrun-finished">
          <NText type="success" strong>{{ t('features.speedrun.completed') }}</NText>
          <div class="total-time-label" style="margin-top: 16px; font-size: 0.9rem; opacity: 0.8;">{{ t('features.speedrun.totalTime') }}</div>
          <div class="final-timer">{{ speedrunStore.formatMs(speedrunStore.totalTimeMs) }}</div>
          <NButton type="primary" @click="handleQuit" style="margin-top: 1rem;">
            {{ t('features.speedrun.returnToStudy') }}
          </NButton>
        </div>

        <div v-else-if="speedrunStore.currentChapter" class="speedrun-info">
          <div class="chapter-info">
            <NText depth="3" class="chapter-label">
              {{ t('features.speedrun.chapter') }} {{ speedrunStore.currentChapterIndex + 1 }} {{ t('features.speedrun.of') }} {{ speedrunStore.totalChapters }}
            </NText>
            <NProgress 
              type="line" 
              :percentage="progressPercentage" 
              :show-indicator="false"
              status="success"
              class="progress-bar"
            />
            <h3 class="chapter-name">{{ speedrunStore.currentChapter.name }}</h3>
            <NText depth="2" class="target-result">{{ t('features.speedrun.target') }}: {{ speedrunStore.currentChapter.tags.Result || '1-0' }}</NText>
          </div>

          <div class="timer-display">
            {{ formattedTime }}
          </div>
        </div>

        <div class="quit-section" v-if="!speedrunStore.isFinished">
          <NButton block type="warning" @click="handleRestart" style="margin-bottom: 12px;">
            <template #icon>
              <NIcon><RestartIcon /></NIcon>
            </template>
            {{ t('features.speedrun.restartChapter') }}
          </NButton>

          <NButton block type="error" dashed @click="handleQuit">
            <template #icon>
              <NIcon><CloseCircleOutline /></NIcon>
            </template>
            {{ t('features.speedrun.quitRun') }}
          </NButton>
        </div>
      </div>
    </template>

    <template #top-info>
      <div class="top-info-banner" v-if="speedrunStore.currentChapter && !speedrunStore.isFinished">
        <div class="target-badge" :class="targetClass">
           {{ targetText.toUpperCase() }}
        </div>

        <span class="top-timer">{{ formattedTime }}</span>
      </div>
    </template>

    <template #center-column>
      <!-- Game board is handled by GameLayout -->
    </template>

    <template #right-panel>
      <div class="right-panel-speedrun">
        <div class="chapter-list-header">
          <NText strong>{{ t('features.speedrun.listTitle') }}</NText>
        </div>
        
        <NScrollbar class="speedrun-list-scroll">
          <NList hoverable clickable>
            <NListItem
              v-for="(chapter, index) in speedrunStore.chaptersToPlay"
              :key="chapter.id"
              :class="{ 
                active: speedrunStore.currentChapterIndex === index,
                'is-clickable': speedrunStore.chapterTimes[index] === undefined
              }"
              @click="handleJump(index)"
            >
              <NThing>
                <template #avatar>
                  <div class="chapter-index" :class="{ completed: speedrunStore.chapterTimes[index] !== undefined }">
                    {{ index + 1 }}
                  </div>
                </template>
                <template #header>
                  <span class="chapter-name-list" :class="{ active: speedrunStore.currentChapterIndex === index }">
                    {{ chapter.name }}
                  </span>
                </template>
                <template #header-extra>
                  <span class="chapter-time" :class="{ completed: speedrunStore.chapterTimes[index] !== undefined }">
                    {{ speedrunStore.formatMs(speedrunStore.chapterTimes[index]) }}
                  </span>
                </template>
              </NThing>
            </NListItem>
          </NList>
        </NScrollbar>

        <div class="analysis-toggle-section">
          <AnalysisPanel v-if="analysisStore.isPanelVisible" />
        </div>
      </div>
    </template>
  </GameLayout>

  <SpeedrunSetupModal 
    v-model:show="showSetupModal"
    @confirm="handleConfirmStart"
    @cancel="handleCancelStart"
  />
</template>

<style scoped>
.speedrun-sidebar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 24px;
}

.speedrun-title {
  color: var(--neon-bordeaux, #D9004C);
  font-weight: 900;
  letter-spacing: 2px;
  text-align: center;
  margin: 0;
  text-shadow: 0 0 10px rgba(217, 0, 76, 0.3);
}

.speedrun-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chapter-info {
  background: rgba(255, 255, 255, 0.03);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.chapter-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.progress-bar {
  margin: 8px 0;
}

.chapter-name {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-result {
  font-size: 0.85rem;
  display: block;
  margin-top: 4px;
  font-weight: 600;
}

.timer-display {
  font-family: monospace;
  font-size: 3rem;
  font-weight: 800;
  text-align: center;
  color: var(--neon-yellow, #f7d547);
  background: #111;
  padding: 12px;
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(0,0,0,0.8);
  border: 1px solid rgba(247, 213, 71, 0.3);
}

.quit-section {
  margin-top: auto;
}

.top-info-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: rgba(0, 0, 0, 0.4);
  padding: 8px 24px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
}

.chapter-badge {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--text-secondary);
  white-space: nowrap;
}

.chapter-name-banner {
  flex: 1;
  margin: 0 16px;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-badge {
  padding: 3px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-align: center;
  min-width: 80px;
  white-space: nowrap;
}

.target-win {
  background: rgba(0, 229, 255, 0.15);
  color: var(--neon-cyan);
  border: 1px solid var(--neon-cyan);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

.target-draw {
  background: rgba(255, 230, 0, 0.15);
  color: var(--neon-yellow);
  border: 1px solid var(--neon-yellow);
  box-shadow: 0 0 10px rgba(255, 230, 0, 0.3);
}

.top-timer {
  font-family: 'Fira Code', monospace;
  font-weight: 800;
  color: var(--neon-yellow);
  font-size: 1.1rem;
  min-width: 80px;
}

.speedrun-finished {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.final-timer {
  font-family: monospace;
  font-size: 2.5rem;
  color: var(--neon-yellow);
  margin: 16px 0;
}

/* Right Panel Styles */
.right-panel-speedrun {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chapter-list-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 1px;
}

.speedrun-list-scroll {
  flex: 1;
}

.chapter-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.8rem;
}

.chapter-index.completed {
  background: var(--color-success);
  color: white;
}

.chapter-name-list {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-name-list.active {
  color: var(--color-accent-primary);
  font-weight: bold;
  text-decoration: underline;
}

.chapter-time {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.chapter-time.completed {
  color: var(--neon-yellow);
  font-weight: bold;
}

.active {
  background-color: rgba(var(--color-primary-rgb), 0.1) !important;
}

.is-clickable {
  cursor: pointer;
}

.is-clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.analysis-toggle-section {
  border-top: 1px solid var(--color-border);
  padding: 8px;
}
</style>
