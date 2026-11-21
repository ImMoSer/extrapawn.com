import type { TacticsCourseSlug } from '@/entities/training'

export type CourseCategoryKey = 'tactics' | 'endgames'

export interface ClassicalCourseCatalogItem {
  id: TacticsCourseSlug
  category: CourseCategoryKey
  number: number
  title: string
  subtitle: string
  scheduleLabel: string
  status: 'ready' | 'coming_soon'
}

export interface CourseCategoryMeta {
  key: CourseCategoryKey
  title: string
  badge: string
  description: string
  scheduleSummary: string
}

export const COURSE_CATEGORIES_META: readonly CourseCategoryMeta[] = [
  {
    key: 'tactics',
    title: 'Курсы Тактики',
    badge: '3 курса',
    description:
      'Пошаговая спираль от базовых матов и тактических паттернов до многоходового расчёта, жертв и этюдного спасения.',
    scheduleSummary: '3 курса · 48 батчей · 24 Батча Дятла',
  },
  {
    key: 'endgames',
    title: 'Курсы Эндшпиля',
    badge: '4 курса',
    description:
      'Системная школа окончаний: пешечные, легкофигурные, ладейные (Люсена, Филидор) и многофигурные тяжёлые эндшпили.',
    scheduleSummary: '4 курса · 64 батча · 32 Батча Дятла',
  },
]

export const CLASSICAL_COURSES_CATALOG: readonly ClassicalCourseCatalogItem[] = [
  {
    id: 'tactics_classical_1',
    category: 'tactics',
    number: 1,
    title: 'Курс тактики I · Базовые паттерны и Геометрия удара',
    subtitle:
      'Уровень I спирали: матовая геометрия в 1–2 хода, выигрыш и ловля фигур, двойной удар, связка, вскрытый и линейный удар, базовые жертвы и основы спасения патом и вечным шахом.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'tactics_classical_2',
    category: 'tactics',
    number: 2,
    title: 'Курс тактики II · Комбинационные идеи и Пролом обороны',
    subtitle:
      'Уровень II спирали: жертвы ферзя и ладьи, завлечение, отвлечение, перекрытие, разрушение прикрытия короля, открытие линий, критические поля, промежуточный ход и патовые комбинации в 2 хода.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'tactics_classical_3',
    category: 'tactics',
    number: 3,
    title: 'Курс тактики III · Многоходовый расчёт и Искусство спасения',
    subtitle:
      'Уровень III спирали: каскадные комбинации в 3–8 ходов, освобождение полей, тихие ходы, цугцванг, активная блокада, этюдные крепости, «бешеная фигура» и многоходовый вечный шах.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'endgame_course_1_pawn',
    category: 'endgames',
    number: 1,
    title: 'Курс эндшпиля I · Базовые маты и Пешечная геометрия',
    subtitle:
      'Матование одинокого короля, квадрат пешки, ключевые поля, оппозиция, пешечный прорыв и базовые теоретические эндшпили.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'endgame_course_2_minor',
    category: 'endgames',
    number: 2,
    title: 'Курс эндшпиля II · Легкофигурные окончания и Крепости',
    subtitle:
      'Конь против пешек, одноцветные и разноцветные слоны, борьба слона против коня и двух слонов, искусство защиты и пата.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'endgame_course_3_rook',
    category: 'endgames',
    number: 3,
    title: 'Курс эндшпиля III · Ладейная школа (От Люсены до Многопешечных)',
    subtitle:
      'Мост Люсены, позиция Филидора, отрезание короля, ладейные окончания с пешками на одном и двух флангах, двухладейные битвы.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'endgame_course_4_heavy',
    category: 'endgames',
    number: 4,
    title: 'Курс эндшпиля IV · Тяжёлые фигуры и Многофигурный синтез',
    subtitle:
      'Ферзевые окончания, ферзь против ладьи и пешек, ладья против лёгкой фигуры и комбинированные многофигурные эндшпили.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
]
