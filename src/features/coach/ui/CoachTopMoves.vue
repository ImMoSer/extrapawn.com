<template>
  <div class="coach-top-moves thin-scroll">
    <div v-if="topMovesLoading" class="status-msg">Analyzing…</div>
    <div v-else-if="topMoves.length === 0" class="status-msg">No moves</div>
    <div v-else class="moves-list">
      <div
        v-for="(move, idx) in topMoves"
        :key="`${move.rank}-${idx}`"
        class="top-move-row"
        :data-selected="coachStore.selectedMoveIndex === idx ? 'true' : 'false'"
        @click="coachStore.explainTopMove(move, idx)"
      >
        <div class="move-header">
          <span
            class="move-rank"
            :style="{
              backgroundColor: idx === 0 ? 'rgba(74, 222, 128, 0.18)' : '#27272a',
              color: idx === 0 ? '#4ade80' : '#71717a',
              border: idx === 0 ? '1px solid rgba(74,222,128,0.35)' : '1px solid #3f3f46',
            }"
          >
            {{ move.rank }}
          </span>
          <span
            class="move-san"
            :style="{ color: idx === 0 ? '#4ade80' : '#e4e4e7' }"
          >
            {{ move.san }}
          </span>
          <span
            class="move-eval"
            :style="{
              backgroundColor: move.eval_pawns > 0 ? 'rgba(74, 222, 128, 0.12)' : move.eval_pawns < 0 ? 'rgba(248, 113, 113, 0.12)' : 'rgba(161, 161, 170, 0.10)',
              color: move.eval_pawns > 0 ? '#86efac' : move.eval_pawns < 0 ? '#fca5a5' : '#a1a1aa',
              border: '1px solid ' + (move.eval_pawns > 0 ? 'rgba(74,222,128,0.30)' : move.eval_pawns < 0 ? 'rgba(248,113,113,0.30)' : 'rgba(161,161,170,0.20)'),
            }"
          >
            {{ move.isMate ? `M${move.mateIn}` : `${move.eval_pawns > 0 ? '+' : ''}${move.eval_pawns}` }}
          </span>
        </div>

        <div v-if="getEnriched(move)?.character || move.tagline" class="move-character-row">
          <span
            v-if="getEnriched(move)?.character && getEnriched(move)?.character !== 'Quiet'"
            class="character-pill"
            :title="getEnriched(move)?.character_reason || ''"
            :style="{
              color: characterColor(getEnriched(move)?.character),
              borderColor: characterBorder(getEnriched(move)?.character)
            }"
          >
            {{ getEnriched(move)?.character }}
          </span>
          <span v-if="move.tagline" class="move-tagline">{{ move.tagline }}</span>
        </div>

        <div v-if="getEnriched(move)?.plan_brief" class="move-plan-brief">
          Plan: {{ getEnriched(move)?.plan_brief }}.
        </div>

        <div
          v-if="coachStore.selectedMoveIndex === idx && Array.isArray(move.pvLine) && move.pvLine.length > 1"
          class="pv-line"
        >
          <div v-for="(p, i) in move.pvLine.slice(1)" :key="i" class="pv-step">
            <span class="pv-san">{{ p.san }}</span>
            <span>{{ p.tagline }}</span>
          </div>
        </div>

        <div v-if="coachStore.selectedMoveIndex === idx" class="move-explanation-box">
          <div v-if="coachStore.selectedMoveExplanationLoading" class="loading-msg">Loading…</div>
          <template v-else-if="coachStore.selectedMoveExplanation">
            <div
              class="explanation-quality"
              :style="{ color: getQualityColor(coachStore.selectedMoveExplanation.quality) }"
            >
              {{ getQualityLabel(coachStore.selectedMoveExplanation.quality) }}
            </div>
            <div class="explanation-summary">{{ coachStore.selectedMoveExplanation.summary }}</div>
            <div class="explanation-details">{{ coachStore.selectedMoveExplanation.details }}</div>
            <div
              v-if="coachStore.selectedMoveExplanation.bestMoveSan && !coachStore.selectedMoveExplanation.isBestMove"
              class="explanation-best-move"
            >
              Best was <span class="best-move-san">{{ coachStore.selectedMoveExplanation.bestMoveSan }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCoachStore } from '../model/coach.store'

const coachStore = useCoachStore()
const topMovesLoading = computed(() => coachStore.topMovesLoading)
const topMoves = computed(() => coachStore.topMoves as any[])
const currentExplanation = computed(() => coachStore.currentExplanation as any)

const getEnriched = (move: any) => {
  if (!currentExplanation.value || !currentExplanation.value.engine_top_moves) return null
  return currentExplanation.value.engine_top_moves.find((em: any) => em.uci === move.move) || null
}

const QUALITY_COLOR: Record<string, string> = {
  brilliant: '#22d3ee',
  great: '#34d399',
  best: '#4ade80',
  excellent: '#86efac',
  good: '#a7f3d0',
  neutral: '#a1a1aa',
  inaccuracy: '#fbbf24',
  mistake: '#fb923c',
  blunder: '#ef4444',
  missed_mate: '#dc2626',
}

const QUALITY_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  great: 'Great',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  neutral: 'Neutral',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  missed_mate: 'Missed mate',
}

const getQualityColor = (q: any) => QUALITY_COLOR[q as string] || '#a1a1aa'
const getQualityLabel = (q: any) => QUALITY_LABEL[q as string] || ''

const characterColor = (label: any) => {
  switch (label) {
    case 'Aggressive': return '#fca5a5';
    case 'Combative':  return '#fdba74';
    case 'Forcing':    return '#fde68a';
    case 'Risky':      return '#f9a8d4';
    case 'Drawish':    return '#a1a1aa';
    case 'Positional': return '#86efac';
    case 'Solid':      return '#7dd3fc';
    case 'Quiet':      return '#71717a';
    default:           return '#a1a1aa';
  }
}

const characterBorder = (label: string) => {
  switch (label) {
    case 'Aggressive': return 'rgba(248,113,113,0.30)';
    case 'Combative':  return 'rgba(253,186,116,0.30)';
    case 'Forcing':    return 'rgba(253,224,71,0.30)';
    case 'Risky':      return 'rgba(244,114,182,0.30)';
    case 'Drawish':    return 'rgba(161,161,170,0.25)';
    case 'Positional': return 'rgba(74,222,128,0.30)';
    case 'Solid':      return 'rgba(125,211,252,0.30)';
    case 'Quiet':      return 'rgba(82,82,91,0.30)';
    default:           return 'rgba(161,161,170,0.25)';
  }
}
</script>

<style scoped>
.coach-top-moves {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.status-msg {
  text-align: center;
  padding: 20px;
  color: #71717a;
  font-size: 12px;
}
.moves-list {
  display: flex;
  flex-direction: column;
}
.top-move-row {
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 6px;
  background-color: transparent;
  border: 1px solid transparent;
  cursor: pointer;
}
.top-move-row:hover {
  background-color: rgba(255, 255, 255, 0.03);
}
.top-move-row[data-selected="true"] {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: #27272a;
}
.move-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.move-rank {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.move-san {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.move-eval {
  font-size: 11px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 2px 7px;
  border-radius: 999px;
  letter-spacing: -0.02em;
}
.move-character-row {
  margin-top: 3px;
  margin-left: 26px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #a1a1aa;
  line-height: 1.35;
}
.character-pill {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;
}
.move-tagline {
  flex: 1;
  min-width: 0;
}
.move-plan-brief {
  margin-top: 2px;
  margin-left: 26px;
  font-size: 10px;
  color: #71717a;
  font-style: italic;
  line-height: 1.4;
}
.pv-line {
  margin-top: 6px;
  margin-left: 26px;
  padding-left: 8px;
  border-left: 2px solid #3f3f46;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pv-step {
  font-size: 10px;
  color: #71717a;
  display: flex;
  gap: 6px;
}
.pv-san {
  color: #71717a;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  min-width: 32px;
}
.move-explanation-box {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #27272a;
}
.loading-msg {
  font-size: 11px;
  color: #71717a;
}
.explanation-quality {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}
.explanation-summary {
  font-size: 12px;
  color: #d4d4d8;
  margin-bottom: 4px;
}
.explanation-details {
  font-size: 11px;
  color: #a1a1aa;
  line-height: 1.4;
}
.explanation-best-move {
  margin-top: 6px;
  font-size: 11px;
  color: #a1a1aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.best-move-san {
  color: #86efac;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 2px;
  background-color: rgba(134, 239, 172, 0.12);
}
.thin-scroll::-webkit-scrollbar {
  width: 4px;
}
.thin-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.thin-scroll::-webkit-scrollbar-thumb {
  background-color: #3f3f46;
  border-radius: 4px;
}
</style>
