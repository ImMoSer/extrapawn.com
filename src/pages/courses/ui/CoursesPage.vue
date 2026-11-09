<script setup lang="ts">
import {
  isEndgameCourseSlug,
  type TacticsCourseSlug,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import {
  TacticsCourseCurriculumView,
  TrainingPlayTopInfo,
  TrainingSessionReport,
  TrainingSessionSidebar,
  useTrainingSessionStore,
} from '@/features/training-session'
import { GameLayout, RightSidebarSlot } from '@/widgets/game-layout'
import {
  BookOutline,
  CheckmarkCircleOutline,
  FlashOutline,
  FlameOutline,
  LockClosedOutline,
  RibbonOutline,
  SparklesOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

type CourseCategoryKey = 'tactics' | 'endgames'

interface ClassicalCourseCatalogItem {
  id: TacticsCourseSlug
  category: CourseCategoryKey
  number: number
  title: string
  subtitle: string
  scheduleLabel: string
  status: 'ready' | 'coming_soon'
}

const CLASSICAL_COURSES_CATALOG: readonly ClassicalCourseCatalogItem[] = [
  {
    id: 'tactics_classical_1',
    category: 'tactics',
    number: 1,
    title: 'Курс тактики I · Геометрия и Матовые конструкции',
    subtitle:
      'Фундаментальная геометрия доски, матовые сети, двойные удары, связки, вскрытые шахи и материальные завоевания.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'tactics_classical_2',
    category: 'tactics',
    number: 2,
    title: 'Курс тактики II · Жертвы и Комбинационный взрыв',
    subtitle:
      'Жертвы ферзя и ладьи, завлечение, отвлечение, перекрытие, разрушение прикрытия короля и многоходовые комбинации.',
    scheduleLabel: '4 недели · 16 батчей · 8 Дней Дятла',
    status: 'ready',
  },
  {
    id: 'tactics_classical_3',
    category: 'tactics',
    number: 3,
    title: 'Курс тактики III · Стратегическая тактика и Искусство спасения',
    subtitle:
      'Освобождение линий, критические поля, цугцванг, контрудары в худших позициях и этюдное спасение вечным шахом/патом.',
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

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const store = useTrainingSessionStore()

const activeCategory = ref<CourseCategoryKey>(
  isEndgameCourseSlug(store.activeCourseSlug) ? 'endgames' : 'tactics',
)
const selectedCourseId = ref<TacticsCourseSlug>(store.activeCourseSlug)

watch(
  () => store.activeCourseSlug,
  (slug) => {
    if (slug && selectedCourseId.value !== slug) {
      selectedCourseId.value = slug
      activeCategory.value = isEndgameCourseSlug(slug) ? 'endgames' : 'tactics'
    }
  },
)

const categoryCourses = computed<ClassicalCourseCatalogItem[]>(() =>
  CLASSICAL_COURSES_CATALOG.filter((c) => c.category === activeCategory.value),
)

const selectedCourse = computed<ClassicalCourseCatalogItem | null>(
  () => CLASSICAL_COURSES_CATALOG.find((c) => c.id === selectedCourseId.value) ?? null,
)

function resolveCourseVolumeLabel(course: ClassicalCourseCatalogItem): string {
  if (course.status !== 'ready') return 'В разработке'
  if (
    store.tacticsCourseCurriculum &&
    store.tacticsCourseCurriculum.course_slug === course.id &&
    store.tacticsCourseCurriculum.total_puzzles > 0
  ) {
    return `${store.tacticsCourseCurriculum.total_puzzles} позиций`
  }
  return '16 батчей'
}

function handleSelectCategory(cat: CourseCategoryKey): void {
  activeCategory.value = cat
  const firstInCat = CLASSICAL_COURSES_CATALOG.find((c) => c.category === cat)
  if (firstInCat) {
    selectedCourseId.value = firstInCat.id
    if (firstInCat.status === 'ready') {
      store.selectTacticsCourse(firstInCat.id)
    }
  }
}

function handleSelectCourse(course: ClassicalCourseCatalogItem): void {
  selectedCourseId.value = course.id
  if (course.status === 'ready') {
    store.selectTacticsCourse(course.id)
  }
}

onUnmounted(() => {
  if (store.isPlaying || store.isAwaitingNext || store.isAnalysisMode) {
    store.pauseToHub()
  }
})
</script>

<template>
  <!-- 0. PUBLIC PLACEHOLDER FOR NON-DEVELOPER USERS -->
  <div
    v-if="!authStore.isMo3ep"
    class="w-full h-full min-h-[70vh] max-w-3xl mx-auto px-4 py-12 flex flex-col items-center justify-center text-center gap-5 text-text-primary select-none"
  >
    <div class="p-8 rounded-lg bg-surface border border-border flex flex-col items-center gap-4 w-full">
      <div class="w-14 h-14 rounded-full bg-warning/15 border border-warning/40 flex items-center justify-center">
        <NIcon size="28" class="text-warning">
          <SparklesOutline />
        </NIcon>
      </div>

      <span class="px-3 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase tracking-widest bg-warning/15 text-warning border border-warning/40">
        EXTRAPAWN CLASSICAL COURSES
      </span>

      <h1 class="font-display font-bold text-3xl md:text-4xl tracking-wider uppercase text-text-primary">
        COMING SOON
      </h1>

      <p class="text-sm text-text-secondary max-w-lg leading-relaxed">
        Structured step-by-step Tactics and Endgame curricula with dedicated Woodpecker error-clearance days are currently in development and final calibration.
      </p>

      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <NButton type="primary" @click="router.push('/training')">
          <template #icon>
            <NIcon><FlashOutline /></NIcon>
          </template>
          Open Training Center
        </NButton>
        <NButton secondary @click="router.push('/warmup')">
          <template #icon>
            <NIcon><FlameOutline /></NIcon>
          </template>
          Open WarmUp
        </NButton>
      </div>
    </div>
  </div>

  <!-- 1. HUB / SHOWCASE & ACTIVE COURSE CURRICULUM (DEVELOPER MO3EP ONLY) -->
  <div
    v-else-if="store.viewState === 'hub'"
    class="w-full max-w-6xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6 text-text-primary select-none"
  >
    <!-- Top Header Banner -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-3.5 sm:p-5 rounded-lg bg-surface border border-border">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2.5">
          <NIcon size="26" class="text-warning">
            <BookOutline />
          </NIcon>
          <h1 class="font-display font-bold text-2xl tracking-wide text-text-primary">
            {{ t('shared.nav.courses') }}
          </h1>
          <span class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40">
            3 курса Тактики · 4 курса Эндшпиля
          </span>
        </div>
        <p class="text-xs text-text-secondary max-w-3xl">
          Пошаговые авторские учебные программы от простого к сложному с выделенными Днями Дятла: после каждых двух тематических батчей открывается специальный день полной зачистки допущенных ошибок.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <NButton size="small" secondary @click="router.push('/training')">
          <template #icon>
            <NIcon><FlashOutline /></NIcon>
          </template>
          {{ t('shared.nav.trainingCenter') }}
        </NButton>
        <NButton size="small" secondary @click="router.push('/warmup')">
          <template #icon>
            <NIcon><FlameOutline /></NIcon>
          </template>
          {{ t('shared.nav.warmup') }}
        </NButton>
        <NButton size="small" secondary @click="router.push('/user-cabinet')">
          <template #icon>
            <NIcon><RibbonOutline /></NIcon>
          </template>
          {{ t('shared.nav.userCabinet') }}
        </NButton>
      </div>
    </div>

    <!-- Category Switcher: Tactics (3) vs Endgames (4) -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex p-1 rounded-md bg-surface border border-border gap-1">
          <button
            type="button"
            class="px-4 py-2 rounded-xs font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
            :class="
              activeCategory === 'tactics'
                ? 'bg-brand text-on-brand'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleSelectCategory('tactics')"
          >
            <span>Курсы Тактики</span>
            <span
              class="px-1.5 py-0.2 rounded-xs text-[10px] font-condensed font-bold"
              :class="
                activeCategory === 'tactics'
                  ? 'bg-surface/20 text-on-brand'
                  : 'bg-elevated text-text-secondary'
              "
            >
              3
            </span>
          </button>

          <button
            type="button"
            class="px-4 py-2 rounded-xs font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
            :class="
              activeCategory === 'endgames'
                ? 'bg-brand text-on-brand'
                : 'text-text-secondary hover:text-text-primary'
            "
            @click="handleSelectCategory('endgames')"
          >
            <span>Курсы Эндшпиля</span>
            <span
              class="px-1.5 py-0.2 rounded-xs text-[10px] font-condensed font-bold"
              :class="
                activeCategory === 'endgames'
                  ? 'bg-surface/20 text-on-brand'
                  : 'bg-elevated text-text-secondary'
              "
            >
              4
            </span>
          </button>
        </div>

        <span class="text-xs font-condensed text-text-secondary">
          Цикл обучения: 2 батча решения → 1 День Дятла (работа над ошибками)
        </span>
      </div>

      <!-- Course Cards Grid for Selected Category -->
      <div
        class="grid grid-cols-1 gap-3"
        :class="activeCategory === 'tactics' ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'"
      >
        <button
          v-for="course in categoryCourses"
          :key="course.id"
          type="button"
          class="p-4 rounded-lg border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer"
          :class="
            selectedCourseId === course.id
              ? 'bg-elevated border-brand shadow-xs'
              : 'bg-surface border-border hover:border-border-hover'
          "
          @click="handleSelectCourse(course)"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span
                class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase border"
                :class="
                  course.status === 'ready'
                    ? 'bg-brand/15 text-brand border-brand/40'
                    : 'bg-elevated text-text-secondary border-border'
                "
              >
                Курс #{{ course.number }}
              </span>

              <span
                v-if="course.status === 'ready'"
                class="inline-flex items-center gap-1 text-[11px] font-condensed font-bold text-success"
              >
                <NIcon size="14"><CheckmarkCircleOutline /></NIcon>
                Доступен
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 text-[11px] font-condensed text-text-secondary"
              >
                <NIcon size="13"><TimeOutline /></NIcon>
                Скоро
              </span>
            </div>

            <div class="font-display font-bold text-sm text-text-primary leading-snug">
              {{ course.title }}
            </div>

            <p class="text-xs text-text-secondary line-clamp-3">
              {{ course.subtitle }}
            </p>
          </div>

          <div class="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-condensed text-text-secondary">
            <span>{{ course.scheduleLabel }}</span>
            <span class="font-bold text-text-primary">{{ resolveCourseVolumeLabel(course) }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Active Course Curriculum Cabinet OR Coming Soon Placeholder (No outer wrapper card) -->
    <TacticsCourseCurriculumView
      v-if="selectedCourse?.status === 'ready'"
      :course-slug="selectedCourse.id"
    />

    <div
      v-else-if="selectedCourse"
      class="rounded-lg bg-surface border border-border p-6 py-10 flex flex-col items-center justify-center text-center gap-3"
    >
      <NIcon size="36" class="text-text-secondary"><LockClosedOutline /></NIcon>
      <div class="font-display font-bold text-lg text-text-primary">
        {{ selectedCourse.title }}
      </div>
      <p class="text-xs text-text-secondary max-w-xl">
        {{ selectedCourse.subtitle }} Курс готовится к выпуску по стандарту «2 тематических батча → 1 выделенный День Дятла».
      </p>
    </div>
  </div>

  <!-- 2. POST-BATCH / POST-WOODPECKER REPORT -->
  <TrainingSessionReport v-else-if="store.viewState === 'report'" />

  <!-- 3. INTERACTIVE BOARD PLAY & ANALYSIS -->
  <GameLayout v-else>
    <template #left-panel>
      <TrainingSessionSidebar />
    </template>
    <template #top-info>
      <TrainingPlayTopInfo />
    </template>
    <template #center-column>
      <!-- Board rendered by GameLayout -->
    </template>
    <template #right-panel>
      <RightSidebarSlot />
    </template>
  </GameLayout>
</template>

