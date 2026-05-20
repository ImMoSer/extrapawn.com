<script setup lang="ts">
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { useTheoryEndingsStore } from '@/features/theory-endings'
import { NRadioGroup, NRadioButton, NText, NSpace } from 'naive-ui'
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

defineExpose({ handleStart })
</script>

<template>
  <div class="selection-sections">
    <n-space justify="space-between" :size="24" class="top-row">
      <!-- Difficulty Selection (Left) -->
      <div class="section flex-grow">
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

      <!-- Type Selection (Right) -->
      <div class="section type-section">
        <n-text class="section-label">{{
          t('features.theoryEndgames.selection.typeLabel')
        }}</n-text>
        <n-radio-group v-model:value="selectedType" size="large">
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
    </n-space>

    <!-- Categories / Themes Selection -->
    <div class="section">
      <n-text class="section-label">{{
        t('features.theoryEndgames.selection.categoryLabel')
      }}</n-text>
      <VisualRadioGroup v-model:value="selectedCategory" :options="themeOptions" />
    </div>
  </div>
</template>

<style scoped>
.selection-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.flex-grow {
  flex: 1;
}

.type-section {
  text-align: right;
  align-items: flex-end;
}

.section-label {
  font-weight: 600;
  color: var(--text-secondary, #999);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

@media (max-width: 600px) {
  .top-row {
    flex-direction: column;
    gap: 16px !important;
  }
  .type-section {
    text-align: left;
    align-items: flex-start;
  }
}
</style>
