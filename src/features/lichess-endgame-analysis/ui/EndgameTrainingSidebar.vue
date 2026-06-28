<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLichessEndgameAnalysisStore } from '../model/lichess-endgame-analysis.store'
import { NButton, NIcon, NText, NScrollbar } from 'naive-ui'
import { ChevronForwardOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

const { t } = useI18n()

const store = useLichessEndgameAnalysisStore()

const handleGoBack = () => {
  store.quitTraining()
}

// Ermittelt alle Kategorien, für die es Puzzles gibt
const categories = computed(() => {
  if (!store.analysisResult?.puzzles) return []
  const cats = new Set(store.analysisResult.puzzles.map(p => p.category))
  return Array.from(cats).sort()
})

const getPuzzlesLeft = (category: string) => {
  if (!store.analysisResult?.puzzles) return 0
  const categoryPuzzles = store.analysisResult.puzzles.filter(p => p.category === category)
  const solvedCount = categoryPuzzles.filter(p => store.solvedPuzzles.has(p.puzzle_id)).length
  return categoryPuzzles.length - solvedCount
}

const isCategoryCompleted = (category: string) => {
  return getPuzzlesLeft(category) === 0
}

const getCategoryPuzzleCount = (category: string) => {
  if (!store.analysisResult?.puzzles) return 0
  return store.analysisResult.puzzles.filter(p => p.category === category).length
}

const selectCategory = (category: string) => {
  if (store.isWaitingForBotBlunder) return
  store.startTraining(category)
}

const formatEndgameName = (name: string): string => {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Vs', 'vs.')
}
</script>

<template>
  <div class="endgame-training-sidebar">
    <h2 class="sidebar-title">{{ t('features.lichessEndgameAnalysis.classifications') }}</h2>

    <div class="sidebar-back">
      <NButton block secondary type="primary" @click="handleGoBack">
        {{ t('features.lichessEndgameAnalysis.exit') }}
      </NButton>
    </div>

    <div class="tasks-container">
      <NScrollbar>
        <div class="task-tabs">
          <div 
            v-for="cat in categories" 
            :key="cat"
            class="task-tab"
            :class="{ 
              active: store.activeCategory === cat,
              completed: isCategoryCompleted(cat),
              disabled: store.isWaitingForBotBlunder
            }"
            @click="selectCategory(cat)"
          >
            <div class="task-tab-content">
              <div class="task-row">
                <NText strong class="task-name">{{ formatEndgameName(cat).toUpperCase() }}</NText>
                <NText depth="3" class="task-status">
                  {{ t('features.lichessEndgameAnalysis.puzzlesLeft', { left: getPuzzlesLeft(cat), total: getCategoryPuzzleCount(cat) }) }}
                </NText>
              </div>
            </div>
            <NIcon v-if="store.activeCategory === cat"><ChevronForwardOutline /></NIcon>
          </div>
        </div>
      </NScrollbar>
    </div>
  </div>
</template>

<style scoped>
.endgame-training-sidebar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 20px;
  background: var(--color-bg-secondary);
}

.sidebar-title {
  color: var(--neon-bordeaux, #d9004c);
  font-weight: 900;
  letter-spacing: 2px;
  text-align: center;
  margin: 0;
  text-shadow: 0 0 10px rgba(217, 0, 76, 0.3);
}

.sidebar-back {
  flex-shrink: 0;
}

.tasks-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.task-tabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-tab {
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.task-tab:hover {
  background: rgba(255, 255, 255, 0.08);
}

.task-tab.active {
  border-color: var(--neon-bordeaux);
  background: rgba(217, 0, 76, 0.1);
}

.task-tab.completed {
  border-color: var(--color-success);
  opacity: 0.7;
}

.task-tab.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.task-tab.disabled:hover {
  background: rgba(255, 255, 255, 0.03);
}

.task-tab-content {
  flex: 1;
  min-width: 0;
}

.task-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-name {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-status {
  font-size: 0.75rem;
  opacity: 0.6;
}
</style>
