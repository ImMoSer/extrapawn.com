<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  summary: {
    total: number
    win_p: number
    draw_p: number
    loss_p: number
  }
  turn: 'white' | 'black'
}

const props = defineProps<Props>()

const whiteWinsPct = computed(() => {
  return props.turn === 'white' ? props.summary.win_p : props.summary.loss_p
})

const drawsPct = computed(() => {
  return props.summary.draw_p
})

const blackWinsPct = computed(() => {
  return props.turn === 'black' ? props.summary.win_p : props.summary.loss_p
})
</script>

<template>
  <div class="book-footer">
    <div class="footer-bars">
      <div class="bar-row" title="1-0 (White Wins)">
        <div class="bar white" :style="{ width: whiteWinsPct + '%' }"></div>
      </div>
      <div class="bar-row" title="Draws">
        <div class="bar draw" :style="{ width: drawsPct + '%' }"></div>
      </div>
      <div class="bar-row" title="0-1 (Black Wins)">
        <div class="bar black" :style="{ width: blackWinsPct + '%' }"></div>
      </div>
    </div>
    <div class="footer-legend">
      <div class="legend-item">1-0: {{ whiteWinsPct.toFixed(0) }}%</div>
      <div class="legend-item">1/2: {{ drawsPct.toFixed(0) }}%</div>
      <div class="legend-item">0-1: {{ blackWinsPct.toFixed(0) }}%</div>
      <div class="legend-item" style="margin-left: 10px; opacity: 0.5">(N={{ summary.total }})</div>
    </div>
  </div>
</template>

<style scoped>
.book-footer {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid var(--color-border);
  display: flex;
  gap: 15px;
  align-items: center;
}

.footer-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bar-row {
  height: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.bar {
  height: 100%;
}

.bar.white {
  background: #4caf50;
}

.bar.draw {
  background: #7e57c2;
}

.bar.black {
  background: #f44336;
}

.footer-legend {
  font-size: 11px;
  font-family: 'Fira Code', monospace;
  white-space: nowrap;
  color: var(--color-text-secondary);
}
</style>
