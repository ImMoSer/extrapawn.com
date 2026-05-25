<script setup lang="ts">
import { SchoolOutline } from '@vicons/ionicons5'
import {
  NIcon,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NText,
  NTabs,
  NTab,
} from 'naive-ui'
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { CHESS_CATEGORY_UI } from '@/shared/config/game-themes.ui'
import {
  FINISH_HIM_CATEGORIES,
  PRACTICAL_CHESS_CATEGORIES,
  THEORY_ENDING_CATEGORIES,
} from '@/shared/types/api.types'

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t } = useI18n()

const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')
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
    difficulty: selectedDifficulty.value,
    source,
  })
}
</script>

<template>
  <div class="trainings-sidebar">
    <!-- Header -->
    <div class="sidebar-header">
      <n-icon size="24" class="header-icon"><SchoolOutline /></n-icon>
      <n-text class="header-title">{{ t('features.learningCoach.tabs.endgame') }}</n-text>
    </div>

    <!-- Tabs for Modes -->
    <div class="tab-switcher-container">
        <n-tabs v-model:value="selectedEndgameMode" type="segment" animated class="mode-tabs">
            <n-tab name="GOTO">
                {{ t('features.learningCoach.modes.goto') }}
            </n-tab>
            <n-tab name="THEORETICAL">
                {{ t('features.learningCoach.modes.theory') }}
            </n-tab>
            <n-tab name="PRACTICAL">
                {{ t('features.learningCoach.modes.practical') }}
            </n-tab>
        </n-tabs>
    </div>

    <!-- Sidebar Content -->
    <div class="sidebar-scrollable-content">
      <n-scrollbar trigger="hover">
        <div class="tab-content-wrapper">
          <!-- Universal Difficulty Selector -->
          <div class="form-group difficulty-section">
            <n-text class="input-label">{{ t('features.learningCoach.difficultyLabel') }}</n-text>
            <n-radio-group v-model:value="selectedDifficulty" size="medium" expand class="radio-grp">
              <n-radio-button value="Novice">
                {{ t('common.difficulties.level_novice') }}
              </n-radio-button>
              <n-radio-button value="Pro">
                {{ t('common.difficulties.level_pro') }}
              </n-radio-button>
              <n-radio-button value="Master">
                {{ t('common.difficulties.level_master') }}
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
      </n-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.trainings-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.header-icon {
  color: var(--neon-purple);
  filter: drop-shadow(0 0 4px var(--neon-purple));
}

.header-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.75px;
  color: var(--color-text-primary);
  text-transform: uppercase;
}

.tab-switcher-container {
    padding: 0 8px;
}

.mode-tabs {
    --n-tab-font-size: 0.75rem;
}

.sidebar-scrollable-content {
  flex: 1;
  min-height: 0;
}

.tab-content-wrapper {
  padding: 4px;
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
