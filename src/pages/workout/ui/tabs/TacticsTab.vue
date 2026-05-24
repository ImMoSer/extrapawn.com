<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NText } from 'naive-ui'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'

const props = defineProps<{
  difficulty: string
}>()

const emit = defineEmits<{
  (e: 'loadRequested', payload: { type: string; category: string; difficulty: string; source: string }): void
}>()

const { t } = useI18n()

const selectedTacticsTheme = ref<string>('fork')

const TACTICS_THEMES = [
  'fork',
  'kingAttack',
  'sacrifice',
  'pin',
  'discoveredAttack',
  'advancedPawn',
  'attraction',
  'deflection',
  'defensiveMove',
  'quietMove',
  'hangingPiece',
  'skewer',
  'trappedPiece',
  'intermezzo',
  'clearance',
  'capturingDefender',
  'zugzwang',
  'backRankMate',
  'interference',
  'xRayAttack',
]

const TACTICS_ICON_UI: Record<string, string> = {
  fork: '⚔️',
  kingAttack: '👑',
  sacrifice: '💥',
  pin: '📌',
  discoveredAttack: '👀',
  advancedPawn: '🏃',
  attraction: '🧲',
  deflection: '🛡️',
  defensiveMove: '🧱',
  quietMove: '🤫',
  hangingPiece: '💎',
  skewer: '⚡',
  trappedPiece: '🕸️',
  intermezzo: '⏱️',
  clearance: '🧹',
  capturingDefender: '⚔️',
  zugzwang: '⏳',
  backRankMate: '🪜',
  interference: '🚧',
  xRayAttack: '🩻',
}

const formatThemeName = (theme: string): string => {
  const key = `chess.tactics.${theme}`
  const translation = t(key)
  if (translation && !translation.startsWith('chess.')) {
    return translation
  }
  return theme.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
}

const tacticsOptions = computed(() => {
  return TACTICS_THEMES.map((theme) => ({
    label: formatThemeName(theme),
    value: theme,
    icon: TACTICS_ICON_UI[theme] || '🧩',
  }))
})

function loadTactics() {
  const source = t('features.learningCoach.tabs.tactic')
  emit('loadRequested', {
    type: 'tactics',
    category: selectedTacticsTheme.value,
    difficulty: props.difficulty,
    source,
  })
}
</script>

<template>
  <div class="tab-panel">
    <div class="form-group theme-group">
      <n-text class="input-label">{{ t('features.learningCoach.tacticsLabel') }}</n-text>
      <VisualRadioGroup
        v-model:value="selectedTacticsTheme"
        :options="tacticsOptions"
        :columns="3"
        @update:value="loadTactics"
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
</style>
