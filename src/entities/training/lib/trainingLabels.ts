import type { TrainingDifficulty, TrainingDiscipline } from '../model/training.types'

type TranslateFn = (key: string) => string
type HasKeyFn = (key: string) => boolean

const DISCIPLINE_I18N_MAP: Readonly<Record<TrainingDiscipline, string>> = {
  tactics: 'features.trainingCenter.disciplines.tactics',
  theoretical_endgames: 'features.trainingCenter.disciplines.theoretical_endgames',
  practical_chess: 'features.trainingCenter.disciplines.practical_chess',
  finishhim: 'features.trainingCenter.disciplines.finishhim',
}

const DIFFICULTY_I18N_MAP: Readonly<Record<TrainingDifficulty, string>> = {
  Novice: 'puzzleCategories.difficulties.level_novice',
  Pro: 'puzzleCategories.difficulties.level_pro',
  Master: 'puzzleCategories.difficulties.level_master',
}

export function resolveDisciplineLabel(discipline: TrainingDiscipline, t: TranslateFn): string {
  return t(DISCIPLINE_I18N_MAP[discipline])
}

export function resolveDifficultyLabel(difficulty: TrainingDifficulty, t: TranslateFn): string {
  return t(DIFFICULTY_I18N_MAP[difficulty])
}

export function resolveScopeLabel(
  group: string,
  key: string,
  t: TranslateFn,
  te?: HasKeyFn,
): string {
  const candidates: string[] = [
    `features.trainingCenter.taxonomy.${group}.${key}`,
    `features.trainingCenter.taxonomy.scopes.${key}`,
    `puzzleCategories.themes.${key}`,
    `puzzleCategories.tactics.${key}`,
    `puzzleCategories.subThemes.${key}`,
    `puzzleCategories.types.${key}`,
  ]

  if (te) {
    for (const candidate of candidates) {
      if (te(candidate)) {
        return t(candidate)
      }
    }
  } else {
    const primary = `features.trainingCenter.taxonomy.scopes.${key}`
    const translated = t(primary)
    if (translated && translated !== primary) {
      return translated
    }
  }

  return key
}

export function formatRemainingDuration(seconds: number, t: TranslateFn): string {
  if (seconds <= 0) {
    return t('features.trainingCenter.course.expired')
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) {
    return `${days}${t('features.trainingCenter.units.dayShort')} ${hours}${t('features.trainingCenter.units.hourShort')}`
  }
  const minutes = Math.max(1, Math.floor((seconds % 3600) / 60))
  return `${hours}${t('features.trainingCenter.units.hourShort')} ${minutes}${t('features.trainingCenter.units.minShort')}`
}

