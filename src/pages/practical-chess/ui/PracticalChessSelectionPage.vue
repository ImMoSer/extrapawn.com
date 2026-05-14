<script setup lang="ts">
import BaseSelectionLayout from '@/shared/ui/BaseSelectionLayout.vue'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { usePracticalChessStore } from '@/features/practical-chess'
import { NRadioGroup, NRadioButton, NText } from 'naive-ui'
import {
  PRACTICAL_CHESS_CATEGORIES,
  type PracticalChessCategory,
  type PracticalChessDifficulty,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'

import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'

const { t } = useI18n()
const router = useRouter()
const practicalStore = usePracticalChessStore()

const difficultyLevels = ['Novice', 'Pro', 'Master'] as const
const selectedDifficulty = ref<string>(practicalStore.activeDifficulty)
const selectedCategory = ref<string>(practicalStore.activeCategory)

const themeOptions = computed(() => {
  return PRACTICAL_CHESS_CATEGORIES.map((cat) => {
    return {
      label: t(`chess.themes.${cat}`),
      value: cat,
      ...CHESS_CATEGORY_UI[cat],
    }
  })
})

function handleStart() {
  practicalStore.selectDifficulty(selectedDifficulty.value as PracticalChessDifficulty)
  practicalStore.selectCategory(selectedCategory.value as PracticalChessCategory)
  router.push({ name: 'practical-chess-play' })
}
</script>

<template>
  <BaseSelectionLayout
    :title="t('features.practicalChess.selection.title')"
    :subtitle="t('features.practicalChess.selection.subtitle')"
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

      <!-- Categories / Themes Selection -->
      <div class="section">
        <n-text class="section-label">{{
          t('features.practicalChess.selection.categoryLabel')
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
