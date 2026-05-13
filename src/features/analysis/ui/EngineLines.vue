<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import type { EvaluatedLineWithSan } from '@/entities/analysis'
import { useAnalysisStore } from '../index'
import { NButton, NText, NTooltip } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const analysisStore = useAnalysisStore()
const boardStore = useBoardStore()
const { t } = useI18n()

const { isAnalysisActive, analysisLines } = storeToRefs(analysisStore)

const formatScore = (line: EvaluatedLineWithSan) => {
  if (line.score.type === 'cp') {
    const val = line.score.value / 100
    return (val > 0 ? '+' : '') + val.toFixed(2)
  }
  return t('features.analysis.mateInShort', { value: Math.abs(line.score.value) })
}

const getScoreType = (index: number): 'success' | 'warning' | 'info' => {
  if (index === 0) return 'success'
  if (index === 1) return 'warning'
  return 'info'
}

const formatPv = (line: EvaluatedLineWithSan) => {
  let pvString = ''
  let currentMoveNumber = line.initialFullMoveNumber
  let turnForPv = line.initialTurn
  line.pvSan.forEach((san, sanIndex) => {
    if (turnForPv === 'white') {
      pvString += `${currentMoveNumber}. ${san} `
    } else if (sanIndex === 0) {
      pvString += `${currentMoveNumber}...${san} `
    } else {
      pvString += `${san} `
    }
    if (turnForPv === 'black') {
      currentMoveNumber++
    }
    turnForPv = turnForPv === 'white' ? 'black' : 'white'
  })
  return pvString.trim()
}

const formattedLines = computed(() => {
  return analysisLines.value.slice(0, 3).map((line, index) => ({
    ...line,
    formattedScore: formatScore(line),
    formattedPv: formatPv(line),
    scoreType: getScoreType(index),
  }))
})

const handleLineClick = (line: EvaluatedLineWithSan) => {
  const uciMove = line.pvUci[0]
  if (uciMove) {
    boardStore.applyUciMove(uciMove)
  }
}
</script>

<template>
  <div class="engine-lines-container">
    <transition name="fade-slide">
      <div v-if="isAnalysisActive" class="lines-wrapper">
        <div v-if="formattedLines.length > 0" class="lines-list">
          <div v-for="line in formattedLines" :key="line.id" class="line-item">
            <n-text class="line-depth" depth="3">{{ line.depth }}</n-text>
            <n-button
              size="tiny"
              :type="line.scoreType"
              class="score-btn"
              strong
              @click="handleLineClick(line)"
            >
              {{ line.formattedScore }}
            </n-button>
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-text class="pv-text" @click="handleLineClick(line)">{{ line.formattedPv }}</n-text>
              </template>
              {{ line.formattedPv }}
            </n-tooltip>
          </div>
        </div>

        <div v-else class="empty-state">
          <n-text depth="3" italic>{{ t('features.analysis.makeMove') }}</n-text>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.engine-lines-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.toolbar-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  backdrop-filter: var(--glass-blur);
}

.profile-select {
  width: 95px;
}

.threads-select {
  width: 60px;
}

.toolbar-icon {
  cursor: help;
}

.lines-wrapper {
  // Fixed height to prevent jumping, but allows scrolling if many lines (though we limit to 3)
  min-height: 90px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 4px;
  overflow: hidden;
  backdrop-filter: var(--glass-blur);
}

.loading-state,
.empty-state {
  height: 90px; // Match min-height of wrapper
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.lines-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.line-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);

  .line-depth {
    font-family: monospace;
    font-size: 0.75rem;
    min-width: 20px;
    text-align: right;
  }

  .score-btn {
    min-width: 54px;
    border-radius: 6px;
  }

  .pv-text {
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;

    &:hover {
      color: var(--color-accent);
    }
  }
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
