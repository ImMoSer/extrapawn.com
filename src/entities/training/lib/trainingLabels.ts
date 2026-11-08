import type { TrainingDifficulty, TrainingDiscipline } from '../model/training.types'

type TranslateFn = (key: string) => string
type HasKeyFn = (key: string) => boolean

const DISCIPLINE_I18N_MAP: Readonly<Record<TrainingDiscipline, string>> = {
  tactics: 'features.trainingCenter.disciplines.tactics',
  tactics_course: 'features.trainingCenter.disciplines.tactics_course',
  endgame_course: 'features.trainingCenter.disciplines.endgame_course',
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

  // 8 Domains of endgame_course (plus EXAMS)
  FUNDAMENTAL_MATES: 'Базовые маты одинокому королю',
  PAWN_ENDGAMES: 'Пешечные эндшпили (K+P)',
  KNIGHT_ENDGAMES: 'Коневые эндшпили',
  BISHOP_ENDGAMES: 'Слоновые эндшпили',
  BISHOP_VS_KNIGHT: 'Борьба слона против коня',
  ROOK_ENDGAMES: 'Ладейные эндшпили',
  QUEEN_ENDGAMES: 'Ферзевые эндшпили',
  COMPLEX_ENDGAMES: 'Сложные и многофигурные эндшпили',

  // 26 Classes of endgame_course
  elementaryMates: 'Элементарные линейные и тяжелые маты',
  minorPieceMates: 'Маты лёгкими фигурами',
  kingAndPawnBasics: 'База: Король и пешка против короля (KPK)',
  oppositionAndKeySquares: 'Оппозиция, ключевые поля и цугцванг',
  pawnRacesAndBreakthroughs: 'Пешечные гонки, штаны и прорывы',
  multipawnEndgames: 'Многопешечный технический эндшпиль',
  knightVsPawns: 'Конь против пешек (борьба с проходными)',
  knightWithPawns: 'Коневой эндшпиль с пешками',
  twoKnightsEndgame: 'Два коня против пешек и фигур',
  bishopVsPawns: 'Слон против пешек',
  sameColorBishops: 'Одноцветные слоны',
  oppositeColorBishops: 'Разноцветные слоны',
  twoBishopsEndgame: 'Преимущество двух слонов в эндшпиле',
  bishopVsKnightTechnical: 'Слон против коня (техническая борьба)',
  rookVsPawn: 'Ладья против пешки (Мосты, Филидор, позиция Лусены)',
  rookVsMultiplePawns: 'Ладья против пешек',
  rookAndPawnEndgame: 'Ладья и пешка против ладьи (RP vs R)',
  multirookEndgame: 'Многопешечный ладейный и двухладейный эндшпиль',
  queenVsPawn: 'Ферзь против пешки на предпоследней горизонтали',
  queenWithPawns: 'Ферзевый эндшпиль с пешками',
  queenVsRook: 'Ферзь против ладьи (Филидор и защита)',
  queenVsMinors: 'Ферзь против лёгких фигур и двух ладей',
  rookVsMinor: 'Ладья против лёгкой фигуры (качество)',
  rookAndMinorVsRook: 'Ладья и лёгкая фигура против ладьи (R+M vs R)',
  rookAndMinorCombat: 'Ладья с лёгкой фигурой против ладьи с лёгкой фигурой',
  queenAndPieceCombat: 'Ферзь с фигурой и микс-эндшпиль',

  // Endgame Course Exam Classes
  examPawnAndMates: 'Экзамен Курса I: Базовые маты и пешечный эндшпиль',
  examMinorPieces: 'Экзамен Курса II: Легкофигурный эндшпиль',
  examRookEndgames: 'Экзамен Курса III: Ладейный эндшпиль',
  examHeavyAndComplex: 'Экзамен Курса IV: Ферзевые и многофигурные эндшпили',

  // SubClasses of endgame_course
  mateWithQueenOrTwoRooks: 'Мат ферзём или двумя ладьями',
  mateWithOneRook: 'Мат одной ладьёй',
  mateWithTwoBishops: 'Мат двумя слонами',
  mateWithBishopAndKnight: 'Мат слоном и конём (метод Делетанга и треугольник)',
  ruleOfTheSquare: 'Правило квадрата и догоняющий король',
  kpkPromotionWin: 'Проведение пешки при поддержке короля',
  kpkRookPawnAndStalemateDraw: 'Ладейная пешка и патовые убежища (защита)',
  directAndDistantOpposition: 'Прямая, дальняя и диагональная оппозиция',
  keySquaresAndShouldering: 'Ключевые поля и отталкивание плечом',
  triangulationAndCorrespondingSquares: 'Треугольник, поля соответствия и взаимный цугцванг',
  outsidePassedPawnAndTroitsky: 'Отдалённая проходная и штаны',
  pawnBreakthroughSacrifice: 'Пешечный прорыв с жертвой пешки',
  queenRaceWithCheckOrCross: 'Пешечные гонки (кто первый с шахом)',
  multipawnWinConversion: 'Техника реализации лишней пешки',
  multipawnFortressAndStalemate: 'Пешечные крепости и ничейные стойки',
  knightStopsPassedPawnHold: 'Конь останавливает проходные (удержание ничьей)',
  pawnsBeatKnightWin: 'Лавина пешек побеждает коня',
  knightEndgameWin: 'Реализация перевеса в коневом эндшпиле',
  knightEndgameHoldDraw: 'Защита и спасение в коневом эндшпиле',
  troitskyLineTwoKnightsWin: 'Линия Троицкого: мат двумя конями при пешке',
  twoKnightsHoldDraw: 'Защита против двух коней',
  bishopStopsPassedPawnsHold: 'Слон контролирует две диагонали (ничья)',
  pawnsOverloadBishopWin: 'Штаны и перегрузка слона пешками',
  wrongRookPawnFortressDraw: '«Не тот» угол для слона при ладейной пешке (ничья)',
  sameColorBishopsWin: 'Одноцветные слоны: реализация и вытеснение',
  sameColorBishopsFortressDraw: 'Одноцветные слоны: блокада по цвету слона',
  ocbAttackingTwoPassedPawnsWin: 'Разноцвет: атака и образование двух проходных',
  ocbBlockadeFortressDraw: 'Разноцвет: непробиваемая блокада по полям одного цвета',
  twoBishopsConversionWin: 'Два слона: выжигание полей и прорыв',
  twoBishopsDefenseHold: 'Упорная оборона против двух слонов',
  bishopSuperiorOpenBoardWin: 'Превосходство слона при игре на двух флангах',
  knightSuperiorFixedPawnsWin: 'Превосходство коня в закрытой позиции',
  bishopVsKnightFortressDraw: 'Крепость и блокада в борьбе слона и коня',
  lucenaAndBuildingBridgeWin: 'Позиция Лусены (построение моста) и отсечение короля',
  philidorAndRearChecksDraw: 'Позиция Филидора, шахи с тыла и сбоку',
  shortSidelongSideDefense: 'Длинная и короткая сторона в ладейном эндшпиле',
  rookVsTwoConnectedPawns: 'Ладья против связанных проходных',
  rookVsDisconnectedPawns: 'Ладья против разрозненных пешек',
  rookAndPawnTechnicalWin: 'Реализация лишней пешки в ладейном эндшпиле',
  vancuraAndRookPawnDraw: 'Позиция Ванчуры и защита с ладейной/слоновой пешкой',
  activeRookMultipawnWin: 'Активность ладьи и прорыв в многопешечном эндшпиле',
  activeRookCounterplayDraw: 'Спасение активной контригрой ладьи',
  doubleRookEndgameWin: 'Двухладейный эндшпиль: матовая атака и проходные',
  doubleRookEndgameDraw: 'Двухладейный эндшпиль: вечный шах и размен',
  queenVsBishopOrCenterPawnWin: 'Ферзь против центральной или слоновой пешки (ступеньки)',
  queenVsRookOrKnightPawnDraw: 'Спасение с ладейной или коневой пешкой на 7-й/2-й',
  queenEndgamePassedPawnWin: 'Ферзевый эндшпиль: гонка проходной и укрытие от шахов',
  queenEndgamePerpetualDraw: 'Ферзевый эндшпиль: спасение вечным шахом',
  queenVsRookPhilidorWin: 'Ферзь против ладьи: вытеснение в позицию Филидора (цугцванг)',
  queenVsRookFortressAndStalemateDraw: 'Ферзь против ладьи: крепость третьего ряда и «бешеная ладья»',
  queenVsMinorPiecesWin: 'Ферзь против лёгких фигур: двойные удары и матовая сеть',
  minorPiecesFortressVsQueenDraw: 'Координация лёгких фигур: крепость против ферзя',
  queenVsTwoRooksCombat: 'Ферзь против двух ладей',
  exchangeUpConversionWin: 'Реализация лишнего качества (ладья против лёгкой фигуры)',
  minorPieceFortressVsRookDraw: 'Крепость лёгкой фигуры с пешками против ладьи',
  rookVsTwoMinorsCombat: 'Ладья против двух лёгких фигур',
  rookAndBishopVsRookPhilidorWin: 'Ладья и слон против ладьи (позиция Филидора)',
  rookAndKnightVsRookWin: 'Ладья и конь против ладьи',
  defendingRookVsRookAndMinorDraw: 'Защита по методу Кохрана и второго ряда (R vs R+M)',
  rookAndMinorEndgameWin: 'Ладья и лёгкая фигура: координация в атаке',
  rookAndMinorEndgameDraw: 'Ладья и лёгкая фигура: размен пешек и упрощение',
  queenAndMinorVsQueenWin: 'Ферзь и лёгкая фигура против ферзя',
  queenVsQueenAndMinorDraw: 'Вечный шах против ферзя с лёгкой фигурой',
  queenAndRookHeavyCombat: 'Тяжелофигурный бой (ферзь и ладья)',
  complexMaterialImbalanceCombat: 'Нестандартное соотношение материала в эндшпиле',
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
  mixedExam: 'Экзамен без подсказок',
}

const DIFFICULTY_I18N_MAP: Readonly<Record<TrainingDifficulty, string>> = {
  Novice: 'puzzleCategories.difficulties.level_novice',
  Pro: 'puzzleCategories.difficulties.level_pro',
  Master: 'puzzleCategories.difficulties.level_master',
}

export function resolveDisciplineLabel(discipline: TrainingDiscipline, t: TranslateFn): string {
  if (discipline === 'endgame_course') {
    const key = DISCIPLINE_I18N_MAP[discipline]
    const translated = t(key)
    return translated && translated !== key ? translated : 'Классический курс эндшпиля'
  }
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
    `features.trainingCenter.warmup.motifGroups.${key}`,
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

