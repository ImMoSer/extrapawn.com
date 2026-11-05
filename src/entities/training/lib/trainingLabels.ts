import type { TrainingDifficulty, TrainingDiscipline } from '../model/training.types'

type TranslateFn = (key: string) => string
type HasKeyFn = (key: string) => boolean

const DISCIPLINE_I18N_MAP: Readonly<Record<TrainingDiscipline, string>> = {
  tactics: 'features.trainingCenter.disciplines.tactics',
  tactics_course: 'features.trainingCenter.disciplines.tactics_course',
  theoretical_endgames: 'features.trainingCenter.disciplines.theoretical_endgames',
  practical_chess: 'features.trainingCenter.disciplines.practical_chess',
  finishhim: 'features.trainingCenter.disciplines.finishhim',
}

const CLASSICAL_COURSE_SCOPE_FALLBACKS: Readonly<Record<string, string>> = {
  // 9 Chess-Essence Domains of tactics_course
  MATING_ATTACK: 'Матовая атака и матовые сети',
  MATERIAL_GAIN: 'Выигрыш материала и ловля фигур',
  SACRIFICES: 'Тематические жертвы',
  TACTICAL_GEOMETRY: 'Тактическая геометрия и линейные удары',
  COMBINATIONAL_MOTIFS: 'Классические комбинационные мотивы',
  STRATEGIC_TACTICS: 'Стратегическая тактика (структура, поля, линии, защита, темп)',
  BLOCKADE_AND_FORTRESS: 'Блокада, ограничение подвижности и крепости',
  SAVING_DRAW: 'Активная защита: пат и вечный шах',
  EXAMS: 'Экзамены вслепую («Как бы вы сыграли?»)',
  // Legacy domain keys
  MATING_AND_SACRIFICES: 'Матовая атака и жертвы',
  DIRECT_STRIKES: 'Прямые тактические удары',
  COMBINATIONAL_IDEAS: 'Комбинационные идеи',

  // 22 Classes of tactics_course
  matingByPiece: 'Матующая фигура и взаимодействие',
  matingNetsAndForcedMate: 'Матовая сеть и форсированный мат',
  materialGainBasic: 'Базовая тактика выигрыша фигуры',
  materialGainAdvanced: 'Многоходовый выигрыш и ловля фигур',
  queenSacrifice: 'Жертва ферзя',
  rookAndMinorSacrifice: 'Жертва ладьи и лёгких фигур',
  doubleAttack: 'Двойной удар и одновременное нападение',
  pinGeometry: 'Связка (абсолютная, относительная, перекрёстная)',
  discoveredAndDoubleCheck: 'Вскрытое нападение, двойной шах и мельница',
  lineAttackAndXRay: 'Линейный удар, рентген и засада',
  attractionMotif: 'Завлечение',
  deflectionMotif: 'Отвлечение',
  interferenceMotif: 'Перекрытие',
  pawnStructureDemolition: 'Разрушение пешечной структуры',
  criticalSquaresAndInvasion: 'Критические поля, вторжение и прорыв пешки',
  lineAndSquareOpening: 'Открытие и освобождение линий и полей',
  destroyingDefense: 'Устранение и уничтожение защиты',
  tempoInitiativeAndZugzwang: 'Борьба за темп, угроза и цугцванг',
  activeBlockadeAndRestriction: 'Атакующая блокада и ограничение подвижности',
  fortressAndPositionalDraw: 'Крепости, патовая блокада и позиционная ничья',
  stalemateAndMadPiece: 'Спасение патом и «Бешеная фигура»',
  perpetualCheckAndPursuit: 'Вечный шах и вечное преследование',
  examTacticalTest: 'Практикум («Как бы вы сыграли?»)',
  examDirectStrike: 'Рубежный экзамен (Прямой удар и геометрия)',
  examMidterm: 'Промежуточный экзамен (Комбинации и стратегия)',
  examFinal: 'Выпускной экзамен (Комплексная тактика)',

  // Legacy class keys
  matingAttack: 'Матовая атака (Мат в 1–4+ хода)',
  sacrificesAndDoubleCheck: 'Типичные жертвы и Двойной шах',
  pinAndDoubleAttack: 'Связка и Двойной удар (Вилка)',
  discoveredAndLineAttack: 'Открытое нападение и Линейный удар',
  tempoAndZugzwang: 'Выигрыш темпа и Цугцванг',
  openingTrapsAndThreats: 'Дебютные катастрофы и Создание угроз',
  deflection: 'Отвлечение',
  attraction: 'Завлечение',
  destroyingAndBlockade: 'Уничтожение защиты и Блокада',
  interferenceAndClearance: 'Перекрытие и Освобождение поля',
  lineOpening: 'Освобождение и открытие линий',
  perpetualAndFortress: 'Вечный шах и Позиционная крепость',
  // SubClasses of tactics_course
  mateIn1: 'Мат в 1 ход',
  mateIn2: 'Мат в 2 хода',
  mateIn3: 'Мат в 3 хода',
  mateIn4Plus: 'Форсированный мат в 4+ хода',
  typicalSacrifices: 'Типичные жертвы',
  doubleCheck: 'Двойной шах',
  winMajorPiece: 'Выигрыш ферзя или ладьи',
  winMinorPiece: 'Выигрыш лёгкой фигуры',
  exchangeAndTrapped: 'Выигрыш качества и ловля фигуры',
  pin: 'Связка и полусвязка',
  doubleAttack: 'Двойной удар и вилка',
  discoveredAttack: 'Открытое нападение',
  discoveredCheck: 'Открытый шах',
  lineAndXRayAttack: 'Линейный удар и рентген',
  tempoGain: 'Выигрыш темпа (промежуточный ход)',
  zugzwang: 'Цугцванг',
  openingTraps: 'Дебютные ловушки',
  creatingThreats: 'Создание неотразимых угроз',
  destroyingGuard: 'Уничтожение защиты',
  blockade: 'Блокада',
  interference: 'Перекрытие',
  clearance: 'Освобождение поля',
  stalemate: 'Спасение патом',
  madPiece: '«Бешеная фигура»',
  perpetualCheck: 'Вечный шах',
  fortressAndPositional: 'Позиционная ничья и крепость',
  // Legacy / additional keys
  mateAttack: 'Матовая атака',
  sacrifice: 'Тематическая жертва',
  winQueen: 'Выигрыш ферзя',
  winRook: 'Выигрыш ладьи',
  winBishop: 'Выигрыш слона',
  winKnight: 'Выигрыш коня',
  winMaterial: 'Материальное преимущество',
  decoy: 'Завлечение',
  removingDefender: 'Уничтожение защиты',
  clearanceAndLineOpening: 'Освобождение поля и линии',
  interferenceAndBlockade: 'Перекрытие и блокада',
  intermediateAndWeakSquare: 'Промежуточный ход и слабость',
  stalemateDraw: 'Спасение патом',
  perpetualCheckDraw: 'Вечный шах',
  fortressAndPositionalDraw: 'Позиционная ничья и крепость',
  mixedExam: 'Экзамен без подсказок',
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

  const fallback = CLASSICAL_COURSE_SCOPE_FALLBACKS[key]
  if (fallback) {
    return fallback
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

export function formatElapsedDuration(seconds: number, t: TranslateFn): string {
  const safeSec = Math.max(0, Math.round(seconds))
  const days = Math.floor(safeSec / 86400)
  const hours = Math.floor((safeSec % 86400) / 3600)
  const minutes = Math.max(1, Math.floor((safeSec % 3600) / 60))
  if (days > 0) {
    return `${days}${t('features.trainingCenter.units.dayShort')} ${hours}${t('features.trainingCenter.units.hourShort')}`
  }
  if (hours > 0) {
    return `${hours}${t('features.trainingCenter.units.hourShort')} ${minutes}${t('features.trainingCenter.units.minShort')}`
  }
  return `${minutes}${t('features.trainingCenter.units.minShort')}`
}

