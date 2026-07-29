<script setup lang="ts">
import { ref, computed } from 'vue'

import type {
  CoachExplanation,
  VisualizerLogItem,
  VisualizerInputSources,
  VisualizerInputPlanStep,
  VisualizerInputPawnStruct,
  VisualizerInputTheme,
  VisualizerInputEngineMove,
  VisualizerInputPosSummary,
} from '@/shared/lib/engine/coach/coach.types'

const props = defineProps<{
  boardHeight: number
  posExplanation: CoachExplanation | null | undefined
}>()

const activeTab = ref<'output' | 'inputs'>('output')
const activeCategory = ref<string>('ALL')
const searchQuery = ref<string>('')
const isCollapsed = ref<boolean>(false)
const copied = ref<boolean>(false)

// Output Visual Logs
const logs = computed<VisualizerLogItem[]>(() => {
  if (!props.posExplanation || !props.posExplanation.visual_commands) return []
  const l = (props.posExplanation.visual_commands as Record<string, unknown>)._logs
  if (Array.isArray(l)) return l as VisualizerLogItem[]
  return []
})

// Input Data Sources
const inputSources = computed<VisualizerInputSources | null>(() => {
  if (!props.posExplanation || !props.posExplanation.visual_commands) return null
  return ((props.posExplanation.visual_commands as Record<string, unknown>)._input_sources as VisualizerInputSources) || null
})

const categories = computed(() => {
  const set = new Set<string>()
  logs.value.forEach((item: VisualizerLogItem) => {
    if (item.category) set.add(item.category)
  })
  return ['ALL', ...Array.from(set)]
})

const filteredLogs = computed(() => {
  return logs.value.filter((item: VisualizerLogItem) => {
    if (activeCategory.value !== 'ALL' && item.category !== activeCategory.value) {
      return false
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      const text = `${item.category || ''} ${item.title || ''} ${item.reason || ''} ${item.command || ''} ${(item.squares || []).join(' ')}`.toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })
})

const inputTactics = computed<unknown[]>(() => inputSources.value?.tactics || [])
const inputPlanSteps = computed<VisualizerInputPlanStep[]>(() => inputSources.value?.planSteps || [])
const inputPawnStruct = computed<VisualizerInputPawnStruct | null>(() => inputSources.value?.pawnStructure || null)
const inputThemes = computed<VisualizerInputTheme[]>(() => inputSources.value?.themes || [])
const inputPassedPawns = computed<string[]>(() => inputSources.value?.passedPawns || [])
const inputWeakPawns = computed<string[]>(() => inputSources.value?.weakPawns || [])
const inputPrincipalPlan = computed(() => inputSources.value?.principalPlan || null)
const inputEngineTopMoves = computed<VisualizerInputEngineMove[]>(() => inputSources.value?.engineTopMoves || [])

const inputPosSummary = computed<VisualizerInputPosSummary | null>(() => inputSources.value?.positionSummary || null)
const inputLastMove = computed(() => inputSources.value?.lastMoveAnalysis || null)

const inputSourcesTotalCount = computed(() => {
  if (!inputSources.value) return 0
  return (
    inputTactics.value.length +
    inputPlanSteps.value.length +
    (inputPawnStruct.value ? 1 : 0) +
    inputThemes.value.length +
    inputEngineTopMoves.value.length
  )
})



async function copyData() {
  const lines: string[] = []

  // Section 1: Output Commands
  lines.push(`=== Visualizer Output Commands (${logs.value.length} items) ===\n`)
  if (logs.value.length === 0) {
    lines.push('No visualizer commands generated for this position.\n')
  } else {
    logs.value.forEach((log: VisualizerLogItem, idx: number) => {
      lines.push(`${idx + 1}. [${log.category}] ${log.title}`)
      if (log.squares && log.squares.length > 0) {
        lines.push(`   Squares: ${log.squares.join(', ')}`)
      }
      if (log.reason) {
        lines.push(`   Reason: ${log.reason}`)
      }
      if (log.command) {
        lines.push(`   Command: ${log.command}`)
      }
      lines.push('')
    })
  }

  // Section 2: Input Sources
  lines.push(`=== Visualizer Input Sources ===\n`)
  if (inputSources.value) {
    lines.push(`FEN: ${inputSources.value.fen || ''}`)
    lines.push(`Attacking Side: ${inputSources.value.attackingSide === 'w' ? 'white' : 'black'}`)

    // 0. Position Summary
    if (inputPosSummary.value) {
      lines.push(`\n--- Position Summary ---`)
      const evalStr =
        inputPosSummary.value.evalMate !== null && inputPosSummary.value.evalMate !== undefined
          ? `M${inputPosSummary.value.evalMate}`
          : typeof inputPosSummary.value.evalPawns === 'number'
            ? inputPosSummary.value.evalPawns >= 0
              ? `+${inputPosSummary.value.evalPawns.toFixed(2)}`
              : inputPosSummary.value.evalPawns.toFixed(2)
            : '0.00'
      lines.push(`Eval: ${evalStr}`)
      if (inputPosSummary.value.phase) lines.push(`Phase: ${inputPosSummary.value.phase}`)
      if (inputPosSummary.value.verdict) lines.push(`Verdict: ${inputPosSummary.value.verdict}`)
      if (inputPosSummary.value.materialSummary) lines.push(`Material: ${inputPosSummary.value.materialSummary}`)
    }

    // 0.1 Last Move Analysis
    if (inputLastMove.value?.san) {
      lines.push(`\n--- Last Move Analysis ---`)
      let moveLine = `Move: ${inputLastMove.value.san}`
      if (inputLastMove.value.uci) moveLine += ` (${inputLastMove.value.uci})`
      if (inputLastMove.value.quality) moveLine += ` [${inputLastMove.value.quality}]`
      lines.push(moveLine)
      if (typeof inputLastMove.value.win_rate_loss === 'number') {
        lines.push(`Win Rate Loss: ${inputLastMove.value.win_rate_loss}%`)
      }
      if (inputLastMove.value.best_move_san) {
        lines.push(`Best Move: ${inputLastMove.value.best_move_san}`)
      }
      if (inputLastMove.value.summary) lines.push(`Summary: ${inputLastMove.value.summary}`)
      if (inputLastMove.value.details) lines.push(`Details: ${inputLastMove.value.details}`)
      if (inputLastMove.value.consequence) lines.push(`Consequence: ${inputLastMove.value.consequence}`)
    }

    // 1. Principal Plan & Plan Steps
    if (inputPrincipalPlan.value?.theme || inputPrincipalPlan.value?.description) {
      lines.push(`\n--- Principal Plan Overview ---`)
      if (inputPrincipalPlan.value.theme) lines.push(`Theme: ${inputPrincipalPlan.value.theme}`)
      if (inputPrincipalPlan.value.description) lines.push(`Description: ${inputPrincipalPlan.value.description}`)
    }

    if (inputPlanSteps.value.length) {
      lines.push(`\n--- Plan Steps (${inputPlanSteps.value.length}) ---`)
      inputPlanSteps.value.forEach((m: VisualizerInputPlanStep, i: number) => {
        let line = `  ${i + 1}. ${m.san || m.uci || `${m.from}->${m.to}`}`
        if (m.quality) line += ` [${m.quality}]`
        if (m.headline) line += ` | Headline: ${m.headline}`
        if (m.motifs?.length) line += ` | Motifs: ${m.motifs.join(', ')}`
        lines.push(line)
      })
    }

    // 2. Pawn Structure
    if (inputPawnStruct.value) {
      lines.push(`\n--- Pawn Structure ---`)
      if (inputPawnStruct.value.summary) lines.push(`Summary: ${inputPawnStruct.value.summary}`)
      if (inputPawnStruct.value.darkComplexWeak) lines.push(`Dark Squares Weak: ${inputPawnStruct.value.darkComplexWeak}`)
      lines.push(`Passed Pawns: ${inputPassedPawns.value.length ? inputPassedPawns.value.join(', ') : 'None'}`)
      lines.push(`Weak Pawns: ${inputWeakPawns.value.length ? inputWeakPawns.value.join(', ') : 'None'}`)
      if (inputPawnStruct.value.whiteIsolated?.length || inputPawnStruct.value.blackIsolated?.length) {
        lines.push(`Isolated Pawns: White: ${inputPawnStruct.value.whiteIsolated?.join(', ') || 'None'} | Black: ${inputPawnStruct.value.blackIsolated?.join(', ') || 'None'}`)
      }
      if (inputPawnStruct.value.whiteBackward?.length || inputPawnStruct.value.blackBackward?.length) {
        lines.push(`Backward Pawns: White: ${inputPawnStruct.value.whiteBackward?.join(', ') || 'None'} | Black: ${inputPawnStruct.value.blackBackward?.join(', ') || 'None'}`)
      }
    }

    // 3. Strategic Themes
    if (inputThemes.value.length) {
      lines.push(`\n--- Strategic Themes (${inputThemes.value.length}) ---`)
      inputThemes.value.forEach((t: VisualizerInputTheme, i: number) => {
        lines.push(`  ${i + 1}. [${t.id}] (${t.side}, strength: ${t.strength}): ${t.description}`)
      })
    }

    // 4. Candidate Engine Top Moves
    if (inputEngineTopMoves.value.length) {
      lines.push(`\n--- Candidate Engine Moves (${inputEngineTopMoves.value.length}) ---`)
      inputEngineTopMoves.value.forEach((m: VisualizerInputEngineMove, i: number) => {
        const scoreStr =
          typeof m.score === 'number'
            ? m.score >= 0
              ? `+${(m.score / 100).toFixed(2)}`
              : `${(m.score / 100).toFixed(2)}`
            : m.mate !== null && m.mate !== undefined
              ? `M${m.mate}`
              : 'N/A'
        let line = `  ${i + 1}. ${m.san} (Eval: ${scoreStr})`
        if (m.character) line += ` [${m.character}]`
        if (m.headline) line += ` | Headline: ${m.headline}`
        if (m.planBrief) line += ` | Brief: ${m.planBrief}`
        if (m.motifs?.length) line += ` | Motifs: ${m.motifs.join(', ')}`
        lines.push(line)
      })
    }
  } else {
    lines.push('No input source data available.')
  }

  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {}
}

function getCategoryBadgeClass(category?: string) {
  switch (category) {
    case 'Plan': return 'bg-highlight/15 text-highlight border-highlight/30'
    case 'Tactics': return 'bg-danger/15 text-danger border-danger/30'
    case 'Maneuver': return 'bg-info/15 text-info border-info/30'
    case 'Key Squares': return 'bg-success/15 text-success border-success/30'
    case 'Pawn Race': return 'bg-warning/15 text-warning border-warning/30'
    case 'Opposition': return 'bg-neon-purple/15 text-neon-purple border-neon-purple/30'
    case 'Structure': return 'bg-orange/15 text-orange border-orange/30'
    default: return 'bg-elevated text-text-secondary border-border'
  }
}

</script>

<template>
  <div
    class="visualizer-console thin-scroll w-full h-full flex flex-col border border-border rounded-md overflow-hidden bg-void text-text-primary"
    :style="boardHeight ? { height: `${boardHeight}px` } : {}"
  >
    <!-- Header -->
    <div class="p-2.5 border-b border-border bg-surface flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-neon-cyan"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
        <span class="text-xs font-bold tracking-tight text-text-primary">Visualizer Console</span>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Copy Button -->
        <button
          @click="copyData"
          title="Copy data to clipboard"
          class="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border border-border bg-elevated hover:bg-border-hover text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
        >
          <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-success"><polyline points="20 6 9 17 4 12"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
        </button>

        <button
          @click="isCollapsed = !isCollapsed"
          class="text-xs text-text-secondary hover:text-text-primary p-1 rounded hover:bg-elevated cursor-pointer"
        >
          <svg v-if="isCollapsed" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
      </div>
    </div>

    <!-- Mode Selector Tabs (Output Commands vs Input Sources) -->
    <div class="flex border-b border-border bg-surface shrink-0 text-[11px] font-semibold">
      <button
        @click="activeTab = 'output'"
        class="flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-r border-border"
        :class="activeTab === 'output' ? 'bg-elevated text-neon-cyan border-b-2 border-b-neon-cyan' : 'text-text-secondary hover:bg-surface'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        <span>Output Commands</span>
        <span class="text-[9px] font-mono px-1 rounded-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
          {{ logs.length }}
        </span>
      </button>

      <button
        @click="activeTab = 'inputs'"
        class="flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        :class="activeTab === 'inputs' ? 'bg-elevated text-success border-b-2 border-b-success' : 'text-text-secondary hover:bg-surface'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        <span>Input Sources</span>
        <span class="text-[9px] font-mono px-1 rounded-full bg-success/20 text-success border border-success/30">
          {{ inputSourcesTotalCount }}
        </span>
      </button>
    </div>

    <template v-if="!isCollapsed">
      <!-- Mode 1: Output Commands -->
      <template v-if="activeTab === 'output'">
        <!-- Filter Bar -->
        <div class="p-2 border-b border-border bg-surface flex flex-col gap-1.5 shrink-0">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Filter by square, motif or text…"
            class="w-full px-2 py-1 bg-elevated border border-border rounded text-[11px] text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-cyan"
          />

          <div v-if="categories.length > 1" class="flex flex-wrap gap-1">
            <button
              v-for="cat in categories"
              :key="cat"
              @click="activeCategory = cat"
              class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors cursor-pointer"
              :class="activeCategory === cat ? 'bg-neon-cyan text-void font-bold' : 'bg-elevated text-text-secondary hover:bg-border-hover'"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <!-- Logs Content List -->
        <div class="flex-1 p-2 overflow-y-auto thin-scroll space-y-2">
          <div v-if="logs.length === 0" class="flex flex-col items-center justify-center py-8 text-center text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-1.5 opacity-50"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span class="text-xs">No visualizer commands for this position.</span>
          </div>

          <div v-else-if="filteredLogs.length === 0" class="py-4 text-center text-xs text-text-secondary">
            No matching logs found.
          </div>

          <div
            v-for="(log, idx) in filteredLogs"
            :key="idx"
            class="p-2.5 rounded border border-border bg-surface hover:border-border-hover transition-colors"
          >
            <!-- Top Row: Category + Squares -->
            <div class="flex items-center justify-between mb-1 gap-1 flex-wrap">
              <span
                class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                :class="getCategoryBadgeClass(log.category)"
              >
                {{ log.category }}
              </span>

              <div v-if="log.squares && log.squares.length > 0" class="flex items-center gap-1">
                <span class="text-[9px] text-text-secondary uppercase font-semibold">Squares:</span>
                <span class="font-mono text-[11px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">
                  {{ log.squares.join(', ') }}
                </span>
              </div>
            </div>

            <!-- Title -->
            <div class="text-xs font-semibold text-text-primary mb-1">
              {{ log.title }}
            </div>

            <!-- Reason / Why -->
            <div class="text-[11px] text-text-secondary leading-tight mb-1.5">
              {{ log.reason }}
            </div>

            <!-- Raw Command Snippet -->
            <div v-if="log.command" class="font-mono text-[10px] bg-void text-neon-cyan p-1.5 rounded border border-border break-all">
              {{ log.command }}
            </div>
          </div>
        </div>
      </template>

      <!-- Mode 2: Input Sources Inspector -->
      <template v-else>
        <div class="flex-1 p-2.5 overflow-y-auto thin-scroll space-y-3">
          <div v-if="!inputSources" class="text-xs text-text-secondary italic py-4 text-center">
            No input source data available.
          </div>

          <template v-else>
            <!-- 0. Position Summary Header -->
            <div v-if="inputPosSummary" class="p-2.5 rounded border border-border bg-surface text-[11px] font-mono flex flex-col gap-1">
              <div class="text-[9px] uppercase font-bold text-text-secondary tracking-wider">Position Summary</div>
              <div class="flex items-center gap-1.5 flex-wrap text-text-primary">
                <span
                  v-if="typeof inputPosSummary.evalPawns === 'number' || inputPosSummary.evalMate !== null"
                  class="px-1.5 py-0.5 rounded font-bold text-[10px]"
                  :class="typeof inputPosSummary.evalPawns === 'number' && inputPosSummary.evalPawns < 0 ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-success/20 text-success border border-success/30'"
                >
                  Eval: {{ inputPosSummary.evalMate !== null ? `M${inputPosSummary.evalMate}` : (typeof inputPosSummary.evalPawns === 'number' ? (inputPosSummary.evalPawns >= 0 ? `+${inputPosSummary.evalPawns.toFixed(2)}` : inputPosSummary.evalPawns.toFixed(2)) : '0.00') }}
                </span>
                <span v-if="inputPosSummary.phase" class="capitalize text-text-secondary text-[10px]">
                  ({{ inputPosSummary.phase }})
                </span>
                <span v-if="inputPosSummary.verdict" class="text-warning font-sans font-semibold text-[10px]">
                  | Verdict: {{ inputPosSummary.verdict }}
                </span>
              </div>
              <div v-if="inputPosSummary.materialSummary" class="text-[10px] text-text-secondary font-sans italic mt-0.5">
                Material: {{ inputPosSummary.materialSummary }}
              </div>
            </div>

            <!-- 0.1 Last Move Analysis & Consequence -->
            <div v-if="inputLastMove?.san" class="p-2.5 rounded border border-border bg-surface text-[11px] space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-[9px] uppercase font-bold text-danger tracking-wider flex items-center gap-1.5">
                  📜 Last Move: {{ inputLastMove.san }}
                  <span v-if="inputLastMove.uci" class="font-mono text-text-secondary lowercase">({{ inputLastMove.uci }})</span>
                </span>
                <span v-if="inputLastMove.quality" class="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-danger/15 text-danger border border-danger/30">
                  {{ inputLastMove.quality }}
                </span>
              </div>
              <div v-if="typeof inputLastMove.win_rate_loss === 'number' || inputLastMove.best_move_san" class="flex items-center gap-2 text-[10px] font-mono">
                <span v-if="typeof inputLastMove.win_rate_loss === 'number'" class="text-text-secondary">
                  Win Rate Loss: <strong class="text-warning">{{ inputLastMove.win_rate_loss }}%</strong>
                </span>
                <span v-if="inputLastMove.best_move_san" class="text-text-secondary">
                  Best Move: <strong class="text-success">{{ inputLastMove.best_move_san }}</strong>
                </span>
              </div>
              <div v-if="inputLastMove.summary" class="text-[11px] text-text-primary">
                {{ inputLastMove.summary }}
              </div>
              <div v-if="inputLastMove.details" class="text-[10px] text-text-secondary italic">
                {{ inputLastMove.details }}
              </div>
              <div v-if="inputLastMove.consequence" class="mt-1 pt-1 border-t border-border text-[10px] text-warning leading-tight">
                <span class="text-[8px] uppercase tracking-wider font-bold text-warning mr-1">Consequence:</span>
                {{ inputLastMove.consequence }}
              </div>
            </div>

            <!-- 1. Engine Plan Steps -->
            <div class="rounded border border-border bg-surface p-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] uppercase font-bold text-neon-cyan tracking-wider">
                  🤖 Stockfish Plan Steps (MultiPV)
                </span>
                <span class="text-[10px] font-mono px-1.5 rounded bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20">
                  {{ inputPlanSteps.length }}
                </span>
              </div>

              <!-- Plan Theme & Description Overview -->
              <div v-if="inputPrincipalPlan?.theme || inputPrincipalPlan?.description" class="mb-2 p-1.5 rounded bg-neon-cyan/10 border border-neon-cyan/20 text-[11px] space-y-1">
                <div v-if="inputPrincipalPlan.theme" class="flex items-center gap-1.5">
                  <span class="text-[9px] uppercase font-bold text-neon-cyan">Theme:</span>
                  <span class="font-mono text-[10px] font-bold text-neon-cyan bg-neon-cyan/20 px-1 py-0.5 rounded border border-neon-cyan/30">
                    {{ inputPrincipalPlan.theme }}
                  </span>
                </div>
                <div v-if="inputPrincipalPlan.description" class="text-[10px] text-text-secondary leading-tight italic">
                  {{ inputPrincipalPlan.description }}
                </div>
              </div>

              <div v-if="inputPlanSteps.length === 0" class="text-[11px] text-text-secondary italic">
                No plan steps available.
              </div>
              <div v-else class="space-y-1.5">
                <div
                  v-for="(s, i) in inputPlanSteps"
                  :key="i"
                  class="text-[11px] p-1.5 rounded bg-void border border-border flex flex-col gap-1"
                >
                  <div class="flex items-center justify-between font-mono font-semibold">
                    <span class="text-success">{{ Number(i) + 1 }}. {{ s.san || `${s.from}->${s.to}` }}</span>
                    <span v-if="s.quality" class="text-[9px] uppercase font-bold px-1 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
                      {{ s.quality }}
                    </span>
                  </div>
                  <div v-if="s.headline" class="text-[10px] text-neon-cyan font-sans italic flex items-center gap-1">
                    <span>📌</span> {{ s.headline }}
                  </div>
                  <div v-if="s.motifs?.length" class="text-[10px] text-text-secondary flex gap-1 flex-wrap">
                    <span class="text-text-secondary">Motifs:</span>
                    <span v-for="m in s.motifs" :key="m" class="px-1 bg-elevated rounded text-warning">
                      {{ m }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Pawn Structure -->
            <div class="rounded border border-border bg-surface p-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] uppercase font-bold text-warning tracking-wider">
                  ♟️ Pawn Structure
                </span>
              </div>

              <div class="space-y-1.5 text-[11px]">
                <div v-if="inputPawnStruct?.summary" class="text-[10px] text-warning italic bg-warning/10 p-1 rounded border border-warning/20">
                  {{ inputPawnStruct.summary }}
                </div>

                <div v-if="inputPawnStruct?.darkComplexWeak" class="flex items-center gap-2">
                  <span class="text-text-secondary font-semibold">Dark Squares Weak:</span>
                  <span class="font-mono text-danger font-bold bg-danger/10 px-1.5 py-0.5 rounded border border-danger/20 uppercase text-[10px]">
                    {{ inputPawnStruct.darkComplexWeak }}
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-text-secondary font-semibold">Passed Pawns:</span>
                  <span v-if="inputPassedPawns.length" class="font-mono text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">
                    {{ inputPassedPawns.join(', ') }}
                  </span>
                  <span v-else class="text-text-secondary italic">None</span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-text-secondary font-semibold">Weak Pawns:</span>
                  <span v-if="inputWeakPawns.length" class="font-mono text-warning font-bold bg-warning/10 px-1.5 py-0.5 rounded border border-warning/20">
                    {{ inputWeakPawns.join(', ') }}
                  </span>
                  <span v-else class="text-text-secondary italic">None</span>
                </div>

                <div v-if="inputPawnStruct?.whiteIsolated?.length || inputPawnStruct?.blackIsolated?.length" class="flex items-start gap-1 flex-col">
                  <span class="text-text-secondary font-semibold">Isolated Pawns:</span>
                  <div class="text-[10px] font-mono text-text-secondary pl-1">
                    <span v-if="inputPawnStruct.whiteIsolated?.length" class="mr-2">White: {{ inputPawnStruct.whiteIsolated.join(', ') }}</span>
                    <span v-if="inputPawnStruct.blackIsolated?.length">Black: {{ inputPawnStruct.blackIsolated.join(', ') }}</span>
                  </div>
                </div>

                <div v-if="inputPawnStruct?.whiteBackward?.length || inputPawnStruct?.blackBackward?.length" class="flex items-start gap-1 flex-col">
                  <span class="text-text-secondary font-semibold">Backward Pawns:</span>
                  <div class="text-[10px] font-mono text-text-secondary pl-1">
                    <span v-if="inputPawnStruct.whiteBackward?.length" class="mr-2">White: {{ inputPawnStruct.whiteBackward.join(', ') }}</span>
                    <span v-if="inputPawnStruct.blackBackward?.length">Black: {{ inputPawnStruct.blackBackward.join(', ') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Strategic Themes -->
            <div v-if="inputThemes?.length" class="rounded border border-border bg-surface p-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] uppercase font-bold text-neon-purple tracking-wider">
                  💡 Strategic Themes ({{ inputThemes.length }})
                </span>
              </div>

              <div class="space-y-1.5">
                <div
                  v-for="t in inputThemes"
                  :key="t.id"
                  class="text-[11px] p-1.5 rounded bg-void border border-border flex flex-col gap-0.5"
                >
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[9px] font-bold text-neon-purple bg-neon-purple/15 px-1 py-0.5 rounded border border-neon-purple/30">
                      {{ t.id }}
                    </span>
                    <span class="text-[9px] text-text-secondary font-mono">
                      {{ t.side }} • str: {{ t.strength }}
                    </span>
                  </div>
                  <div class="text-[10px] text-text-primary leading-tight">
                    {{ t.description }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 6. Candidate Engine Top Moves (MultiPV) -->
            <div v-if="inputEngineTopMoves?.length" class="rounded border border-border bg-surface p-2.5">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] uppercase font-bold text-neon-cyan tracking-wider">
                  🧠 Candidate Engine Moves (MultiPV: {{ inputEngineTopMoves.length }})
                </span>
              </div>

              <div class="space-y-1.5">
                <div
                  v-for="(m, idx) in inputEngineTopMoves"
                  :key="idx"
                  class="text-[11px] p-1.5 rounded bg-void border border-border flex flex-col gap-1"
                >
                  <div class="flex items-center justify-between font-mono font-semibold">
                    <div class="flex items-center gap-1.5">
                      <span class="text-neon-cyan">{{ Number(idx) + 1 }}. {{ m.san }}</span>
                      <span
                        v-if="typeof m.score === 'number' || m.mate !== null"
                        class="text-[9px] font-mono font-bold px-1 py-0.2 rounded border"
                        :class="typeof m.score === 'number' && m.score < 0 ? 'bg-danger/15 text-danger border-danger/30' : 'bg-success/15 text-success border-success/30'"
                      >
                        {{ typeof m.score === 'number' ? (m.score >= 0 ? `+${(m.score / 100).toFixed(2)}` : `${(m.score / 100).toFixed(2)}`) : `M${m.mate}` }}
                      </span>
                    </div>

                    <span v-if="m.character" class="text-[9px] uppercase font-bold px-1 rounded bg-elevated text-text-secondary border border-border-hover">
                      {{ m.character }}
                    </span>
                  </div>

                  <div v-if="m.headline" class="text-[10px] text-neon-cyan font-sans italic flex items-center gap-1">
                    <span>📌</span> {{ m.headline }}
                  </div>

                  <div v-if="m.planBrief" class="text-[10px] text-text-secondary leading-tight">
                    {{ m.planBrief }}
                  </div>

                  <div v-if="m.motifs?.length" class="text-[10px] text-text-secondary flex gap-1 flex-wrap">
                    <span class="text-text-secondary">Motifs:</span>
                    <span v-for="mo in m.motifs" :key="mo" class="px-1 bg-elevated rounded text-warning text-[9px]">
                      {{ mo }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 7. FEN Context -->
            <div class="rounded border border-border bg-surface p-2.5 text-[10px] font-mono text-text-secondary break-all">
              <div class="text-[9px] uppercase font-bold text-text-secondary mb-1">FEN Context</div>
              <div>{{ inputSources.fen }}</div>
              <div class="mt-1 text-text-primary">Side to move: <span class="font-bold text-neon-cyan">{{ inputSources.attackingSide === 'w' ? 'White' : 'Black' }}</span></div>
            </div>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>
