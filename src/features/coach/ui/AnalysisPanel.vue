<script setup lang="ts">
import QualityIcon from './QualityIcon.vue'
import ChessPieceIcon from './ChessPieceIcon.vue'
import SettingsPanel from './SettingsPanel.vue'
import AboutPosition from './AboutPosition.vue'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'

const props = defineProps<{
  boardHeight: number
  engineLoading: boolean
  showLoadingBanner: boolean
  stockfishReady: boolean
  wasmReady: boolean
  historyIndex: number
  moveHistory: Array<{ fen: string; san: string | null }>
  sideToMove: 'w' | 'b'
  phase: string
  materialDelta: number
  openingName: string | null
  lastMoveAnalysis: CoachLastMoveAnalysis | null
  lastMoveConsequence: string | null
  posExplanation: CoachExplanation | null
  topMoves: CoachTopMove[]
  topMovesLoading: boolean
  selectedMoveIndex: number | null
  explanation: CoachLastMoveAnalysis | null
  explanationLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'go-back'): void
  (e: 'go-forward'): void
  (e: 'random-pos'): void
  (e: 'flip-board'): void
  (e: 'reset-board'): void
  (e: 'settings-change'): void
  (e: 'select-history-move', payload: { fen: string; index: number }): void
  (e: 'select-move', index: number): void
}>()

const QUALITY_BG: Record<string, string> = {
  brilliant: 'var(--color-neon-cyan)',
  great: 'var(--color-success)',
  best: 'var(--color-success)',
  excellent: 'var(--color-success)',
  good: 'var(--color-info)',
  neutral: 'var(--color-text-secondary)',
  inaccuracy: 'var(--color-warning)',
  mistake: 'var(--color-orange)',
  blunder: 'var(--color-danger)',
  missed_mate: 'var(--color-danger)',
}

const QUALITY_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  best: 'Best move',
  excellent: 'Excellent',
  good: 'Good move',
  neutral: 'Neutral',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  missed_mate: 'Missed mate',
}

function sanWithPieces(san: string | null) {
  if (!san) return { piece: null, rest: '' }
  const first = san.charAt(0)
  if (['N', 'B', 'R', 'Q', 'K'].includes(first)) {
    return { piece: first, rest: san.slice(1) }
  }
  return { piece: null, rest: san }
}

function getQualityColor(q: string) {
  return QUALITY_BG[q] || 'var(--color-text-secondary)'
}

function getQualityLabel(q: string) {
  return QUALITY_LABEL[q] || ''
}

function getMoveQuality(move: CoachTopMove, idx: number) {
  if (move?.quality) return move.quality
  if (props.selectedMoveIndex === idx && props.explanation?.quality) return props.explanation.quality
  const firstMove = props.posExplanation?.principal_plan?.moves?.[0] as { quality?: string } | undefined
  if (idx === 0 && firstMove?.quality) {
    return firstMove.quality
  }
  return null
}

function characterColor(label: string) {
  switch (label) {
    case 'Aggressive': return 'var(--color-danger)'
    case 'Combative': return 'var(--color-orange)'
    case 'Forcing': return 'var(--color-warning)'
    case 'Risky': return 'var(--color-highlight)'
    case 'Drawish': return 'var(--color-text-secondary)'
    case 'Positional': return 'var(--color-success)'
    case 'Solid': return 'var(--color-neon-cyan)'
    case 'Quiet': return 'var(--color-text-disabled)'
    default: return 'var(--color-text-secondary)'
  }
}

function characterBorder(label: string) {
  const color = characterColor(label)
  return `color-mix(in srgb, ${color} 35%, transparent)`
}

function formatGames(n: number) {
  if (!n || typeof n !== 'number') return ''
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

function getWhiteWinP(move: CoachTopMove): number {
  if (typeof move?.winP !== 'number' || typeof move?.lossP !== 'number') return 0
  return props.sideToMove === 'w' ? move.winP : move.lossP
}

function getBlackWinP(move: CoachTopMove): number {
  if (typeof move?.winP !== 'number' || typeof move?.lossP !== 'number') return 0
  return props.sideToMove === 'w' ? move.lossP : move.winP
}

function getCharacter(move: CoachTopMove): string | null {
  if (!props.posExplanation || !props.posExplanation.engine_top_moves) return null
  const moveUci = move.move || move.uci
  const found = props.posExplanation.engine_top_moves.find((em) => em.uci === moveUci)
  return found?.character || null
}

function getPlanBrief(move: CoachTopMove): string | null {
  if (!props.posExplanation || !props.posExplanation.engine_top_moves) return null
  const moveUci = move.move || move.uci
  const found = props.posExplanation.engine_top_moves.find((em) => em.uci === moveUci)
  return found?.plan_brief || null
}
</script>

<template>
  <div
    class="analysis-panel thin-scroll w-full h-full flex-1 flex flex-col border border-border rounded-md overflow-hidden text-text-primary bg-surface"
    :style="boardHeight ? { minHeight: `${boardHeight}px` } : {}"
  >

    <!-- Engine Loading Banner -->
    <div
      v-if="engineLoading && showLoadingBanner"
      class="p-2 border-b border-border bg-neon-cyan/10 text-[11px] text-neon-cyan leading-tight flex items-center gap-2"
    >
      <span class="inline-block w-2.5 h-2.5 rounded-full border-2 border-cyan-deep border-t-transparent animate-spin shrink-0" />
      <span>
        {{
          !stockfishReady && !wasmReady
            ? 'Loading engine and analyzer…'
            : !stockfishReady
            ? 'Loading Stockfish…'
            : 'Loading analyzer…'
        }}
        First visit downloads ~3 MB; cached afterwards.
      </span>
    </div>

    <!-- Toolbar buttons -->
    <div class="flex items-center gap-1.5 p-2 border-b border-border">
      <button
        @click="emit('go-back')"
        :disabled="historyIndex === 0"
        title="Previous move (← / ↑)"
        class="icon-btn p-1.5 rounded-md bg-elevated border border-border text-text-secondary disabled:text-text-disabled cursor-pointer disabled:cursor-default"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button
        @click="emit('go-forward')"
        :disabled="historyIndex >= moveHistory.length - 1"
        title="Next move (→ / ↓)"
        class="icon-btn p-1.5 rounded-md bg-elevated border border-border text-text-secondary disabled:text-text-disabled cursor-pointer disabled:cursor-default"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div class="flex-1" />
      <button
        @click="emit('random-pos')"
        title="Random plausible position"
        class="icon-btn p-1.5 rounded-md bg-elevated border border-border text-text-secondary cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
      </button>
      <button
        @click="emit('flip-board')"
        title="Flip board (F)"
        class="icon-btn p-1.5 rounded-md bg-elevated border border-border text-text-secondary cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      </button>
      <button
        @click="emit('reset-board')"
        title="Reset to start position"
        class="icon-btn p-1.5 rounded-md bg-elevated border border-border text-text-secondary cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
      </button>
      <SettingsPanel @change="emit('settings-change')" />
    </div>

    <!-- Compact status line -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-border text-[11px] text-text-secondary">
      <span
        class="w-2 h-2 rounded-full border shrink-0"
        :class="sideToMove === 'w' ? 'bg-text-primary border-text-primary' : 'bg-surface border-border-hover'"
      />
      <span class="text-text-primary font-medium">
        {{ sideToMove === 'w' ? 'White' : 'Black' }} to move
      </span>
      <span class="text-text-disabled">·</span>
      <span class="capitalize">{{ phase }}</span>
      <template v-if="Math.abs(materialDelta) >= 0.1">
        <span class="text-text-disabled">·</span>
        <span class="font-mono text-success">
          {{ materialDelta > 0 ? 'White' : 'Black' }} +{{ Math.abs(materialDelta).toFixed(1) }}
        </span>
      </template>
    </div>

    <!-- Opening name + Move history -->
    <div v-if="openingName || moveHistory.length > 1" class="p-2.5 border-b border-border">
      <div v-if="openingName" class="text-[11px] text-text-primary font-semibold mb-1 tracking-tight">
        {{ openingName }}
      </div>
      <div v-if="moveHistory.length > 1" class="thin-scroll flex flex-wrap gap-[2px] text-[12px] font-mono max-h-16 overflow-y-auto leading-relaxed">
        <span
          v-for="(m, i) in moveHistory.slice(1)"
          :key="i"
          class="history-token inline-flex items-center gap-0.5 cursor-pointer"
          :data-active="historyIndex === i + 1 ? 'true' : 'false'"
          :class="historyIndex === i + 1 ? 'text-neon-cyan' : (i % 2 === 0 ? 'text-text-primary' : 'text-text-secondary')"
          @click="emit('select-history-move', { fen: m.fen, index: i + 1 })"
        >
          <span v-if="i % 2 === 0" class="text-text-disabled mr-0.5">{{ Math.floor(i / 2) + 1 }}.</span>
          <ChessPieceIcon
            v-if="sanWithPieces(m.san).piece"
            :role="sanWithPieces(m.san).piece!"
            :color="i % 2 === 0 ? 'white' : 'black'"
            :size="14"
            class="mr-0.5"
          />
          <span>{{ sanWithPieces(m.san).rest }}</span>
        </span>
      </div>
    </div>

    <!-- Last move card -->
    <div v-if="lastMoveAnalysis" class="p-3 border-b border-border">
      <div class="text-[9px] text-text-secondary tracking-widest uppercase mb-1.5 font-semibold">
        Last move
      </div>
      <div class="flex items-baseline gap-1.5 mb-1 flex-wrap">
        <span class="font-mono text-base font-bold text-text-primary tracking-tight flex items-center gap-2">
          {{ lastMoveAnalysis.san }}
          <span
            v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.quality"
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-void"
            :style="{ backgroundColor: getQualityColor(lastMoveAnalysis.quality) }"
          >
            <QualityIcon :quality="lastMoveAnalysis.quality" :size="16" />
          </span>
        </span>
        <span v-if="lastMoveAnalysis.loading" class="text-[10px] text-text-secondary uppercase">
          Analyzing…
        </span>
        <span
          v-else-if="lastMoveAnalysis.quality"
          class="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
          :style="{
            color: getQualityColor(lastMoveAnalysis.quality),
            backgroundColor: `${getQualityColor(lastMoveAnalysis.quality)}1F`,
            border: `1px solid ${getQualityColor(lastMoveAnalysis.quality)}55`,
          }"
        >
          {{ getQualityLabel(lastMoveAnalysis.quality) }}
        </span>
      </div>

      <div v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.summary" class="text-[12px] text-text-primary mb-0.5">
        {{ lastMoveAnalysis.summary }}
      </div>
      <div v-if="!lastMoveAnalysis.loading && lastMoveAnalysis.details" class="text-[11px] text-text-secondary leading-normal">
        {{ lastMoveAnalysis.details }}
      </div>

      <!-- Consequence line -->
      <div
        v-if="!lastMoveAnalysis.loading && lastMoveConsequence"
        class="mt-1.5 pt-1.5 border-t border-border text-[11px] text-text-primary leading-relaxed"
      >
        <span class="text-text-disabled text-[9px] uppercase tracking-widest font-bold mr-1.5">
          Consequence
        </span>
        {{ lastMoveConsequence }}
      </div>
    </div>

    <!-- Top Moves Section -->
    <div class="flex-1 p-3 overflow-y-auto thin-scroll">
      <div class="text-[9px] uppercase tracking-widest font-bold text-text-secondary mb-2 flex items-center justify-between">
        <span>Engine Candidates</span>
        <span v-if="topMovesLoading" class="text-neon-cyan font-normal">Analyzing…</span>
      </div>

      <div v-if="topMoves.length === 0 && !topMovesLoading" class="text-xs text-text-secondary italic py-2">
        No candidate moves available.
      </div>

      <div
        v-for="(move, idx) in topMoves"
        :key="`${move.move || move.uci}-${idx}`"
        class="top-move-row p-2.5 rounded-md mb-2 border border-border bg-surface hover:border-border-hover transition-colors cursor-pointer"
        :class="selectedMoveIndex === idx ? 'border-neon-cyan/50 bg-elevated' : ''"
        @click="emit('select-move', idx)"
      >
        <!-- 1. Header: Rank, Move SAN, NAG Quality Icon (if present), Eval Pawns -->
        <div class="flex items-center gap-2 mb-1">
          <span
            class="w-5 h-5 rounded-full text-[10px] font-bold font-mono flex items-center justify-center border shrink-0"
            :class="idx === 0 ? 'text-success border-success/35 bg-success/10' : 'text-text-secondary border-border-hover bg-void'"
          >
            {{ move.rank }}
          </span>

          <span
            class="text-[14px] font-semibold font-mono tracking-tight"
            :class="idx === 0 ? 'text-success' : 'text-text-primary'"
          >
            {{ move.san }}
          </span>

          <!-- NAG Quality Badge right next to SAN if present -->
          <span
            v-if="getMoveQuality(move, idx)"
            class="inline-flex items-center justify-center w-5 h-5 rounded-full text-void shrink-0 shadow-sm"
            :style="{ backgroundColor: getQualityColor(getMoveQuality(move, idx) || '') }"
          >
            <QualityIcon
              :quality="getMoveQuality(move, idx) || ''"
              :size="13"
              color="var(--color-void)"
            />
          </span>

          <span
            class="ml-auto text-[11px] font-bold font-mono px-2 py-0.5 rounded-full border tracking-tight"
            :style="{
              backgroundColor: move.eval_pawns > 0 ? 'rgba(0, 255, 85, 0.12)' : move.eval_pawns < 0 ? 'rgba(255, 7, 58, 0.12)' : 'rgba(139, 147, 168, 0.10)',
              color: move.eval_pawns > 0 ? 'var(--color-success)' : move.eval_pawns < 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)',
              borderColor: move.eval_pawns > 0 ? 'rgba(0, 255, 85, 0.30)' : move.eval_pawns < 0 ? 'rgba(255, 7, 58, 0.30)' : 'rgba(139, 147, 168, 0.20)',
            }"
          >
            {{ move.isMate ? (move.mateIn && move.mateIn > 0 ? `+#M${move.mateIn}` : `-#M${Math.abs(move.mateIn || 0)}`) : (move.eval_pawns > 0 ? `+${move.eval_pawns.toFixed(2)}` : move.eval_pawns.toFixed(2)) }}
          </span>
        </div>

        <!-- 2. Character & Theory Badges & Headline -->
        <div
          v-if="move.ecoName || move.name || move.tagline || (getCharacter(move) && getCharacter(move) !== 'Quiet')"
          class="flex items-center gap-1.5 flex-wrap text-[11px] text-text-primary mb-1"
        >
          <!-- Opening Theory Badge -->
          <span
            v-if="move.ecoName || move.name"
            class="text-[9px] font-bold px-1.5 py-[1px] rounded border select-none shrink-0 bg-warning/15 text-warning border-warning/30 flex items-center gap-1"
            :title="`Opening Book: ${move.name || move.ecoName}`"
          >
            <span>📖</span>
            <span>{{ move.ecoName || move.name }}</span>
          </span>

          <span
            v-if="getCharacter(move) && getCharacter(move) !== 'Quiet'"
            class="text-[9px] font-bold tracking-wider uppercase px-1.5 py-[1px] rounded border select-none shrink-0"
            :style="{
              color: characterColor(getCharacter(move)!),
              borderColor: characterBorder(getCharacter(move)!),
              backgroundColor: `${characterColor(getCharacter(move)!)}15`
            }"
          >
            {{ getCharacter(move) }}
          </span>
          <span v-if="move.tagline" class="font-medium text-text-primary flex-1 min-w-0">{{ move.tagline }}</span>
        </div>

        <!-- 3-Color Opening Statistics W/D/L Bar -->
        <div
          v-if="move.winP !== null && move.winP !== undefined && move.drawP !== null && move.lossP !== null"
          class="mt-1.5 pt-1.5 border-t border-border/60"
        >
          <div class="flex items-center justify-between text-[10px] mb-1 font-mono">
            <span class="text-success font-bold">{{ getWhiteWinP(move) }}% W</span>
            <span class="text-neon-purple font-bold">{{ move.drawP }}% D</span>
            <span class="text-danger font-bold">{{ getBlackWinP(move) }}% L</span>
            <span v-if="move.popularity !== null && move.popularity !== undefined" class="text-text-secondary text-[9px] font-normal" :title="move.totalGames ? `${formatGames(move.totalGames)} games` : ''">
              ({{ move.popularity }}%)
            </span>
            <span v-else-if="move.totalGames" class="text-text-secondary text-[9px] font-normal">
              ({{ formatGames(move.totalGames) }} games)
            </span>
          </div>

          <div class="h-1.5 w-full bg-void rounded-full overflow-hidden flex border border-border">
            <div
              class="bg-success h-full transition-all duration-300"
              :style="{ width: `${getWhiteWinP(move)}%` }"
              :title="`White Wins: ${getWhiteWinP(move)}%`"
            />
            <div
              class="bg-neon-purple h-full transition-all duration-300"
              :style="{ width: `${move.drawP}%` }"
              :title="`Draws: ${move.drawP}%`"
            />
            <div
              class="bg-danger h-full transition-all duration-300"
              :style="{ width: `${getBlackWinP(move)}%` }"
              :title="`Black Wins: ${getBlackWinP(move)}%`"
            />
          </div>
        </div>

        <!-- 3. Details & Plan Block -->
        <div class="mt-1 flex flex-col gap-1 text-[11px]">
          <!-- Detailed explanation for selected move -->
          <template v-if="selectedMoveIndex === idx">
            <div v-if="explanationLoading" class="text-text-secondary py-0.5">Analyzing move details…</div>
            <template v-else-if="explanation">
              <div v-if="explanation.summary" class="text-text-primary text-[12px] font-medium leading-snug">
                {{ explanation.summary }}
              </div>
              <div v-if="explanation.details" class="text-text-secondary leading-relaxed">
                {{ explanation.details }}
              </div>
            </template>
          </template>

          <!-- Plan Brief -->
          <div
            v-if="getPlanBrief(move)"
            class="text-[11px] text-text-secondary leading-relaxed"
          >
            <span class="text-text-secondary font-semibold">Plan:</span>
            {{ getPlanBrief(move) }}
          </div>
        </div>

        <!-- 4. Collapsible Continuation Tab (Theoretical Continuations or PV Line) -->
        <div
          v-if="selectedMoveIndex === idx && ((Array.isArray(move.theoreticalContinuations) && move.theoreticalContinuations.length > 0) || (Array.isArray(move.pvLine) && move.pvLine.length > 1))"
          class="mt-2 pt-2 border-t border-border"
        >
          <!-- Top 5 Theoretical Continuations -->
          <template v-if="Array.isArray(move.theoreticalContinuations) && move.theoreticalContinuations.length > 0">
            <div class="text-[9px] uppercase tracking-widest font-bold text-text-secondary mb-1.5 flex items-center justify-between">
              <span>Theoretical Continuations</span>
              <span class="text-[9px] text-text-disabled font-mono font-normal">
                top {{ Math.min(5, move.theoreticalContinuations.length) }}
              </span>
            </div>
            <div class="space-y-1 pl-2 border-l-2 border-warning/40">
              <div
                v-for="(tc, i) in move.theoreticalContinuations.slice(0, 5)"
                :key="i"
                class="text-[11px] flex items-baseline gap-2 leading-tight"
              >
                <span class="font-mono font-bold text-text-primary shrink-0 min-w-[42px]">{{ Number(i) + 1 }}. {{ (tc as any).san }}</span>
                <span class="text-text-secondary flex-1 truncate" :title="String((tc as any).name || '')">
                  <span v-if="(tc as any).eco" class="font-mono text-text-disabled text-[10px] mr-1">[{{ (tc as any).eco }}]</span>
                  <span>{{ (tc as any).name }}</span>
                </span>
                <span v-if="(tc as any).popularity !== null && (tc as any).popularity !== undefined" class="text-[10px] font-mono text-text-secondary shrink-0" :title="(tc as any).total ? `${formatGames(Number((tc as any).total))}` : ''">
                  {{ (tc as any).popularity }}%
                </span>
                <span v-else-if="(tc as any).total" class="text-[10px] font-mono text-text-disabled shrink-0">
                  {{ formatGames(Number((tc as any).total)) }}
                </span>
              </div>
            </div>
          </template>

          <!-- Fallback: PV Line -->
          <template v-else-if="Array.isArray(move.pvLine) && move.pvLine.length > 1">
            <div class="text-[9px] uppercase tracking-widest font-bold text-text-secondary mb-1.5 flex items-center justify-between">
              <span>Continuation / Responses</span>
              <span class="text-[9px] text-text-disabled font-mono font-normal">
                {{ move.pvLine.length - 1 }} moves
              </span>
            </div>
            <div class="space-y-1 pl-2 border-l-2 border-neon-cyan/40">
              <div
                v-for="(p, i) in move.pvLine.slice(1)"
                :key="i"
                class="text-[11px] flex items-baseline gap-2 leading-tight"
              >
                <span class="font-mono font-bold text-text-primary shrink-0 min-w-[52px]">{{ Number(i) + 1 }}. {{ p.san }}</span>
                <span class="text-text-secondary flex-1">{{ p.tagline }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- About Position Summary Section at bottom -->
    <div class="p-3 border-t border-border">
      <AboutPosition :explanation="posExplanation" />
    </div>
  </div>
</template>
