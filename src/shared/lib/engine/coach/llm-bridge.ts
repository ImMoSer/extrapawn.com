/**
 * llm-bridge.ts
 * Bereitet den massiven ExplanationBlob für das LLM vor (Explicit Whitelisting / DTO).
 * Wir nutzen einen Whitelisting-Ansatz, um maximale Signalstärke bei minimalem Token-Verbrauch zu erreichen.
 */



import type { CoachExplanation, CoachLastMoveAnalysis, CoachBookInfo } from './coach.types';
import { Chess } from 'chess.js';

/**
 * Wandelt einen SAN-Zug in einen wörtlichen TTS-String um.
 * Beispiel: "Kf3" -> "King to f3", "Kxf5" -> "King takes on f5"
 */
export function sanToTts(chess: Chess, san: string): string {
  try {
    // Falls der SAN bereits ein TTS-Feld hat oder kein String ist, abbrechen
    if (!san || typeof san !== 'string') return san;

    // Wir klonen das Board, um den Original-Zustand nicht zu verändern
    // (da wir in extractLlmPayload oft mehrere alternative Züge von derselben FEN aus prüfen)
    const tempChess = new Chess(chess.fen());
    const move = tempChess.move(san);

    if (!move) return san;

    const pieceNames: Record<string, string> = {
      p: 'Pawn',
      n: 'Knight',
      b: 'Bishop',
      r: 'Rook',
      q: 'Queen',
      k: 'King',
    };

    // Sonderfälle: Rochade
    if (move.flags.includes('k')) return 'Kingside castle';
    if (move.flags.includes('q')) return 'Queenside castle';

    const piece = pieceNames[move.piece] || 'Piece';
    const to = move.to;
    let tts = '';

    if (move.flags.includes('c') || move.flags.includes('e')) {
      // Schlagzug (Capture oder En Passant)
      tts = `${piece} takes on ${to}`;
    } else {
      // Normaler Zug
      tts = `${piece} to ${to}`;
    }

    // Promotion
    if (move.flags.includes('p')) {
      const promoPiece = pieceNames[move.promotion || 'q'];
      tts += ` promoting to ${promoPiece}`;
    }

    // Check / Mate
    if (move.san.includes('#')) {
      tts += ' checkmate';
    } else if (move.san.includes('+')) {
      tts += ' check';
    }

    return tts;
  } catch {
    return san;
  }
}

export function extractLlmPayload(
  blob: CoachExplanation,
  extra?: {
    lastMove?: CoachLastMoveAnalysis;
    consequence?: string | null;
    book?: CoachBookInfo | null;
    userColor?: 'white' | 'black';
    coachHistory?: { fen: string; message: string }[];
    session_id?: string;
    question?: string;
    session_puzzle?: Record<string, unknown> | null;
  }
) {
  if (!blob) return null;

  const userColor = extra?.userColor || 'white';
  const rootChess = new Chess(blob.fen);

  return {
    session_id: extra?.session_id || null,
    session_puzzle: extra?.session_puzzle || null,
    question: extra?.question || null,
    fen: blob.fen,
    side_to_move: blob.side_to_move === userColor ? 'user' : 'coach',
    phase: blob.phase,
    user_color: userColor,
    coach_color: userColor === 'black' ? 'white' : 'black',

    // Past Coach Context for history / conversational context
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
      wikibooks_content: !extra.book.isOutOfBook ? cleanWikibooksContent(extra.book.wikibooksContent) : null,
      theoretical_continuations: !extra.book.isOutOfBook ? (extra.book.forwardMoves || []).map(m => ({
        san: m.san,
        tts: sanToTts(rootChess, m.san),
        name: m.name || null
      })) : null
    } : null,


    // Last Move Context (from the previous turn)
    last_move: extra?.lastMove ? {
      san: extra.lastMove.san,
      tts: extra.lastMove.san ? sanToTts(new Chess(extra.lastMove.fen || blob.fen), extra.lastMove.san) : null,
      quality: extra.lastMove.quality?.toUpperCase(),
      win_rate_loss: extra.lastMove.winRateLoss ? `-${extra.lastMove.winRateLoss.toFixed(1)}%` : null,
      summary: extra.lastMove.summary,
      details: extra.lastMove.details,
      consequence: extra.consequence || null,
      best_move_san: extra.lastMove.bestMoveSan,
      best_move_tts: extra.lastMove.bestMoveSan ? sanToTts(new Chess(extra.lastMove.fen || blob.fen), extra.lastMove.bestMoveSan) : null
    } : null,

    // Concrete facts about the position (Material, Structure, King Safety, etc.)
    facts_white: (blob.concrete_facts || [])
      .filter(f => f.side === 'white' || f.side === 'both')
      .map(f => ({ side: f.side, weight: f.importance || 0, text: f.text }))
      .sort((a, b) => b.weight - a.weight),

    facts_black: (blob.concrete_facts || [])
      .filter(f => f.side === 'black' || f.side === 'both')
      .map(f => ({ side: f.side, weight: f.importance || 0, text: f.text }))
      .sort((a, b) => b.weight - a.weight),

    // Themes derived from the engine analysis
    themes_white: (blob.themes || [])
      .filter(t => t.side === 'white' || (t.side as string) === 'both')
      .map(t => ({ id: t.id, side: t.side, weight: t.strength || 0, description: t.description }))
      .sort((a, b) => b.weight - a.weight),

    themes_black: (blob.themes || [])
      .filter(t => t.side === 'black' || (t.side as string) === 'both')
      .map(t => ({ id: t.id, side: t.side, weight: t.strength || 0, description: t.description }))
      .sort((a, b) => b.weight - a.weight),

    // Raw engine top moves and principal plan (1:1 from the full explanation blob)
    engine_top_moves: (blob.engine_top_moves || []).map(m => {
      const moveChess = new Chess(blob.fen);
      const tts = sanToTts(moveChess, m.san);
      try {
        moveChess.move(m.san); // Move ausführen für die PV-Fortsetzung
      } catch {
        // ignore
      }

      return {
        ...m,
        tts,
        pvLine: (m.pvLine || []).map(pv => {
          const pvTts = sanToTts(moveChess, pv.san);
          try {
            moveChess.move(pv.san);
          } catch {
            // ignore
          }
          return { ...pv, tts: pvTts };
        })
      };
    }),

    principal_plan: blob.principal_plan ? (() => {
      const planChess = new Chess(blob.fen);
      const movesWithTts = blob.principal_plan.moves.map(m => {
        const tts = sanToTts(planChess, m.san);
        try {
          planChess.move(m.san); // Update state for next move in sequence
        } catch {
          // ignore
        }
        return { ...m, tts };
      });
      return {
        ...blob.principal_plan,
        moves: movesWithTts,
        tts_string: generateTtsPrincipalPlan(blob.side_to_move, movesWithTts)
      };
    })() : null,

    // Specific domain modules
    tactics: blob.tactics || null,
    endgame: blob.endgame || null,

    // Pre-calculated visual commands (arrows, marks)
    visual_commands: blob.visual_commands || null,

    // Narrative summary provided as context for the LLM
    context_summary: blob.summary_text
  };
}

/**
 * Erzeugt einen narrativen "Halb-fertigen" Plan-String für das LLM.
 * Beispiel: "next move white plays Bishop takes on e3 and Captures the knight, and if ..."
 */
export function generateTtsPrincipalPlan(
  stm: 'white' | 'black',
  moves: { tts?: string; san: string; headline?: string }[]
): string {
  if (!moves || moves.length === 0) return '';

  const sides = [stm, stm === 'white' ? 'black' : 'white'];
  const parts: string[] = [];

  let i = 0;
  for (const m of moves) {
    const side = sides[i % 2];
    const moveTts = m.tts || m.san;
    const headline = m.headline ? ` and ${m.headline}` : '';

    if (i === 0) {
      parts.push(`next move ${side} plays ${moveTts}${headline}`);
    } else if (i === 1) {
      parts.push(`, and if ${side} answer ${moveTts}${headline}`);
    } else if (i === 2) {
      parts.push(`, then ${side} follows with ${moveTts}${headline}`);
    } else if (i === 3) {
      parts.push(` after that ${side} can play ${moveTts}${headline}`);
    } else {
      parts.push(` and ${side} plays ${moveTts}${headline}`);
    }
    i++;
  }

  return parts.join('');
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

