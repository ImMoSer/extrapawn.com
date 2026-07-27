<script setup lang="ts">
import { ref, computed } from 'vue'

import type { CoachExplanation } from '@/shared/lib/engine/coach/coach.types'

const props = defineProps<{
  explanation?: CoachExplanation | null
}>()

interface FactItem {
  side: string
  importance: number
  text: string
}

function extractFacts(blob: CoachExplanation | null | undefined): FactItem[] {
  const facts: FactItem[] = []
  if (!blob) return facts
  const b = blob as unknown as Record<string, Record<string, unknown>>

  // Material
  const mat = (b.material || {}) as Record<string, unknown>

  if (mat.bishop_pair_white && !mat.bishop_pair_black) {
    facts.push({ side: 'white', importance: 60, text: 'White has the bishop pair' })
  }
  if (mat.bishop_pair_black && !mat.bishop_pair_white) {
    facts.push({ side: 'black', importance: 60, text: 'Black has the bishop pair' })
  }
  if (mat.opposite_color_bishops) {
    facts.push({ side: 'both', importance: 50, text: 'Opposite-coloured bishops on the board' })
  }
  if (Math.abs(Number(mat.material_delta_cp || 0)) >= 100) {
    const delta = Number(mat.material_delta_cp)
    const pawns = (Math.abs(delta) / 100).toFixed(1)
    const side = delta > 0 ? 'white' : 'black'
    facts.push({ side, importance: 80, text: `${side === 'white' ? 'White' : 'Black'} +${pawns} pawns material advantage` })
  }

  // Pawn Structure
  const ps = (b.pawn_structure || {}) as Record<string, unknown>
  if (ps.iqp_white) facts.push({ side: 'black', importance: 55, text: 'White has an isolated d-pawn (IQP)' })
  if (ps.iqp_black) facts.push({ side: 'white', importance: 55, text: 'Black has an isolated d-pawn (IQP)' })
  if (ps.hanging_pawns_white) facts.push({ side: 'black', importance: 50, text: 'White has hanging pawns (no flank support)' })
  if (ps.hanging_pawns_black) facts.push({ side: 'white', importance: 50, text: 'Black has hanging pawns (no flank support)' })

  const whitePs = ps.white as Record<string, unknown> | undefined
  const blackPs = ps.black as Record<string, unknown> | undefined
  for (const sq of (whitePs?.passed || []) as string[]) {
    facts.push({ side: 'white', importance: 70, text: `White has a passed pawn on ${sq}` })
  }
  for (const sq of (blackPs?.passed || []) as string[]) {
    facts.push({ side: 'black', importance: 70, text: `Black has a passed pawn on ${sq}` })
  }

  // Activity
  const act = (b.activity || {}) as Record<string, unknown>
  const whiteAct = act.white as Record<string, unknown> | undefined
  const blackAct = act.black as Record<string, unknown> | undefined
  for (const o of (whiteAct?.outposts || []) as Array<{ piece: string; square: string }>) {
    facts.push({ side: 'white', importance: 55, text: `White's ${o.piece} on ${o.square} is an outpost` })
  }
  for (const o of (blackAct?.outposts || []) as Array<{ piece: string; square: string }>) {
    facts.push({ side: 'black', importance: 55, text: `Black's ${o.piece} on ${o.square} is an outpost` })
  }

  // Tactics
  const tac = (b.tactics || {}) as Record<string, unknown>
  for (const h of (tac.hanging_white || []) as Array<{ role: string; square: string }>) {
    facts.push({ side: 'black', importance: 90, text: `White's ${h.role} on ${h.square} is hanging` })
  }
  for (const h of (tac.hanging_black || []) as Array<{ role: string; square: string }>) {
    facts.push({ side: 'white', importance: 90, text: `Black's ${h.role} on ${h.square} is hanging` })
  }
  for (const p of (tac.pinned_pieces || []) as Array<{ role: string; square: string; absolute?: boolean }>) {
    facts.push({ side: 'both', importance: 60, text: `${p.role} on ${p.square} is pinned${p.absolute ? ' to the king' : ''}` })
  }

  return facts
}




function verdictText(cp: number) {
  if (Math.abs(cp) < 25) return { side: null, text: 'Roughly equal' }
  const side = cp > 0 ? 'White' : 'Black'
  const m = Math.abs(cp)
  if (m < 75) return { side, text: 'has a slight edge' }
  if (m < 200) return { side, text: 'is better' }
  if (m < 500) return { side, text: 'has a winning advantage' }
  return { side, text: 'is clearly winning' }
}

const FACT_COUNT_DEFAULT = 3
const FACT_IMPORTANCE_MIN = 60

const expanded = ref(false)

const verdict = computed(() => verdictText(props.explanation?.eval_cp ?? 0))
const allFacts = computed(() => extractFacts(props.explanation))
const decisiveFacts = computed(() => allFacts.value.filter((f) => f.importance >= FACT_IMPORTANCE_MIN))
const visibleFacts = computed(() => decisiveFacts.value.slice(0, FACT_COUNT_DEFAULT))
const remainingFactsCount = computed(() => allFacts.value.length - visibleFacts.value.length)

const plan = computed(() => props.explanation?.principal_plan)
const hasPlan = computed(() => plan.value && Array.isArray(plan.value.moves) && plan.value.moves.length >= 2)

function copyJson(e: MouseEvent) {
  e.stopPropagation()
  try {
    navigator.clipboard.writeText(JSON.stringify(props.explanation, null, 2))
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div v-if="explanation" class="border-b border-border p-3">
    <!-- Verdict line -->
    <div class="text-[13px] leading-normal text-text-primary" :class="{ 'mb-2': visibleFacts.length > 0 }">
      <span v-if="verdict.side" class="text-text-primary font-semibold">{{ verdict.side }}</span>
      <span v-if="verdict.side">&nbsp;</span>
      <span>{{ verdict.text }}</span>
      <span v-if="!verdict.side">; {{ explanation.side_to_move === 'white' ? 'White' : 'Black' }} to move.</span>
    </div>

    <!-- Concrete facts -->
    <ul v-if="visibleFacts.length > 0" class="list-none p-0 m-0 flex flex-col gap-1 text-[12px] leading-normal">
      <li v-for="(fact, idx) in visibleFacts" :key="idx" class="flex gap-2 items-start pl-0.5">
        <span
          class="shrink-0 w-[2px] h-[14px] mt-0.5 rounded-[1px]"
          :class="fact.side === 'white' ? 'bg-text-secondary' : fact.side === 'black' ? 'bg-border-hover' : 'bg-text-disabled'"
        />
        <span class="text-text-primary">{{ fact.text }}</span>
      </li>
    </ul>

    <!-- Engine plan line -->
    <div v-if="plan && hasPlan" class="mt-2.5 pt-2 border-t border-dashed border-border text-[12px] leading-relaxed">
      <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-1">
        Engine plan <span v-if="plan?.depth">· depth {{ plan.depth }}</span>
      </div>
      <div v-if="plan?.description" class="text-text-primary">
        {{ plan.description }}
      </div>
    </div>

    <!-- Expand button -->
    <button
      v-if="remainingFactsCount > 0 || plan?.description || explanation?.summary_text"

      @click="expanded = !expanded"
      class="flex items-center gap-1 mt-2 p-0 bg-transparent border-none cursor-pointer text-[11px] text-text-secondary font-semibold hover:text-neon-cyan transition-colors"
    >
      <span
        class="inline-block transition-transform duration-120 text-[12px] leading-none"
        :class="expanded ? 'rotate-0' : '-rotate-90'"
      >▾</span>
      {{ expanded ? 'less' : remainingFactsCount > 0 ? `${remainingFactsCount} more · plan · narrative` : 'plan · narrative' }}
    </button>

    <!-- Expanded view -->
    <div v-if="expanded" class="mt-2 pt-2 border-t border-border flex flex-col gap-3 text-[12px] text-text-secondary leading-relaxed">
      <ul v-if="remainingFactsCount > 0" class="list-none p-0 m-0 flex flex-col gap-1">
        <li v-for="(fact, idx) in allFacts.slice(visibleFacts.length)" :key="idx" class="flex gap-2 items-start pl-0.5">
          <span
            class="shrink-0 w-[2px] h-[14px] mt-0.5 rounded-[1px]"
            :class="fact.side === 'white' ? 'bg-text-secondary' : fact.side === 'black' ? 'bg-border-hover' : 'bg-text-disabled'"
          />
          <span class="text-text-secondary">{{ fact.text }}</span>
        </li>
      </ul>

      <section v-if="plan && plan.moves?.length > 0">
        <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-1">
          Engine plan <span v-if="plan.depth">· depth {{ plan.depth }}</span>
        </div>
        <div class="font-mono text-text-primary">
          {{ plan.moves.map((m: any) => m.san).join('  ') }}
        </div>
        <div v-if="plan.description" class="mt-1 text-text-secondary">
          {{ plan.description }}
        </div>
      </section>

      <section v-if="explanation.summary_text">
        <div class="flex items-baseline justify-between mb-1">
          <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary">
            Full summary
          </div>
          <button
            @click="copyJson"
            title="Copy the full structured explanation as JSON"
            class="px-2 py-0.5 text-[10px] font-semibold bg-transparent text-text-secondary border border-border rounded cursor-pointer hover:bg-elevated hover:text-text-primary"
          >
            Copy JSON
          </button>
        </div>
        <div class="text-text-secondary whitespace-pre-wrap max-h-[220px] overflow-y-auto pr-1 thin-scroll">
          {{ explanation.summary_text }}
        </div>
      </section>
    </div>
  </div>
</template>
