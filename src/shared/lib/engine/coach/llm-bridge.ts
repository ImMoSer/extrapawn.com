/**
 * llm-bridge.ts
 * Bereitet den massiven ExplanationBlob für das LLM vor (Explicit Whitelisting / DTO).
 * Wir nutzen einen Whitelisting-Ansatz, um maximale Signalstärke bei minimalem Token-Verbrauch zu erreichen.
 */

export function extractLlmPayload(blob: any) {
  if (!blob) return null;

  // Wir nehmen nur die aggregierten, aussagekräftigen Felder.
  // Keine rekursive Löschung, kein Raten. Ein klarer Vertrag (Data Transfer Object).
  return {
    fen: blob.fen,
    side_to_move: blob.side_to_move,
    phase: blob.phase,
    
    // Die absolute Wahrheit der Engine
    eval_cp: blob.eval_cp,
    verdict: blob.verdict,

    // Material-Differenz reicht als Zahl, das LLM braucht nicht die genaue Bauern-Zählung, 
    // wenn es den FEN-String hat und die Delta-Zahl kennt.
    material_delta: blob.material?.material_delta_cp,

    // Themes sind Gold wert. Sie destillieren die komplette Taktik und Struktur.
    // Wir nehmen nur die Beschreibungen, um Tokens zu sparen.
    themes: (blob.themes || []).map((t: any) => t.description),

    // Der Engine-Plan, gekürzt auf das Wesentliche
    principal_plan: blob.principal_plan ? {
      description: blob.principal_plan.description,
      moves: (blob.principal_plan.moves || []).map((m: any) => m.san).join(' '),
      zwischenzug: blob.principal_plan.zwischenzug?.description || null,
      best_move_explanation: blob.engine_top_moves?.[0] ? {
        san: blob.engine_top_moves[0].san,
        character: blob.engine_top_moves[0].character,
        character_reason: blob.engine_top_moves[0].character_reason,
        headline: blob.engine_top_moves[0].headline,
        plan_brief: blob.engine_top_moves[0].plan_brief
      } : null
    } : null,

    // Vorgefertigte visuelle Marker (Pfeile, Highlights), die das LLM in seine Erklärung einbauen soll
    visual_commands: blob.visual_commands || null,

    // Nur die Top 2 Alternativen, falls der User vom Hauptplan abweicht
    top_alternatives: (blob.engine_top_moves || [])
      .slice(1, 3)
      .map((m: any) => `${m.san} (${m.plan_brief})`),

    // Der vorgefertigte Text gibt dem LLM den perfekten Rahmen
    context_summary: blob.summary_text
  };
}
