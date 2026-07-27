/* tslint:disable */
/* eslint-disable */

/**
 * Analyze one move from a starting FEN.
 *
 * Returns a JSON object describing every motif that fires, suitable for
 * JS-side composition. On any parsing error returns `{ error: "..." }`.
 */
export function analyze(fen_before: string, uci: string): any;

/**
 * Analyze a sequence of UCI moves starting from a FEN.
 *
 * Same shape as `analyze`, but returns an array of results — one per ply.
 */
export function analyze_pv(start_fen: string, ucis: any[], plies: number): any;

/**
 * Static evaluation of a position. Returns the same `Eval` struct as the
 * internal evaluator: phase, per-side breakdown, final centipawn score.
 *
 * Use this to attribute "why is this position +0.7?" to specific terms
 * (material, psqt, mobility, pawns, king_safety, threats, imbalance).
 */
export function evaluate_fen(fen: string): any;

/**
 * Comprehensive structured explanation of why one side has the
 * advantage. Returns the full `Explanation` blob — material, pawn
 * structure, king safety, activity, line control, immediate tactics,
 * and high-level themes — designed for downstream LLM consumption.
 */
export function explain_position(fen: string): any;

/**
 * Per-piece contribution to the static evaluation. Returns one entry per
 * non-king piece on the board: `value_cp` (side-relative), plus the
 * breakdown by head (material / psqt / mobility / pawns / king_safety /
 * threats / imbalance). This is what the heatmap renders.
 */
export function piece_contributions(fen: string): any;

/**
 * Single-piece contribution at a square. Convenience for hover tooltips
 * that don't need the full board scan.
 */
export function piece_value_at(fen: string, square: string): any;

/**
 * Quick smoke-test export so JS can confirm the WASM binding is alive.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly analyze: (a: number, b: number, c: number, d: number) => number;
    readonly analyze_pv: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly evaluate_fen: (a: number, b: number) => number;
    readonly explain_position: (a: number, b: number) => number;
    readonly piece_contributions: (a: number, b: number) => number;
    readonly piece_value_at: (a: number, b: number, c: number, d: number) => number;
    readonly version: (a: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
