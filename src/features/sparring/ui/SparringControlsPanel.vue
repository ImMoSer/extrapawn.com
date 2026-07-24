<script setup lang="ts">
import { FlagOutline, AddOutline, AnalyticsOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NSpace, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSparringStore } from '../model/sparring.store'
import { useUiStore } from '@/shared/ui/model/ui.store'

const sparringStore = useSparringStore()
const uiStore = useUiStore()
const { t } = useI18n()

async function handleResign() {
  const userConfirmed = await uiStore.showConfirmation(
    t('features.sparring.controls.confirmResignTitle'),
    t('features.sparring.controls.confirmResignMessage'),
    {
      confirmText: t('features.sparring.controls.confirmResignBtn'),
      cancelText: t('features.sparring.controls.keepPlayingBtn'),
      showCancel: true,
    }
  )

  if (userConfirmed === 'confirm') {
    sparringStore.resignGame()
  }
}
</script>

<template>
  <div class="sparring-controls-panel">
    <div class="panel-left">
      <span class="mode-badge">SPARRING</span>

      <!-- Game ID badge -->
      <n-tag v-if="sparringStore.gameId" size="small" round :bordered="false" class="game-id-tag">
        #{{ sparringStore.gameId }}
      </n-tag>

      <!-- Player Color badge -->
      <span v-if="sparringStore.gameStatus !== 'setup'" class="color-badge">
        <span class="color-dot" :class="sparringStore.userColor"></span>
        {{ sparringStore.userColor === 'white' ? $t('features.sparring.controls.white') : $t('features.sparring.controls.black') }}
      </span>

      <!-- Status badge -->
      <span v-if="sparringStore.gameStatus === 'analysis'" class="analysis-badge">
        <n-icon><AnalyticsOutline /></n-icon> {{ $t('features.sparring.controls.analysis') }}
      </span>
    </div>

    <div class="panel-right">
      <n-space :size="12" align="center">
        <!-- Resign Button (Active Game) -->
        <n-button
          v-if="sparringStore.gameStatus === 'playing'"
          type="error"
          secondary
          size="medium"
          class="resign-btn"
          @click="handleResign"
        >
          <template #icon>
            <n-icon><FlagOutline /></n-icon>
          </template>
          {{ $t('features.sparring.controls.resign') }}
        </n-button>

        <!-- New Game Button (Analysis or Setup Mode) -->
        <n-button
          v-else
          type="primary"
          secondary
          size="medium"
          class="new-game-btn"
          @click="sparringStore.openNewGameModal"
        >
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          {{ $t('features.sparring.controls.newGame') }}
        </n-button>
      </n-space>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sparring-controls-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
  background: rgba(20, 20, 25, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
}

.panel-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-badge {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(123, 44, 191, 0.15);
  color: #9d4edd;
  border: 1px solid rgba(123, 44, 191, 0.3);
  letter-spacing: 1px;
}

.game-id-tag {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
  color: var(--neon-cyan, #1890ff);
  font-size: 0.8rem;
}

.color-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #d4d4d8;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.white {
    background: #fff;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
  }

  &.black {
    background: #52525b;
    border: 1px solid #a1a1aa;
  }
}

.analysis-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(38, 166, 154, 0.15);
  color: #26a69a;
  border: 1px solid rgba(38, 166, 154, 0.3);
}

.panel-right {
  display: flex;
  align-items: center;
}

.resign-btn {
  font-weight: 700;
}

.new-game-btn {
  font-weight: 700;
}
</style>
