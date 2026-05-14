<script setup lang="ts">
import BaseSelectionLayout from '@/shared/ui/BaseSelectionLayout.vue'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { useTheoryEndingsStore } from '@/features/theory-endings'
import { NRadioGroup, NRadioButton, NText } from 'naive-ui'
import {
  THEORY_ENDING_CATEGORIES,
  type TheoryEndingCategory,
  type TheoryEndingDifficulty,
  type TheoryEndingType,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, onMounted, computed } from 'vue'

import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'

const { t } = useI18n()
const router = useRouter()
const theoryStore = useTheoryEndingsStore()

const difficultyLevels = ['Novice', 'Pro', 'Master'] as const
const selectedDifficulty = ref<string>('Novice')
const selectedType = ref<TheoryEndingType>('win')
const selectedCategory = ref<string>('pawn')

onMounted(() => {
  theoryStore.reset()
})

const themeOptions = computed(() => {
  return THEORY_ENDING_CATEGORIES.map((cat) => {
    return {
      label: t(`chess.themes.${cat}`),
      value: cat,
      ...CHESS_CATEGORY_UI[cat],
    }
  })
})

function handleStart() {
  theoryStore.setParams(
    selectedType.value,
    selectedDifficulty.value as TheoryEndingDifficulty,
    selectedCategory.value as TheoryEndingCategory,
  )
  router.push({
    name: 'theory-endings-play',
    params: { type: selectedType.value },
  })
}
</script>

<template>
  <BaseSelectionLayout
    :title="t('features.theoryEndgames.selection.title')"
    :subtitle="t('features.theoryEndgames.selection.subtitle')"
    accent-type="primary"
    @start="handleStart"
  >
    <template #sections>
      <!-- Type Selection -->
      <div class="section">
        <n-text class="section-label">{{
          t('features.theoryEndgames.selection.typeLabel')
        }}</n-text>
        <n-radio-group v-model:value="selectedType" size="large" expand>
          <n-radio-button
            v-for="type in ['win', 'draw'] as const"
            :key="type"
            :value="type"
            style="text-align: center"
          >
            {{ t(`chess.types.${type}`) }}
          </n-radio-button>
        </n-radio-group>
      </div>

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

      <!-- Categories / Themes Selection -->
      <div class="section">
        <n-text class="section-label">{{
          t('features.theoryEndgames.selection.categoryLabel')
        }}</n-text>
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
