import { determineHumanColor, type PuzzleObjective, type PuzzlePuzzle } from '@/entities/game'
import {
  isValidTrainingDifficulty,
  isValidTrainingDiscipline,
  type ChallengeStateDTO,
  type EndgamePuzzleV2,
  type HydratedSessionItem,
  type TacticalPuzzleV2,
  type TrainingDiscipline,
} from '@/entities/training'

export interface WoodpeckerAdapterMeta {
  isWoodpecker: boolean
  woodpeckerStreak: number
}

function assertValidObjective(puzzleId: string, objective: string): PuzzleObjective {
  if (objective === 'win' || objective === 'hold_draw') {
    return objective
  }
  throw new Error(
    `[sessionPuzzleAdapter] Invalid objective "${objective}" on puzzle ${puzzleId}. Fail-Fast!`,
  )
}

function assertValidFirstMove(puzzleId: string, firstMove: string): 'bot' | 'user' {
  if (firstMove === 'bot' || firstMove === 'user') {
    return firstMove
  }
  throw new Error(
    `[sessionPuzzleAdapter] Invalid first_move "${firstMove}" on puzzle ${puzzleId}. Fail-Fast!`,
  )
}

function assertValidUserColor(puzzleId: string, color: string): 'white' | 'black' {
  if (color === 'white' || color === 'black') {
    return color
  }
  throw new Error(
    `[sessionPuzzleAdapter] Invalid user_color "${color}" on puzzle ${puzzleId}. Fail-Fast!`,
  )
}

export function adaptTacticalPuzzleV2(
  tp: TacticalPuzzleV2,
  wpMeta: WoodpeckerAdapterMeta = { isWoodpecker: false, woodpeckerStreak: 0 },
): PuzzlePuzzle {
  if (!tp.puzzle_id || tp.discipline !== 'tactics') {
    throw new Error(
      `[sessionPuzzleAdapter] Expected discipline="tactics" for tactical puzzle "${tp.puzzle_id}". Fail-Fast!`,
    )
  }
  if (!isValidTrainingDifficulty(tp.difficulty)) {
    throw new Error(
      `[sessionPuzzleAdapter] Invalid difficulty "${String(tp.difficulty)}" on tactical puzzle ${tp.puzzle_id}. Fail-Fast!`,
    )
  }
  if (tp.strategy !== 'scenarioOnly') {
    throw new Error(
      `[sessionPuzzleAdapter] Expected strategy="scenarioOnly" on tactical puzzle ${tp.puzzle_id}, got "${String(tp.strategy)}". Fail-Fast!`,
    )
  }
  if (!tp.tactical_fen?.trim() || !tp.tactical_solution?.trim()) {
    throw new Error(
      `[sessionPuzzleAdapter] Missing tactical_fen or tactical_solution on tactical puzzle ${tp.puzzle_id}. Fail-Fast!`,
    )
  }

  const allMotifs = [
    ...(tp.geometry_motifs ?? []),
    ...(tp.operator_motifs ?? []),
    ...(tp.concept_motifs ?? []),
    ...(tp.trigger_motifs ?? []),
  ]

  const primaryCategory = allMotifs[0] ?? tp.cognitive_profile
  if (!primaryCategory) {
    throw new Error(
      `[sessionPuzzleAdapter] Missing motif and cognitive_profile on tactical puzzle ${tp.puzzle_id}. Fail-Fast!`,
    )
  }

  const mapped: PuzzlePuzzle = {
    puzzle_id: tp.puzzle_id,
    puzzle_type: 'tactics',
    category: primaryCategory,
    category_comby: allMotifs,
    motifs_pg: tp.meta_themes ?? [],
    sub_category: tp.phase,
    difficulty: tp.difficulty,
    rating: tp.rating,
    strategy: 'scenarioOnly',
    first_move: assertValidFirstMove(tp.puzzle_id, tp.first_move),
    user_color: assertValidUserColor(tp.puzzle_id, tp.user_color),
    objective: 'win',
    is_woodpecker: wpMeta.isWoodpecker,
    woodpecker_streak: wpMeta.woodpeckerStreak,
    initial_fen: tp.tactical_fen,
    tactical_solution: tp.tactical_solution,
  }

  // Enforce FEN + first_move + user_color invariant immediately upon adaptation
  determineHumanColor(mapped)
  return mapped
}

export function adaptEndgamePuzzleV2(
  ep: EndgamePuzzleV2,
  wpMeta: WoodpeckerAdapterMeta = { isWoodpecker: false, woodpeckerStreak: 0 },
): PuzzlePuzzle {
  const rawDiscipline: string = ep.discipline
  if (!ep.puzzle_id || !isValidTrainingDiscipline(rawDiscipline) || rawDiscipline === 'tactics') {
    throw new Error(
      `[sessionPuzzleAdapter] Invalid endgame discipline "${rawDiscipline}" on puzzle "${ep.puzzle_id}". Fail-Fast!`,
    )
  }
  if (!isValidTrainingDifficulty(ep.difficulty)) {
    throw new Error(
      `[sessionPuzzleAdapter] Invalid difficulty "${String(ep.difficulty)}" on endgame puzzle ${ep.puzzle_id}. Fail-Fast!`,
    )
  }
  if (!ep.ending_fen?.trim()) {
    throw new Error(
      `[sessionPuzzleAdapter] Missing ending_fen on endgame puzzle ${ep.puzzle_id}. Fail-Fast!`,
    )
  }
  if (!ep.domain?.trim() || !ep.class?.trim()) {
    throw new Error(
      `[sessionPuzzleAdapter] Missing domain or class on endgame puzzle ${ep.puzzle_id}. Fail-Fast!`,
    )
  }
  if (ep.discipline === 'theoretical_endgames' && ep.domain === 'EXTRA') {
    throw new Error(
      `[sessionPuzzleAdapter] Forbidden EXTRA domain encountered in theoretical_endgames puzzle ${ep.puzzle_id} ([D9]). Fail-Fast!`,
    )
  }

  const objective = assertValidObjective(ep.puzzle_id, ep.objective)
  const firstMove = assertValidFirstMove(ep.puzzle_id, ep.first_move)
  const userColor = assertValidUserColor(ep.puzzle_id, ep.user_color)

  if (ep.discipline === 'finishhim') {
    if (ep.strategy !== 'scenarioPlus') {
      throw new Error(
        `[sessionPuzzleAdapter] Expected strategy="scenarioPlus" on finishhim puzzle ${ep.puzzle_id}, got "${String(ep.strategy)}". Fail-Fast!`,
      )
    }
    if (!ep.tactical_fen?.trim() || !ep.tactical_solution?.trim()) {
      throw new Error(
        `[sessionPuzzleAdapter] Missing tactical_fen or tactical_solution on finishhim puzzle ${ep.puzzle_id}. Fail-Fast!`,
      )
    }

    const mapped: PuzzlePuzzle = {
      puzzle_id: ep.puzzle_id,
      puzzle_type: 'finishhim',
      category: ep.class,
      motifs_pg: ep.meta_themes ?? [],
      sub_category: ep.domain,
      domain: ep.domain,
      difficulty: ep.difficulty,
      rating: ep.effective_rating,
      strategy: 'scenarioPlus',
      first_move: firstMove,
      user_color: userColor,
      objective,
      is_woodpecker: wpMeta.isWoodpecker,
      woodpecker_streak: wpMeta.woodpeckerStreak,
      initial_fen: ep.tactical_fen,
      tactical_solution: ep.tactical_solution,
      puzzle_fen: ep.ending_fen,
    }

    determineHumanColor(mapped)
    return mapped
  }

  // practical_chess or theoretical_endgames
  if (ep.strategy !== 'playOutOnly') {
    throw new Error(
      `[sessionPuzzleAdapter] Expected strategy="playOutOnly" on ${ep.discipline} puzzle ${ep.puzzle_id}, got "${String(ep.strategy)}". Fail-Fast!`,
    )
  }

  const mapped: PuzzlePuzzle = {
    puzzle_id: ep.puzzle_id,
    puzzle_type: ep.discipline,
    category: ep.class,
    sub_category: ep.domain,
    domain: ep.domain,
    difficulty: ep.difficulty,
    rating: ep.effective_rating,
    strategy: 'playOutOnly',
    first_move: firstMove,
    user_color: userColor,
    objective,
    is_woodpecker: wpMeta.isWoodpecker,
    woodpecker_streak: wpMeta.woodpeckerStreak,
    initial_fen: ep.ending_fen,
    puzzle_fen: ep.ending_fen,
  }

  determineHumanColor(mapped)
  return mapped
}

export function adaptSessionItemToPuzzle(
  discipline: TrainingDiscipline,
  item: HydratedSessionItem,
): PuzzlePuzzle {
  if (!isValidTrainingDiscipline(discipline)) {
    throw new Error(
      `[sessionPuzzleAdapter] Invalid session discipline "${String(discipline)}". Fail-Fast!`,
    )
  }
  if (!item.puzzle_id?.trim()) {
    throw new Error(
      `[sessionPuzzleAdapter] Session item at index ${String(item.index)} has empty puzzle_id. Fail-Fast!`,
    )
  }

  const wpMeta: WoodpeckerAdapterMeta = {
    isWoodpecker: item.is_woodpecker,
    woodpeckerStreak: item.woodpecker_streak,
  }

  if (discipline === 'tactics') {
    if (!item.tactical) {
      throw new Error(
        `[sessionPuzzleAdapter] Missing hydrated tactical payload for puzzle ${item.puzzle_id}. Fail-Fast!`,
      )
    }
    if (item.tactical.puzzle_id !== item.puzzle_id) {
      throw new Error(
        `[sessionPuzzleAdapter] Hydrated tactical puzzle_id mismatch: item="${item.puzzle_id}" vs payload="${item.tactical.puzzle_id}". Fail-Fast!`,
      )
    }
    return adaptTacticalPuzzleV2(item.tactical, wpMeta)
  }

  if (!item.endgame) {
    throw new Error(
      `[sessionPuzzleAdapter] Missing hydrated endgame payload for ${discipline} puzzle ${item.puzzle_id}. Fail-Fast!`,
    )
  }
  if (item.endgame.puzzle_id !== item.puzzle_id) {
    throw new Error(
      `[sessionPuzzleAdapter] Hydrated endgame puzzle_id mismatch: item="${item.puzzle_id}" vs payload="${item.endgame.puzzle_id}". Fail-Fast!`,
    )
  }
  if (item.endgame.discipline !== discipline) {
    throw new Error(
      `[sessionPuzzleAdapter] Hydrated endgame discipline mismatch: session="${discipline}" vs payload="${item.endgame.discipline}". Fail-Fast!`,
    )
  }

  return adaptEndgamePuzzleV2(item.endgame, wpMeta)
}

export function adaptChallengeStateToPuzzle(state: ChallengeStateDTO): PuzzlePuzzle {
  if (!isValidTrainingDiscipline(state.discipline)) {
    throw new Error(
      `[sessionPuzzleAdapter] Invalid challenge discipline "${String(state.discipline)}". Fail-Fast!`,
    )
  }
  if (!state.puzzle_id?.trim()) {
    throw new Error('[sessionPuzzleAdapter] Challenge state has empty puzzle_id. Fail-Fast!')
  }

  const wpMeta: WoodpeckerAdapterMeta = {
    isWoodpecker: false,
    woodpeckerStreak: 0,
  }

  if (state.discipline === 'tactics') {
    if (!state.tactical) {
      throw new Error(
        `[sessionPuzzleAdapter] Missing tactical payload for challenge ${state.puzzle_id}. Fail-Fast!`,
      )
    }
    return adaptTacticalPuzzleV2(state.tactical, wpMeta)
  }

  if (!state.endgame) {
    throw new Error(
      `[sessionPuzzleAdapter] Missing endgame payload for ${state.discipline} challenge ${state.puzzle_id}. Fail-Fast!`,
    )
  }
  return adaptEndgamePuzzleV2(state.endgame, wpMeta)
}


