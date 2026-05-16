<template>
  <div v-if="explanation" class="coach-position-summary">
    <!-- Verdict -->
    <div class="verdict">
      <span v-if="verdictData.side" class="verdict-side">{{ verdictData.side }}</span>
      <span v-if="verdictData.side"> </span>
      <span>{{ verdictData.text }}</span>
      <span v-if="!verdictData.side"
        >; {{ explanation.side_to_move === 'white' ? 'White' : 'Black' }} to move.</span
      >
    </div>

    <!-- Concrete Facts -->
    <ul v-if="visibleFacts.length > 0" class="facts-list">
      <li v-for="(fact, i) in visibleFacts" :key="i" class="fact-item">
        <span class="fact-cue" :style="{ backgroundColor: getCueColor(fact.side) }"></span>
        <span class="fact-text">{{ fact.text }}</span>
      </li>
    </ul>

    <!-- Engine Plan -->
    <div v-if="hasPlan" class="engine-plan">
      <div class="section-title">
        Engine plan{{ plan?.depth ? ` · depth ${plan.depth}` : '' }}
      </div>
      <div v-if="plan?.description" class="plan-desc">{{ plan.description }}</div>
      <div v-if="plan?.zwischenzug" class="plan-zwischenzug">
        {{ plan.zwischenzug.description }}
      </div>
    </div>

    <!-- Expand Control -->
    <button
      v-if="remainingFacts > 0 || plan?.description || explanation.summary_text"
      class="expand-btn"
      @click="expanded = !expanded"
      :aria-expanded="expanded"
    >
      <span class="expand-icon" :class="{ 'is-expanded': expanded }">▾</span>
      {{
        expanded
          ? 'less'
          : remainingFacts > 0
            ? `${remainingFacts} more · plan · narrative`
            : 'plan · narrative'
      }}
    </button>

    <!-- Expanded Content -->
    <div v-if="expanded" class="expanded-content">

      <div v-if="plan && plan.moves && plan.moves.length > 0" class="expanded-section">
        <div class="section-title">
          Engine plan{{ plan.depth ? ` · depth ${plan.depth}` : '' }}
        </div>
        <div class="plan-san">
          {{ plan.moves.map((m: { san: string }) => m.san).join('  ') }}
        </div>
        <div v-if="plan.description" class="plan-desc-muted">{{ plan.description }}</div>
      </div>

      <div v-if="explanation.summary_text" class="expanded-section">
        <div class="summary-header">
          <div class="section-title" style="margin-bottom: 0">Full summary</div>
          <div class="summary-actions">
            <button
              class="copy-btn"
              @click="copyJson"
              title="Copy the full structured explanation as JSON"
            >
              Copy JSON
            </button>
          </div>
        </div>
        <div class="narrative-text thin-scroll">{{ explanation.summary_text }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCoachStore } from '../model/coach.store'
import type { CoachExplanation } from '@/shared/lib/engine/coach/coach.types'

const coachStore = useCoachStore()
const expanded = ref(false)

const explanation = computed<CoachExplanation | null>(() => coachStore.currentExplanation)

// ── Verdict formatting ──
const verdictData = computed<{ side: string | null; text: string }>(() => {
  const blob = explanation.value
  if (!blob) return { side: null, text: '' }
  const cp = blob.eval_cp ?? 0
  if (Math.abs(cp) < 25) return { side: null, text: 'Roughly equal' }
  const side = cp > 0 ? 'White' : 'Black'
  const m = Math.abs(cp)
  if (m < 75) return { side, text: 'has a slight edge' }
  if (m < 200) return { side, text: 'is better' }
  if (m < 500) return { side, text: 'has a winning advantage' }
  return { side, text: 'is clearly winning' }
})

// ── Facts extraction ──
const allFacts = computed<{ side?: string; text: string; importance?: number }[]>(() => {
  return (explanation.value?.concrete_facts) || []
})


const FACT_COUNT_DEFAULT = 3
const FACT_IMPORTANCE_MIN = 60

const decisiveFacts = computed(() =>
  allFacts.value.filter((f) => (f.importance ?? 0) >= FACT_IMPORTANCE_MIN),
)
const visibleFacts = computed(() => decisiveFacts.value.slice(0, FACT_COUNT_DEFAULT))
const remainingFacts = computed<number>(() => allFacts.value.length - visibleFacts.value.length)

const plan = computed(() => explanation.value?.principal_plan)
const hasPlan = computed<boolean>(
  () => !!(plan.value && Array.isArray(plan.value.moves) && plan.value.moves.length >= 2),
)


const getCueColor = (side: string | undefined) => {
  if (side === 'white') return '#a1a1aa'
  if (side === 'black') return '#3f3f46'
  return '#52525b'
}

const copyJson = () => {
  if (explanation.value) {
    try {
      navigator.clipboard.writeText(JSON.stringify(explanation.value, null, 2))
    } catch {
      /* ignore */
    }
  }
}
</script>

<style scoped>
.coach-position-summary {
  padding: 12px 14px;
  border-bottom: 1px solid #27272a;
}
.verdict {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.verdict-side {
  color: #fafafa;
  font-weight: 600;
}

.facts-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 1.5;
}

.fact-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding-left: 2px;
}

.fact-item.muted .fact-text {
  color: #71717a;
}

.fact-cue {
  flex-shrink: 0;
  width: 2px;
  height: 14px;
  margin-top: 3px;
  border-radius: 1px;
}

.engine-plan {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #27272a;
  font-size: 12px;
  line-height: 1.55;
}

.section-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #52525b;
  margin-bottom: 4px;
}

.plan-desc {
  color: #d4d4d8;
}

.plan-zwischenzug {
  margin-top: 4px;
  font-size: 11px;
  color: #fde68a;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: #71717a;
  font-weight: 600;
}

.expand-icon {
  display: inline-block;
  transform: rotate(-90deg);
  transition: transform 120ms ease;
  font-size: 12px;
  line-height: 1;
}

.expand-icon.is-expanded {
  transform: rotate(0deg);
}

.expanded-content {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #27272a;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12px;
  color: #a1a1aa;
  line-height: 1.55;
}

.plan-san {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #d4d4d8;
}

.plan-desc-muted {
  margin-top: 4px;
  color: #a1a1aa;
}

.summary-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 4px;
}

.summary-actions {
  display: flex;
  gap: 8px;
}

.copy-btn {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  background-color: transparent;
  color: #71717a;
  border: 1px solid #27272a;
  border-radius: 4px;
  cursor: pointer;
}

.copy-btn:hover {
  background-color: #27272a;
  color: #d4d4d8;
}

.narrative-text {
  color: #a1a1aa;
  white-space: pre-wrap;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 6px;
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
