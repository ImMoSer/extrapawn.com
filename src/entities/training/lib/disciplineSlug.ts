import {
  CORE_TRAINING_DISCIPLINES,
  type CoreTrainingDiscipline,
  type TrainingDiscipline,
} from '../model/training.types'

export type DisciplineRouteSlug = 'tactics' | 'theory' | 'practice' | 'finishhim'

export const CORE_DISCIPLINE_TO_SLUG: Readonly<Record<CoreTrainingDiscipline, DisciplineRouteSlug>> =
  {
    tactics: 'tactics',
    theoretical_endgames: 'theory',
    practical_chess: 'practice',
    finishhim: 'finishhim',
  }

export const SLUG_TO_CORE_DISCIPLINE: Readonly<Record<DisciplineRouteSlug, CoreTrainingDiscipline>> =
  {
    tactics: 'tactics',
    theory: 'theoretical_endgames',
    practice: 'practical_chess',
    finishhim: 'finishhim',
  }

export function disciplineToRouteSlug(discipline: TrainingDiscipline): DisciplineRouteSlug {
  if ((CORE_TRAINING_DISCIPLINES as readonly string[]).includes(discipline)) {
    return CORE_DISCIPLINE_TO_SLUG[discipline as CoreTrainingDiscipline]
  }
  return 'tactics'
}

export function routeSlugToDiscipline(slug: string | undefined): CoreTrainingDiscipline | null {
  if (!slug) return null
  const normalized = slug.trim().toLowerCase()
  if (normalized in SLUG_TO_CORE_DISCIPLINE) {
    return SLUG_TO_CORE_DISCIPLINE[normalized as DisciplineRouteSlug]
  }
  return null
}

export function stepDiscipline(
  disciplines: readonly TrainingDiscipline[],
  current: TrainingDiscipline,
  delta: -1 | 1,
): TrainingDiscipline {
  if (disciplines.length === 0) return current
  const idx = disciplines.indexOf(current)
  const baseIdx = idx >= 0 ? idx : 0
  const nextIdx = (baseIdx + delta + disciplines.length) % disciplines.length
  return disciplines[nextIdx] ?? current
}
