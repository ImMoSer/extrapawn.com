<template>
  <div class="coach-sidebar">
    <div class="sidebar-header">
      <h3 class="sidebar-title">Chess Coach</h3>
      <div class="header-actions">
        <CoachSettings @change="onSettingsChange" />
        <button
          class="toggle-btn"
          :class="{ active: coachStore.isCoachEnabled }"
          @click="coachStore.toggleCoach"
        >
          <n-icon size="16"><PowerOutline /></n-icon>
        </button>
      </div>
    </div>

    <div v-if="!coachStore.isCoachEnabled" class="coach-disabled">
      <p>The coach is sleeping. Turn it on to get real-time feedback and analysis.</p>
    </div>

    <div v-else-if="coachStore.isAnalyzing" class="coach-loading">
      <div class="spinner"></div>
      <p>Analyzing position...</p>
    </div>

    <div v-else-if="explanation" class="coach-content">
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
        <ul v-if="remainingFacts > 0" class="facts-list">
          <li
            v-for="(fact, i) in allFacts.slice(visibleFacts.length)"
            :key="i"
            class="fact-item muted"
          >
            <span class="fact-cue" :style="{ backgroundColor: getCueColor(fact.side) }"></span>
            <span class="fact-text">{{ fact.text }}</span>
          </li>
        </ul>

        <div v-if="plan?.moves?.length > 0" class="expanded-section">
          <div class="section-title">
            Engine plan{{ plan.depth ? ` · depth ${plan.depth}` : '' }}
          </div>
          <div class="plan-san">
            {{ plan.moves.map((m: { san: string }) => m.san).join('  ') }}          </div>
          <div v-if="plan.description" class="plan-desc-muted">{{ plan.description }}</div>
        </div>

        <div v-if="explanation.summary_text" class="expanded-section">
          <div class="summary-header">
            <div class="section-title" style="margin-bottom: 0">Full summary</div>
            <button
              class="copy-btn"
              @click="copyJson"
              title="Copy the full structured explanation as JSON"
            >
              Copy JSON
            </button>
          </div>
          <div class="narrative-text thin-scroll">
            {{ explanation.summary_text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PowerOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useCoachStore } from '../model/coach.store'
import CoachSettings from './CoachSettings.vue'

const coachStore = useCoachStore()
const expanded = ref(false)

const explanation = computed<any>(() => coachStore.currentExplanation)

const onSettingsChange = () => {
  if (coachStore.isCoachEnabled) {
    // Retrigger analysis with new settings
    coachStore.setCoachEnabled(false)
    setTimeout(() => coachStore.setCoachEnabled(true), 50)
  }
}

// ── Verdict formatting ──
const verdictData = computed<any>(() => {
  const blob = explanation.value as any
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

// ── Facts extraction (Ported from AboutPosition.jsx) ──
const allFacts = computed<any[]>(() => {
  const blob = explanation.value
  if (!blob) return []
  const facts: any[] = []

  // Material
  const mat = blob.material || {}
  if (mat.bishop_pair_white && !mat.bishop_pair_black)
    facts.push({ side: 'white', importance: 60, text: 'White has the bishop pair' })
  if (mat.bishop_pair_black && !mat.bishop_pair_white)
    facts.push({ side: 'black', importance: 60, text: 'Black has the bishop pair' })
  if (mat.opposite_color_bishops)
    facts.push({ side: 'both', importance: 50, text: 'Opposite-coloured bishops on the board' })
  if (Math.abs(mat.material_delta_cp || 0) >= 100) {
    const pawns = (Math.abs(mat.material_delta_cp) / 100).toFixed(1)
    const side = mat.material_delta_cp > 0 ? 'White' : 'Black'
    facts.push({
      side: side.toLowerCase(),
      importance: Math.min(95, 60 + Math.round(Math.abs(mat.material_delta_cp) / 50)),
      text: `${side} is up ${pawns} ${pawns === '1.0' ? 'pawn' : 'pawns'} of material`,
    })
  }

  // Pawn structure
  const ps = blob.pawn_structure || {}
  if (ps.iqp_white)
    facts.push({ side: 'black', importance: 55, text: 'White has an isolated d-pawn (IQP)' })
  if (ps.iqp_black)
    facts.push({ side: 'white', importance: 55, text: 'Black has an isolated d-pawn (IQP)' })
  if (ps.hanging_pawns_white)
    facts.push({
      side: 'black',
      importance: 50,
      text: 'White has hanging pawns (no flank support)',
    })
  if (ps.hanging_pawns_black)
    facts.push({
      side: 'white',
      importance: 50,
      text: 'Black has hanging pawns (no flank support)',
    })
  if (ps.light_complex_weak)
    facts.push({
      side: ps.light_complex_weak === 'white' ? 'black' : 'white',
      importance: 65,
      text: `${capitalize(ps.light_complex_weak)}'s light squares are weak`,
    })
  if (ps.dark_complex_weak)
    facts.push({
      side: ps.dark_complex_weak === 'white' ? 'black' : 'white',
      importance: 65,
      text: `${capitalize(ps.dark_complex_weak)}'s dark squares are weak`,
    })
  for (const sq of ps.white?.passed || [])
    facts.push({ side: 'white', importance: 70, text: `White has a passed pawn on ${sq}` })
  for (const sq of ps.black?.passed || [])
    facts.push({ side: 'black', importance: 70, text: `Black has a passed pawn on ${sq}` })
  for (const sq of ps.white?.isolated || [])
    facts.push({ side: 'black', importance: 35, text: `White's pawn on ${sq} is isolated` })
  for (const sq of ps.black?.isolated || [])
    facts.push({ side: 'white', importance: 35, text: `Black's pawn on ${sq} is isolated` })
  for (const sq of ps.white?.backward || [])
    facts.push({ side: 'black', importance: 35, text: `White's pawn on ${sq} is backward` })
  for (const sq of ps.black?.backward || [])
    facts.push({ side: 'white', importance: 35, text: `Black's pawn on ${sq} is backward` })

  // Activity
  const act = blob.activity || {}
  for (const o of act.white?.outposts || [])
    facts.push({
      side: 'white',
      importance: 55,
      text: `White's ${o.piece} on ${o.square} is an outpost`,
    })
  for (const o of act.black?.outposts || [])
    facts.push({
      side: 'black',
      importance: 55,
      text: `Black's ${o.piece} on ${o.square} is an outpost`,
    })
  if (act.white?.bad_bishop)
    facts.push({
      side: 'black',
      importance: 40,
      text: `White's bishop on ${act.white.bad_bishop} is hemmed in by its own pawns`,
    })
  if (act.black?.bad_bishop)
    facts.push({
      side: 'white',
      importance: 40,
      text: `Black's bishop on ${act.black.bad_bishop} is hemmed in by its own pawns`,
    })
  for (const d of act.white?.long_diagonals_controlled || [])
    facts.push({ side: 'white', importance: 45, text: `White controls the long ${d} diagonal` })
  for (const d of act.black?.long_diagonals_controlled || [])
    facts.push({ side: 'black', importance: 45, text: `Black controls the long ${d} diagonal` })

  const mw = act.white?.total_mobility || 0
  const mb = act.black?.total_mobility || 0
  if (Math.abs(mw - mb) >= 10) {
    const side = mw > mb ? 'White' : 'Black'
    facts.push({
      side: side.toLowerCase(),
      importance: 35,
      text: `${side}'s pieces have ${Math.max(mw, mb) - Math.min(mw, mb)} more squares of mobility`,
    })
  }
  const sw = act.white?.squares_in_enemy_half || 0
  const sb = act.black?.squares_in_enemy_half || 0
  if (Math.abs(sw - sb) >= 8) {
    const side = sw > sb ? 'White' : 'Black'
    facts.push({
      side: side.toLowerCase(),
      importance: 35,
      text: `${side} controls more space in the enemy half`,
    })
  }

  // Line control
  const lc = blob.line_control || {}
  for (const f of lc.open_files || []) {
    if (f.controlling_side)
      facts.push({
        side: f.controlling_side,
        importance: 50,
        text: `${capitalize(f.controlling_side)} controls the open ${f.file}-file`,
      })
  }
  if (
    lc.long_diagonal_a1h8 &&
    !act.white?.long_diagonals_controlled?.includes('a1-h8') &&
    !act.black?.long_diagonals_controlled?.includes('a1-h8')
  ) {
    facts.push({
      side: lc.long_diagonal_a1h8,
      importance: 40,
      text: `${capitalize(lc.long_diagonal_a1h8)} eyes the long a1-h8 diagonal`,
    })
  }
  if (
    lc.long_diagonal_h1a8 &&
    !act.white?.long_diagonals_controlled?.includes('h1-a8') &&
    !act.black?.long_diagonals_controlled?.includes('h1-a8')
  ) {
    facts.push({
      side: lc.long_diagonal_h1a8,
      importance: 40,
      text: `${capitalize(lc.long_diagonal_h1a8)} eyes the long h1-a8 diagonal`,
    })
  }
  if (lc.seventh_rank_dominant) {
    const rank = lc.seventh_rank_dominant === 'white' ? '7th' : '2nd'
    facts.push({
      side: lc.seventh_rank_dominant,
      importance: 60,
      text: `${capitalize(lc.seventh_rank_dominant)} has rook(s) on the ${rank} rank — pigs on the ${rank}`,
    })
  }

  // King safety
  const ks = blob.king_safety || {}
  for (const f of ks.white?.open_files_to_king || [])
    facts.push({ side: 'black', importance: 60, text: `White's king is exposed on the ${f}-file` })
  for (const f of ks.black?.open_files_to_king || [])
    facts.push({ side: 'white', importance: 60, text: `Black's king is exposed on the ${f}-file` })
  if ((ks.white?.attacker_count || 0) >= 3)
    facts.push({
      side: 'black',
      importance: 70,
      text: `White's king is under attack — ${ks.white.attacker_count} enemy pieces in the king zone`,
    })
  if ((ks.black?.attacker_count || 0) >= 3)
    facts.push({
      side: 'white',
      importance: 70,
      text: `Black's king is under attack — ${ks.black.attacker_count} enemy pieces in the king zone`,
    })

  const eap = ks.engine_attack_potential
  if (eap && eap.ratio >= 0.5) {
    facts.push({
      side: eap.attacking_side,
      importance: 75,
      text: `${capitalize(eap.attacking_side)} has strong attacking chances — ${eap.moves_targeting_king} of the engine's top ${eap.total_moves} moves target the enemy king`,
    })
  }

  // Tactics
  const tac = blob.tactics || {}
  for (const h of tac.hanging_white || [])
    facts.push({
      side: 'black',
      importance: 90,
      text: `White's ${h.role} on ${h.square} is hanging`,
    })
  for (const h of tac.hanging_black || [])
    facts.push({
      side: 'white',
      importance: 90,
      text: `Black's ${h.role} on ${h.square} is hanging`,
    })
  for (const p of tac.pinned_pieces || [])
    facts.push({
      side: 'both',
      importance: 60,
      text: `${p.role} on ${p.square} is pinned${p.absolute ? ' to the king' : ''}`,
    })

  // Endgame concepts
  const eg = (blob.endgame || {}) as any
  if (eg.opposition)
    facts.push({ side: eg.opposition.holder, importance: 88, text: eg.opposition.description })
  for (const k of eg.key_squares || []) {
    if (k.controlled_by === k.pawn_color) {
      facts.push({
        side: k.pawn_color,
        importance: 92,
        text: `${capitalize(k.pawn_color)}'s king occupies a key square for the ${k.pawn_square} pawn — winning K+P ending`,
      })
    } else if (k.controlled_by) {
      facts.push({
        side: k.controlled_by,
        importance: 80,
        text: `${capitalize(k.controlled_by)}'s king holds a key square against the ${k.pawn_square} pawn — denies the win`,
      })
    } else if ((eg.key_squares || []).length === 1) {
      facts.push({
        side: k.pawn_color,
        importance: 65,
        text: `Key squares for the ${k.pawn_square} pawn: ${k.key_squares.join(', ')} — reach one to win`,
      })
    }
  }
  for (const sp of eg.square_of_pawn || []) {
    if (!sp.defender_in_square)
      facts.push({
        side: sp.pawn_color,
        importance: 95,
        text: `The ${sp.pawn_square} pawn races free — defender's king is outside the square of the pawn`,
      })
  }

  const seen = new Set()
  return facts
    .sort((a, b) => b.importance - a.importance)
    .filter((f) => {
      if (seen.has(f.text)) return false
      seen.add(f.text)
      return true
    })
})

const FACT_COUNT_DEFAULT = 3
const FACT_IMPORTANCE_MIN = 60

const decisiveFacts = computed<any[]>(() =>
  allFacts.value.filter((f) => f.importance >= FACT_IMPORTANCE_MIN),
)
const visibleFacts = computed<any[]>(() => decisiveFacts.value.slice(0, FACT_COUNT_DEFAULT))
const remainingFacts = computed<number>(() => allFacts.value.length - visibleFacts.value.length)

const plan = computed<any>(() => explanation.value?.principal_plan)
const hasPlan = computed<boolean>(
  () => plan.value && Array.isArray(plan.value.moves) && plan.value.moves.length >= 2,
)

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const getCueColor = (side: string) => {
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
.coach-sidebar {
  border-bottom: 1px solid #27272a;
  padding: 12px 14px;
  background-color: var(--glass-bg, #0b0d17);
  border-radius: 8px;
  color: #d4d4d8;
  font-family: 'Ubuntu', sans-serif;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  padding: 7px;
  border-radius: 6px;
  background-color: #1f1f23;
  color: #a1a1aa;
  border: 1px solid #27272a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background-color: rgba(0, 242, 255, 0.15);
  color: #00f2ff;
  border-color: rgba(0, 242, 255, 0.4);
}

.coach-disabled,
.coach-loading {
  font-size: 12px;
  color: #a1a1aa;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 242, 255, 0.2);
  border-top: 2px solid #00f2ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
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
