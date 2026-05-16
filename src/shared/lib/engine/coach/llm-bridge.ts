/**
 * llm-bridge.ts
 * Bereitet den massiven ExplanationBlob für das LLM vor (Explicit Whitelisting / DTO).
 * Wir nutzen einen Whitelisting-Ansatz, um maximale Signalstärke bei minimalem Token-Verbrauch zu erreichen.
 */

const formatScore = (cp: number) => {
  const v = cp / 100;
  return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
};

const QUALITY_LABEL: Record<string, string> = {
  brilliant: 'BRILLIANT',
  great: 'GREAT',
  best: 'BEST',
  excellent: 'EXCELLENT',
  good: 'GOOD',
  neutral: 'NEUTRAL',
  inaccuracy: 'INACCURACY',
  mistake: 'MISTAKE',
  blunder: 'BLUNDER',
  missed_mate: 'MISSED MATE',
};

import type { CoachExplanation, CoachLastMoveAnalysis } from './coach.types'

export function extractLlmPayload(blob: CoachExplanation, extra?: { lastMove?: CoachLastMoveAnalysis, consequence?: string | null }) {
  if (!blob) return null;

  return {
    fen: blob.fen,
    side_to_move: blob.side_to_move,
    phase: blob.phase,
    
    // Engine evaluation and verdict
    eval_cp: blob.eval_cp,
    verdict: blob.verdict,

    // Last Move Context (from the previous turn)
    last_move: extra?.lastMove ? {
      san: extra.lastMove.san,
      quality: extra.lastMove.quality?.toUpperCase(),
      win_rate_loss: extra.lastMove.winRateLoss ? `-${extra.lastMove.winRateLoss.toFixed(1)}%` : null,
      summary: extra.lastMove.summary,
      details: extra.lastMove.details,
      consequence: extra.consequence || null,
      best_move_san: extra.lastMove.bestMoveSan
    } : null,

    // Concrete facts about the position (Material, Structure, King Safety, etc.)
    concrete_facts: (blob.concrete_facts || []).map((f: { text: string }) => f.text),

    // Themes derived from the engine analysis
    themes: (blob.themes || []).map((t: { description: string }) => t.description),

    // Detailed Next Move Alternatives (Top 3)
    // Bringing 1-to-1 the texts seen in the UI (Taglines, Plans, Qualities, Evaluations)
    top_moves: (blob.engine_top_moves || [])
      .slice(0, 3)
      .map((m, idx: number) => ({
        rank: idx + 1,
        san: m.san,
        evaluation: formatScore(m.score),
        quality_label: QUALITY_LABEL[m.explanation?.quality] || m.character?.toUpperCase() || 'QUIET',
        win_rate_loss: m.explanation?.winRateLoss ? `-${m.explanation.winRateLoss.toFixed(1)}%` : null,
        tagline: m.tagline || m.headline,
        plan_brief: m.plan_brief,
        explanation_summary: m.explanation?.summary,
        explanation_details: m.explanation?.details,
        best_move_if_not_this: !m.explanation?.is_best_move ? m.explanation?.best_move_san : null,
        pv: m.plan_pv?.join(' ')
      })),



    // The Engine's Principal Plan
    principal_plan: blob.principal_plan ? {
      description: blob.principal_plan.description,
      moves: (blob.principal_plan.moves || []).map((m: { san: string }) => m.san).join(' '),
      zwischenzug: blob.principal_plan.zwischenzug?.description || null
    } : null,

    // Pre-calculated visual commands (arrows, marks)
    visual_commands: blob.visual_commands || null,

    // Narrative summary provided as context for the LLM
    context_summary: blob.summary_text
  };
}

