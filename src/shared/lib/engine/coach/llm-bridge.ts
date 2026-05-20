/**
 * llm-bridge.ts
 * Bereitet den massiven ExplanationBlob für das LLM vor (Explicit Whitelisting / DTO).
 * Wir nutzen einen Whitelisting-Ansatz, um maximale Signalstärke bei minimalem Token-Verbrauch zu erreichen.
 */



import type { CoachExplanation, CoachLastMoveAnalysis, CoachBookInfo } from './coach.types';

export function extractLlmPayload(
  blob: CoachExplanation,
  extra?: {
    lastMove?: CoachLastMoveAnalysis;
    consequence?: string | null;
    book?: CoachBookInfo | null;
    userColor?: 'white' | 'black';
    coachHistory?: { fen: string; message: string }[];
  }
) {
  if (!blob) return null;

  const historyLength = extra?.coachHistory?.length || 0;
  const lastCoachMessage = historyLength > 0 ? extra!.coachHistory![historyLength - 1]?.message || null : null;

  return {
    fen: blob.fen,
    side_to_move: blob.side_to_move,
    phase: blob.phase,
    user_color: extra?.userColor || 'white',
    coach_color: extra?.userColor === 'black' ? 'white' : 'black',

    // Past Coach Context for history / conversational context
    last_coach_message: lastCoachMessage,
    coach_history: extra?.coachHistory || [],

    // Engine evaluation and verdict
    eval_cp: blob.eval_cp,
    verdict: blob.verdict,

    // Opening Book Context (Wikibooks / Theoretical theory)
    opening_book: extra?.book ? {
      name: extra.book.name,
      eco: extra.book.eco,
      canonical_path_san: extra.book.canonicalPathSan,
      is_out_of_book: extra.book.isOutOfBook,
      theory_active: !extra.book.isOutOfBook,
      wikibooks_url: extra.book.wikibooksUrl || null,
      wikibooks_content: cleanWikibooksContent(extra.book.wikibooksContent),
      theoretical_continuations: (extra.book.forwardMoves || []).map(m => ({
        san: m.san,
        name: m.name || null
      }))
    } : null,


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

    // Raw engine top moves and principal plan (1:1 from the full explanation blob)
    engine_top_moves: blob.engine_top_moves || [],
    principal_plan: blob.principal_plan || null,

    // Pre-calculated visual commands (arrows, marks)
    visual_commands: blob.visual_commands || null,

    // Narrative summary provided as context for the LLM
    context_summary: blob.summary_text
  };
}

/**
 * Bereinigt HTML-Tags aus dem Wikibooks-Inhalt für das LLM,
 * behält Zeilenumbrüche (\n) bei und schneidet den Text vor dem "Theory table"-Abschnitt ab.
 */
export function cleanWikibooksContent(html: string | null | undefined): string | null {
  if (!html) return null;

  // 1. Robuster Schnitt vor dem "Theory table"-Abschnitt (vor dem öffnenden Tag, z.B. <h2>)
  const cutMarkers = [
    /id\s*=\s*["']Theory_table["']/i,
    /data-mw-anchor\s*=\s*["']Theory_table["']/i,
    /Theory\s+table/i
  ];

  let cutIndex = -1;
  for (const marker of cutMarkers) {
    const match = html.match(marker);
    if (match && match.index !== undefined) {
      const snippetBefore = html.substring(0, match.index);
      const lastTagOpen = snippetBefore.lastIndexOf('<');
      if (lastTagOpen !== -1) {
        const charAfter = snippetBefore.charAt(lastTagOpen + 1);
        if (/[a-zA-Z]/.test(charAfter)) {
          cutIndex = lastTagOpen;
          break;
        }
      }
      cutIndex = match.index;
      break;
    }
  }

  let textToClean = html;
  if (cutIndex !== -1) {
    textToClean = html.substring(0, cutIndex);
  }

  // 2. HTML-Tags entfernen unter Beibehaltung von Zeilenumbrüchen
  let cleaned = textToClean
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h2|h3|h4|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // HTML-Entities dekodieren
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'");

  // 3. Mehrfache aufeinanderfolgende Leerzeichen bereinigen, aber \n erhalten
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim();

  return cleaned || null;
}

