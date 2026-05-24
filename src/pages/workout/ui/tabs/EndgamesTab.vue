<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NRadioGroup, NRadioButton, NText } from 'naive-ui'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
} from '@/shared/types/api.types'

const props = defineProps<{
  difficulty: string
}>()

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t } = useI18n()

const selectedEndgameMode = ref<'GOTO' | 'THEORETICAL' | 'PRACTICAL'>('GOTO')
const selectedEndgameTheme = ref<string>('pawn')

const formatThemeName = (theme: string): string => {
  const key = `chess.themes.${theme}`
  const translation = t(key)
  if (translation && !translation.startsWith('chess.')) {
    return translation
  }
  return theme.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
}

const endgameThemeOptions = computed(() => {
  let list: readonly string[] = []

  if (selectedEndgameMode.value === 'THEORETICAL') {
    list = THEORY_ENDING_CATEGORIES
  } else if (selectedEndgameMode.value === 'PRACTICAL') {
    list = PRACTICAL_CHESS_CATEGORIES
  } else {
    list = FINISH_HIM_CATEGORIES
  }

  return list.map((theme) => ({
    label: formatThemeName(theme),
    value: theme,
    ...CHESS_CATEGORY_UI[theme],
  }))
})

watch(selectedEndgameMode, (newMode) => {
  if (newMode === 'THEORETICAL') {
    selectedEndgameTheme.value = THEORY_ENDING_CATEGORIES[0] || 'pawn'
  } else if (newMode === 'PRACTICAL') {
    selectedEndgameTheme.value = PRACTICAL_CHESS_CATEGORIES[0] || 'extraPawn'
  } else {
    selectedEndgameTheme.value = FINISH_HIM_CATEGORIES[0] || 'pawn'
  }
})

function loadEndgame() {
  const mode = selectedEndgameMode.value
  let type = ''
  let source = ''

  if (mode === 'THEORETICAL') {
    type = 'theory_endings'
    source = t('features.learningCoach.modes.theory')
  } else if (mode === 'PRACTICAL') {
    type = 'practical_chess'
    source = t('features.learningCoach.modes.practical')
  } else {
    type = 'finish_him'
    source = t('features.learningCoach.modes.goto')
  }

  emit('loadRequested', {
    type,
    category: selectedEndgameTheme.value,
    difficulty: props.difficulty,
    source,
  })
}
</script>

<template>
  <div class="tab-panel">
    <div class="form-group">
      <n-text class="input-label">{{ t('features.learningCoach.modeLabel') }}</n-text>
      <n-radio-group v-model:value="selectedEndgameMode" size="medium" expand class="radio-grp">
        <n-radio-button value="GOTO">
          {{ t('features.learningCoach.modes.goto') }}
        </n-radio-button>
        <n-radio-button value="THEORETICAL">
          {{ t('features.learningCoach.modes.theory') }}
        </n-radio-button>
        <n-radio-button value="PRACTICAL">
          {{ t('features.learningCoach.modes.practical') }}
        </n-radio-button>
      </n-radio-group>
    </div>

    <div class="form-group theme-group">
      <n-text class="input-label">{{ t('features.learningCoach.categoryLabel') }}</n-text>
      <VisualRadioGroup
        v-model:value="selectedEndgameTheme"
        :options="endgameThemeOptions"
        :columns="2"
        @update:value="loadEndgame"
      />
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.theme-group {
  margin-top: 4px;
}
.input-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}
.radio-grp {
  width: 100%;
}
:deep(.n-radio-group .n-radio-button) {
  flex: 1;
  text-align: center;
}
</style>
