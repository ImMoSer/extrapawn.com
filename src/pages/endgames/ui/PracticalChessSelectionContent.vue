<script setup lang="ts">
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { useEndgameStore } from '@/features/endgames'
import { NRadioGroup, NRadioButton, NText } from 'naive-ui'
import {
  PRACTICAL_CHESS_CATEGORIES,
  type PracticalChessCategory,
  type PracticalChessDifficulty,
} from '@/shared/types/api.types'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'

const { t } = useI18n()
const router = useRouter()
const endgameStore = useEndgameStore()

const difficultyLevels = ['Novice', 'Pro', 'Master'] as const
const selectedDifficulty = ref<string>(endgameStore.activeParams.difficulty || 'Novice')
const selectedCategory = ref<string>(endgameStore.activeParams.category || 'extraPawn')

onMounted(() => {
  endgameStore.reset()
})

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
  endgameStore.setParams({
    difficulty: selectedDifficulty.value as PracticalChessDifficulty,
    category: selectedCategory.value as PracticalChessCategory,
  })
  router.push({ name: 'practical-chess-play' })
}

defineExpose({ handleStart })
</script>

<template>
  <div class="selection-sections">
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

.section-label {
  font-weight: 600;
  color: var(--text-secondary, #999);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}
</style>
