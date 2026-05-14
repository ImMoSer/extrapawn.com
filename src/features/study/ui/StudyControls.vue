<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import {
  AnalyticsOutline as AnalysisIcon,
  RefreshOutline as FlipIcon,
  ChevronForwardOutline as NextIcon,
  ChevronBackOutline as PrevIcon,
} from '@vicons/ionicons5'
import { NButton, NIcon, NSpace, NSwitch, NTooltip, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  isAnalysisActive: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-analysis'): void
}>()

const boardStore = useBoardStore()
const message = useMessage()
const { t } = useI18n()

const handleFlip = () => boardStore.flipBoard()
const handlePrev = () => boardStore.navigatePgn('backward')
const handleNext = () => boardStore.navigatePgn('forward')

const handleCopyFen = () => {
  const fen = pgnService.getCurrentNavigatedFen()
  navigator.clipboard.writeText(fen)
  message.success(t('common.notifications.fenCopied', 'FEN copied!'))
}

const handleCopyPgn = () => {
  const pgn = pgnService.getFullPgn({})
  navigator.clipboard.writeText(pgn)
  message.success(t('common.notifications.pgnCopied', 'PGN copied!'))
}
</script>

<template>
  <div class="study-controls-container">
    <n-space justify="center" align="center" :size="[8, 0]">
      <!-- 1. Previous Move (<) -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button circle quaternary size="large" @click="handlePrev">
            <template #icon
              ><n-icon><PrevIcon /></n-icon
            ></template>
          </n-button>
        </template>
        {{ t('common.navigation.prev', 'Previous') }}
      </n-tooltip>

      <!-- 2. Flip Board -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button circle quaternary size="large" @click="handleFlip">
            <template #icon
              ><n-icon><FlipIcon /></n-icon
            ></template>
          </n-button>
        </template>
        {{ t('features.board.flip', 'Flip Board') }}
      </n-tooltip>

      <!-- 3. FEN (Text) -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button quaternary size="medium" @click="handleCopyFen" class="text-btn">
            FEN
          </n-button>
        </template>
        {{ t('features.board.copyFen', 'Copy FEN') }}
      </n-tooltip>

      <!-- 4. Engine Switch -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <div class="switch-wrapper">
            <n-switch
              :value="isAnalysisActive"
              size="medium"
              @update:value="emit('toggle-analysis')"
            >
              <template #checked-icon>
                <n-icon class="icon-analysis-active"><AnalysisIcon /></n-icon>
              </template>
              <template #unchecked-icon>
                <n-icon><AnalysisIcon /></n-icon>
              </template>
            </n-switch>
          </div>
        </template>
        {{ t('features.analysis.engine', 'Engine Analysis') }}
      </n-tooltip>

      <!-- 5. PGN (Text) -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button quaternary size="medium" @click="handleCopyPgn" class="text-btn">
            PGN
          </n-button>
        </template>
        {{ t('features.board.copyPgn', 'Copy PGN') }}
      </n-tooltip>

      <!-- 7. Next Move (>) -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button circle quaternary size="large" @click="handleNext">
            <template #icon
              ><n-icon><NextIcon /></n-icon
            ></template>
          </n-button>
        </template>
        {{ t('common.navigation.next', 'Next') }}
      </n-tooltip>
    </n-space>
  </div>
</template>

<style scoped>
.study-controls-container {
  padding: 2px 12px;
  background: var(--glass-bg, rgba(24, 24, 28, 0.7));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  backdrop-filter: var(--glass-blur, blur(12px));
  width: fit-content;
  margin: 0 auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  min-height: 44px;
  max-width: 95vw;
}

.text-btn {
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.5px;
  min-width: 50px;
}

.switch-wrapper {
  padding: 0 4px;
  display: flex;
  align-items: center;
}

.icon-analysis-active {
  color: var(--neon-cyan, #00f2ff);
  filter: drop-shadow(0 0 4px var(--neon-cyan, #00f2ff));
}

:deep(.n-switch.n-switch--active) {
  --n-button-box-shadow: 0 0 8px var(--neon-cyan, #00f2ff);
}

@media (orientation: portrait) {
  .study-controls-container {
    padding: 0 4px;
    width: 100%;
    border-radius: 8px;
    min-height: 44px;
    justify-content: space-around;
  }
}
</style>
