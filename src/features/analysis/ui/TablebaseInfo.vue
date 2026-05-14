<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { NButton, NText } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTablebaseStore } from '../model/tablebase.store'

const tablebaseStore = useTablebaseStore()
const boardStore = useBoardStore()
const { result, isLoading, isTablebaseAvailable, lastFetchedFen } = storeToRefs(tablebaseStore)
const { t } = useI18n()

const winner = computed(() => {
  if (!result.value || boardStore.fen !== tablebaseStore.lastFetchedFen) return null
  if (result.value.winner) return result.value.winner

  const category = result.value.category
  const turn = boardStore.turn // 'white' | 'black'

  // Normal wins/losses
  if (category === 'win' || category === 'maybe_win') {
    return turn === 'white' ? 'w' : 'b'
  }
  if (category === 'loss' || category === 'maybe_loss') {
    return turn === 'white' ? 'b' : 'w'
  }

  // Cursed wins and blessed losses are draws under the 50-move rule
  if (category === 'draw' || category === 'cursed_win' || category === 'blessed_loss') {
    return 'd'
  }

  return null
})

const outcomeText = computed(() => {
  if (!result.value || !winner.value) return ''

  const dtm = result.value.dtm

  // 1. Check for Mate path (DTM)
  if (dtm !== undefined && dtm !== null) {
    const moves = Math.ceil(Math.abs(dtm) / 2)
    if (winner.value === 'w') return t('features.analysis.tablebase.whiteMatesIn', { moves })
    if (winner.value === 'b') return t('features.analysis.tablebase.blackMatesIn', { moves })
  }

  // 2. Fallback to Winner (if win/loss known but no DTM)
  if (winner.value === 'w') return t('features.analysis.tablebase.whiteWins')
  if (winner.value === 'b') return t('features.analysis.tablebase.blackWins')

  // 3. Draw or unknown
  if (winner.value === 'd') return t('features.analysis.tablebase.draw')

  return ''
})

const bestMove = computed(() => {
  if (!result.value?.moves || result.value.moves.length === 0) return null
  return result.value.moves[0]
})

const outcomeType = computed(() => {
  if (!winner.value) return 'info'
  if (winner.value === 'w') return 'success' // Green
  if (winner.value === 'b') return 'error' // Red
  if (winner.value === 'd') return 'warning' // Gold/Yellow
  return 'info'
})

const handleMoveClick = (uci: string) => {
  if (uci) {
    boardStore.applyUciMove(uci)
  }
}
</script>

<template>
  <transition name="fade-slide">
    <div
      v-if="isTablebaseAvailable && result && boardStore.fen === lastFetchedFen"
      class="tablebase-container"
    >
      <div class="tablebase-card">
        <div class="tb-header">
          <div class="outcome-badge" :class="outcomeType">
            <span class="dot"></span>
            <span class="text">{{ outcomeText }}</span>
          </div>

          <div v-if="isLoading" class="loading-mini">
            <div class="pulse"></div>
          </div>
        </div>

        <div v-if="bestMove" class="tb-best-move">
          <n-text depth="3" class="label">{{ t('features.analysis.tablebase.bestMove') }}:</n-text>
          <n-button quaternary size="tiny" class="move-btn" @click="handleMoveClick(bestMove.uci)">
            {{ bestMove.san }}
          </n-button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="scss">
.tablebase-container {
  width: 100%;
  margin-top: 8px;
  margin-bottom: 4px;
}

.tablebase-card {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 8px 12px;
  backdrop-filter: var(--glass-blur);
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-left: 3px solid var(--neon-cyan);
}

.tb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.outcome-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.9rem;

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentColor;
  }

  &.success {
    color: #4caf50; // White wins -> Green
    .dot {
      background-color: #4caf50;
    }
  }
  &.error {
    color: #f44336; // Black wins -> Red
    .dot {
      background-color: #f44336;
    }
  }
  &.warning {
    color: #ffc107; // Draw -> Gold
    .dot {
      background-color: #ffc107;
    }
  }

  .dtm {
    font-size: 0.8rem;
    opacity: 0.8;
    font-weight: 400;
    font-family: monospace;
  }
}

.tb-best-move {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 4px 10px;

  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.move-btn {
  font-family: monospace;
  font-weight: 600;
  --n-text-color: rgba(255, 255, 255, 0.8);

  &:hover {
    --n-text-color: var(--neon-cyan) !important;
    background: rgba(0, 163, 255, 0.1) !important;
  }
}

.loading-mini {
  .pulse {
    width: 6px;
    height: 6px;
    background: var(--neon-cyan);
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
