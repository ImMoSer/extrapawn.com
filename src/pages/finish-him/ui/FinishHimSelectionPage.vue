<script setup lang="ts">
import BaseSelectionLayout from '@/shared/ui/BaseSelectionLayout.vue'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { useFinishHimStore } from '@/features/finish-him'
import { NRadioGroup, NRadioButton, NText } from 'naive-ui'
import { type FinishHimDifficulty, type FinishHimTheme } from '@/shared/types/api.types'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, onMounted, computed } from 'vue'

import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'

const { t } = useI18n()
const router = useRouter()
const finishHimStore = useFinishHimStore()

const difficultyLevels = ['Novice', 'Pro', 'Master'] as const
const selectedDifficulty = ref<string>('Novice')
const selectedCategory = ref<string>('auto')

const categories = [
  'auto',
  'pawn',
  'knight',
  'bishop',
  'rookPawn',
  'queen',
  'knightBishop',
  'rookPieces',
  'queenPieces',
  'expert',
]

onMounted(() => {
  finishHimStore.reset()
})

const themeOptions = computed(() => {
  return categories.map((cat) => {
    const labelKey = cat === 'auto' ? 'chess.tactics.auto' : `chess.themes.${cat}`

    return {
      label: t(labelKey),
      value: cat,
      ...CHESS_CATEGORY_UI[cat],
    }
  })
})

function handleStart() {
  finishHimStore.setParams(
    selectedCategory.value as FinishHimTheme | 'auto',
    selectedDifficulty.value as FinishHimDifficulty,
  )
  router.push({ name: 'finish-him-play' })
}
</script>

<template>
  <BaseSelectionLayout
    :title="t('features.finishHim.selection.title')"
    :subtitle="t('features.finishHim.selection.subtitle')"
    accent-type="primary"
    @start="handleStart"
  >
    <template #sections>
      <!-- Difficulty Selection -->
      <div class="section">
        <n-text class="section-label">{{
          t('features.theoryEndgames.selection.difficultyLabel')
        }}</n-text>
        <n-radio-group v-model:value="selectedDifficulty" size="large" expand>
          <n-radio-button
            v-for="diff in difficultyLevels"
            :key="diff"
            :value="diff"
            style="text-align: center"
          >
            {{ t(`common.difficulties.level_${diff.toLowerCase()}`) }}
          </n-radio-button>
        </n-radio-group>
      </div>

      <!-- Theme Selection -->
      <div class="section">
        <n-text class="section-label">{{ t('features.finishHim.selection.themeLabel') }}</n-text>
        <VisualRadioGroup v-model:value="selectedCategory" :options="themeOptions" />
      </div>
    </template>

    <template #start-button-label>
      {{ t('features.theoryEndgames.selection.start') }}
    </template>
  </BaseSelectionLayout>
</template>

<style scoped>
.engine-selector-wrapper {
  width: 100%;
}
</style>
