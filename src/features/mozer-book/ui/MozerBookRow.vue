<script setup lang="ts">
import { type MozerBookMove } from '@/entities/opening'
import { NTooltip } from 'naive-ui'
import { computed } from 'vue'
import WinrateBar from './WinrateBar.vue'
import { getNagColor, getNagSymbol } from './utils'

interface Props {
  move: MozerBookMove
  turn: 'white' | 'black'
  fullMoveNumber: number
  summaryTotal: number
}

const props = defineProps<Props>()
const emit = defineEmits(['select'])

const formatMove = computed(() => {
  const prefix = props.turn === 'white' ? `${props.fullMoveNumber}.` : `${props.fullMoveNumber}...`
  const nag = getNagSymbol(props.move.nag)
  return `${prefix}${props.move.san}${nag}`
})

const totalN = computed(() => props.move.total.toLocaleString())
const nPercentage = computed(() => {
  if (props.summaryTotal <= 0) return '0%'
  const pct = (props.move.total / props.summaryTotal) * 100
  return pct < 0.1 ? '<0.1%' : `${pct.toFixed(1)}%`
})

const isTheoretical = computed(() => {
  return !!props.move.name || !!props.move.eco
})

function handleClick() {
  emit('select', props.move.uci)
}

function getEvalColor(rel_cp?: number) {
  if (rel_cp === undefined || rel_cp === null) return 'inherit'
  if (rel_cp > 50) return '#4caf50'
  if (rel_cp < -50) return '#f44336'
  return 'inherit'
}
</script>

<template>
  <div class="move-row" @click="handleClick">
    <div class="col-move">
      <n-tooltip
        trigger="hover"
        placement="right"
        :disabled="!isTheoretical"
        :style="{
          width: 'max-content',
          maxWidth: 'none',
          backgroundColor: '#1a1a1a',
          padding: '12px',
        }"
      >
        <template #trigger>
          <span
            class="move-text"
            :class="{ 'theoretical-move': isTheoretical }"
            :style="{ color: getNagColor(move.nag) }"
          >
            {{ formatMove }}
          </span>
        </template>
        <div class="hierarchy-tooltip">
          <div class="hierarchy-line parent">
            <span class="marker">├──</span>
            <span class="move-san">{{ move.san }}</span>
            <span class="move-eco">({{ move.eco }})</span>
            <span class="move-name">- {{ move.name }}</span>
          </div>
          <div v-for="(child, idx) in move.children" :key="child.uci" class="hierarchy-line child">
            <span class="marker">{{
              idx === (move.children?.length || 0) - 1 ? '│ └──' : '│ ├──'
            }}</span>
            <span class="move-san">{{ child.san }}</span>
            <span class="move-eco">({{ child.eco }})</span>
            <span class="move-name">- {{ child.name }}</span>
          </div>
          <div v-if="!move.children?.length" class="no-children">
            <span class="marker">│ └──</span>
            <span class="no-data-text">No theoretical continuations found</span>
          </div>
        </div>
      </n-tooltip>
    </div>

    <div class="col-n">{{ totalN }}</div>

    <div class="col-pct cell-pct">
      <WinrateBar :win_p="move.win_p" :draw_p="move.draw_p" :loss_p="move.loss_p" :turn="turn" />
    </div>

    <div class="col-n-pct">{{ nPercentage }}</div>

    <div class="col-perf">{{ move.perf }}</div>

    <div class="col-cp" :style="{ color: getEvalColor(move.rel_cp) }">
      {{ move.cp_str || 'NR' }}
    </div>

    <div class="col-wp">
      {{ move.wp_str || 'NR' }}
    </div>
  </div>
</template>

<style scoped>
.move-row {
  display: flex;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  align-items: center;
  text-align: right;
  cursor: pointer;
  transition: background 0.2s;
}

.move-row > div {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.move-row:hover {
  background: rgba(var(--color-accent-rgb), 0.1);
}

.col-move {
  width: 80px;
  justify-content: flex-start !important;
  text-align: left;
}

.col-n {
  width: 60px;
  padding-right: 8px;
}

.col-pct {
  width: 80px;
  padding: 0 4px;
}

.col-n-pct {
  width: 50px;
  padding-right: 4px;
  font-size: 11px;
  opacity: 0.8;
}

.col-perf {
  width: 50px;
  padding-right: 4px;
  font-weight: bold;
}

.col-cp {
  width: 50px;
  padding-right: 4px;
  font-weight: bold;
}

.col-wp {
  width: 45px;
  padding-right: 4px;
}

.move-text {
  font-weight: bold;
  font-size: 14px;
}

.move-text.theoretical-move {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  padding: 1px 4px;
  background: rgba(255, 255, 255, 0.03);
}

.hierarchy-tooltip {
  font-family: 'Fira Code', 'Courier New', Courier, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #eee;
}

.hierarchy-line {
  display: flex;
  white-space: nowrap;
  gap: 6px;
}

.marker {
  color: #666;
  font-weight: bold;
}

.move-san {
  color: #4caf50;
  font-weight: bold;
}

.move-eco {
  color: #888;
  font-size: 11px;
}

.move-name {
  color: #ccc;
}

.no-children {
  display: flex;
  gap: 6px;
  opacity: 0.6;
}
</style>
