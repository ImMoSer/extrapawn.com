<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLichessEndgameAnalysisStore } from '../model/lichess-endgame-analysis.store'
import { NTag, NSpace } from 'naive-ui'
import { computed } from 'vue'

const { t } = useI18n()
const store = useLichessEndgameAnalysisStore()

const currentPuzzleIndex = computed(() => {
  if (!store.activePuzzle) return 0
  return store.puzzlesQueue.findIndex(p => p.puzzle_id === store.activePuzzle?.puzzle_id) + 1
})

const totalPuzzlesCount = computed(() => {
  return store.puzzlesQueue.length
})

const formatEndgameName = (name?: string): string => {
  if (!name) return ''
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Vs', 'vs.')
}

const displayInfo = computed(() => {
  const p = store.activePuzzle
  if (!p) return { title: '', typeText: '', targetText: '', targetType: 'default' as const }

  const indexLabel = t('features.lichessEndgameAnalysis.puzzleIndexLabel', {
    index: currentPuzzleIndex.value,
    total: totalPuzzlesCount.value
  })
  const title = `${formatEndgameName(p.category)} (${indexLabel})`
  const typeText = p.puzzle_type === 'my_dropps' 
    ? t('features.lichessEndgameAnalysis.dropped') 
    : t('features.lichessEndgameAnalysis.opponentBlunder')
  const targetText = `${t('features.lichessEndgameAnalysis.target')}: ${p.user_target.toUpperCase()}`
  const targetType = p.user_target === 'win' ? ('success' as const) : ('warning' as const)

  return { title, typeText, targetText, targetType }
})
</script>

<template>
  <div class="endgame-training-top-info" v-if="store.activePuzzle">
    <div class="info-main">
      <h3 class="info-title">{{ displayInfo.title }}</h3>
      <NSpace size="small">
        <NTag :bordered="false" size="small" type="info">
          {{ displayInfo.typeText }}
        </NTag>
        <NTag :bordered="false" size="small" :type="displayInfo.targetType">
          {{ displayInfo.targetText }}
        </NTag>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.endgame-training-top-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
}

.info-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--neon-yellow, #f7d547);
  letter-spacing: 1px;
}
</style>
