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

const { isAnalysisActive, analysisLines, multiPv } = storeToRefs(analysisStore)

const formatScore = (line: EvaluatedLineWithSan) => {
  if (line.score.type === 'cp') {
    const val = line.score.value / 100
    return (val > 0 ? '+' : '') + val.toFixed(2)
  }
  const sign = line.score.value > 0 ? '+' : '-'
  return `${sign}${t('features.analysis.mateInShort', { value: Math.abs(line.score.value) })}`
}

const getScoreType = (
  line: EvaluatedLineWithSan,
  index: number,
): 'success' | 'warning' | 'info' | 'error' => {
  if (line.isTablebase) {
    if (line.score.type === 'mate') {
      return line.score.value > 0 ? 'success' : 'error'
    }
    return 'info'
  }
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
  return analysisLines.value.slice(0, multiPv.value).map((line, index) => ({
    ...line,
    formattedScore: formatScore(line),
    formattedPv: formatPv(line),
    scoreType: getScoreType(line, index),
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
  <div class="flex w-full flex-col gap-2">
    <div
      v-if="isAnalysisActive"
      class="min-h-[90px] overflow-hidden rounded-md border border-border bg-canvas p-1"
    >
      <div v-if="formattedLines.length > 0" class="flex flex-col gap-1">
        <div
          v-for="line in formattedLines"
          :key="line.id"
          class="flex items-center gap-2 rounded bg-surface px-1.5 py-0.5 font-condensed"
        >
          <n-text class="min-w-[20px] text-right font-condensed text-xs" depth="3">{{
            line.isTablebase ? 'TB' : line.depth
          }}</n-text>
          <n-button
            size="tiny"
            :type="line.scoreType"
            class="min-w-[54px] rounded font-condensed"
            strong
            @click="handleLineClick(line)"
          >
            {{ line.formattedScore }}
          </n-button>
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-text
                class="cursor-pointer overflow-hidden font-condensed text-sm text-ellipsis whitespace-nowrap hover:text-brand"
                @click="handleLineClick(line)"
              >
                {{ line.formattedPv }}
              </n-text>
            </template>
            {{ line.formattedPv }}
          </n-tooltip>
        </div>
      </div>

      <div v-else class="flex h-[90px] flex-col items-center justify-center gap-1">
        <n-text depth="3" italic>{{ t('features.analysis.makeMove') }}</n-text>
      </div>
    </div>
  </div>
</template>
