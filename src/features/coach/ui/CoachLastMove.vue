<template>
  <div v-if="lastMoveAnalysis || currentOpeningInfo" class="coach-last-move">
    <div v-if="lastMoveAnalysis?.opening" class="opening-banner move-opening-banner">
      <span v-if="lastMoveAnalysis.opening.eco" class="opening-eco">{{ lastMoveAnalysis.opening.eco }}</span>
      <span v-if="lastMoveAnalysis.opening.name" class="opening-name">{{ lastMoveAnalysis.opening.name }}</span>
      <span v-if="lastMoveAnalysis.opening.popularity_p" class="opening-stat">
        {{ lastMoveAnalysis.opening.popularity_p }}% plays
      </span>
      <span v-if="typeof lastMoveAnalysis.opening.win_p === 'number'" class="opening-stat winrate">
        {{ lastMoveAnalysis.opening.win_p }}% W
      </span>
    </div>
    <div v-else-if="currentOpeningInfo" class="opening-banner">
      <span class="opening-eco">{{ currentOpeningInfo.eco }}</span>
      <span class="opening-name">{{ currentOpeningInfo.name }}</span>
    </div>

    <div v-if="lastMoveAnalysis" class="last-move-section">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCoachStore } from '../model/coach.store'
import QualityIcon from './QualityIcon.vue'
import type { CoachLastMoveAnalysis } from '@/shared/lib/engine/coach/coach.types'
import { QUALITY_COLOR, QUALITY_LABEL } from '@/shared/lib/engine/coach/coach.types'

const coachStore = useCoachStore()
const lastMoveAnalysis = computed<CoachLastMoveAnalysis | null>(() => coachStore.lastMoveAnalysis)
const lastMoveConsequence = computed(() => coachStore.lastMoveConsequence as string | null)
const currentOpeningInfo = computed(() => coachStore.currentOpeningInfo)

const getQualityColor = (q: string) => QUALITY_COLOR[q] || '#a1a1aa'
const getQualityLabel = (q: string) => QUALITY_LABEL[q] || ''
</script>

<style scoped>
.coach-last-move {
  padding: 12px 14px;
  border-bottom: 1px solid #27272a;
}
.opening-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 4px 8px;
  background-color: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 6px;
  flex-wrap: wrap;
}
.opening-eco {
  font-size: 10px;
  font-weight: 700;
  color: #38bdf8;
  background-color: rgba(56, 189, 248, 0.16);
  padding: 1px 4px;
  border-radius: 3px;
}
.opening-name {
  font-size: 11px;
  font-weight: 600;
  color: #e0f2fe;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opening-stat {
  font-size: 10px;
  font-weight: 600;
  color: #a1a1aa;
  margin-left: auto;
  background-color: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 4px;
}
.opening-stat.winrate {
  color: #4ade80;
  background-color: rgba(74, 222, 128, 0.12);
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

@media (max-width: 768px) {
  .coach-last-move {
    padding: 10px 12px;
  }
}
</style>
