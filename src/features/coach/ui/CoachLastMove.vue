<template>
  <div v-if="lastMoveAnalysis" class="coach-last-move">
    <div class="last-move-title">Last move</div>
    
    <div class="last-move-header">
      <span class="san-text">
        {{ lastMoveAnalysis.san }}
        <span
          v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.quality"
          class="quality-icon-wrapper"
          :style="{
            backgroundColor: getQualityColor(lastMoveAnalysis.quality),
            boxShadow: `0 0 0 1px ${getQualityColor(lastMoveAnalysis.quality)}55`,
          }"
        >
          <QualityIcon :quality="lastMoveAnalysis.quality" :size="16" />
        </span>
      </span>

      <span v-if="lastMoveAnalysis.loading" class="analyzing-text">Analyzing…</span>
      <span
        v-else-if="lastMoveAnalysis.quality"
        class="quality-label"
        :style="{
          color: getQualityColor(lastMoveAnalysis.quality),
          backgroundColor: `${getQualityColor(lastMoveAnalysis.quality)}1F`,
          borderColor: `${getQualityColor(lastMoveAnalysis.quality)}55`,
        }"
      >
        {{ getQualityLabel(lastMoveAnalysis.quality) }}
      </span>

      <span
        v-if="!lastMoveAnalysis.loading && typeof lastMoveAnalysis.winRateLoss === 'number' && lastMoveAnalysis.winRateLoss >= 1"
        class="win-rate-loss"
      >
        −{{ lastMoveAnalysis.winRateLoss.toFixed(1) }}%
      </span>
    </div>

    <div v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.summary" class="summary-text">
      {{ lastMoveAnalysis.summary }}
    </div>

    <div v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.details" class="details-text">
      {{ lastMoveAnalysis.details }}
    </div>

    <div v-if="!lastMoveAnalysis.loading && lastMoveConsequence" class="consequence-box">
      <span class="consequence-label">Consequence</span>
      {{ lastMoveConsequence }}
    </div>

    <div v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.bestMoveSan && !lastMoveAnalysis.isBestMove" class="better-move-box">
      Better was <span class="better-move-san">{{ lastMoveAnalysis.bestMoveSan }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCoachStore } from '../model/coach.store'
import QualityIcon from './QualityIcon.vue'
import type { CoachLastMoveAnalysis } from '@/shared/lib/engine/coach/coach.types'

const coachStore = useCoachStore()
const lastMoveAnalysis = computed<CoachLastMoveAnalysis | null>(() => coachStore.lastMoveAnalysis)
const lastMoveConsequence = computed(() => coachStore.lastMoveConsequence as string | null)

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

const getQualityColor = (q: string) => QUALITY_COLOR[q] || '#a1a1aa'
const getQualityLabel = (q: string) => QUALITY_LABEL[q] || ''
</script>

<style scoped>
.coach-last-move {
  padding: 12px 14px;
  border-bottom: 1px solid #27272a;
}
.last-move-title {
  font-size: 9px;
  color: #71717a;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
  font-weight: 600;
}
.last-move-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.san-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 16px;
  font-weight: 700;
  color: #fafafa;
  letter-spacing: -0.02em;
}
.quality-icon-wrapper {
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #09090b;
  vertical-align: middle;
}
.analyzing-text {
  font-size: 10px;
  color: #71717a;
  text-transform: uppercase;
}
.quality-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 1px solid transparent;
  padding: 3px 8px;
  border-radius: 999px;
}
.win-rate-loss {
  font-size: 10px;
  color: #fca5a5;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.20);
}
.summary-text {
  font-size: 12px;
  color: #d4d4d8;
  margin-bottom: 3px;
}
.details-text {
  font-size: 11px;
  color: #a1a1aa;
  line-height: 1.4;
}
.consequence-box {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #27272a;
  font-size: 11px;
  color: #d4d4d8;
  line-height: 1.45;
}
.consequence-label {
  color: #52525b;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin-right: 6px;
}
.better-move-box {
  margin-top: 6px;
  font-size: 11px;
  color: #a1a1aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.better-move-san {
  color: #86efac;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 2px;
  background-color: rgba(134, 239, 172, 0.12);
}
</style>
