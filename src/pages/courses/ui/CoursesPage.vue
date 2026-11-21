<script setup lang="ts">
import { type TacticsCourseSlug } from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import {
  EndgameAutomatOverlay,
  TacticsCourseCurriculumView,
  TrainingPlayTopInfo,
  TrainingSessionReport,
  TrainingSessionSidebar,
  useTrainingSessionStore,
} from '@/features/training-session'
import { useHorizontalSwipe } from '@/shared/lib/touch/useHorizontalSwipe'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import { GameLayout, RightSidebarSlot } from '@/widgets/game-layout'
import {
  ArrowBackOutline,
  ArrowForwardOutline,
  BookOutline,
  CaretBackSharp,
  CaretForwardSharp,
  CheckmarkCircleOutline,
  FlameOutline,
  FlashOutline,
  LockClosedOutline,
  RibbonOutline,
  SparklesOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  CLASSICAL_COURSES_CATALOG,
  COURSE_CATEGORIES_META,
  type ClassicalCourseCatalogItem,
  type CourseCategoryKey,
} from '../model/coursesCatalog'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useTrainingSessionStore()

const activeCategory = computed<CourseCategoryKey | null>(() => {
  const raw = typeof route.params.category === 'string' ? route.params.category : ''
  if (raw === 'tactics' || raw === 'endgames') return raw
  return null
})

const activeCategoryMeta = computed(
  () => COURSE_CATEGORIES_META.find((c) => c.key === activeCategory.value) ?? null,
)

const categoryCourses = computed<ClassicalCourseCatalogItem[]>(() => {
  if (!activeCategory.value) return []
  return CLASSICAL_COURSES_CATALOG.filter((c) => c.category === activeCategory.value)
})

const selectedCourseId = ref<TacticsCourseSlug>(store.activeCourseSlug)

function syncSelectedCourseForCategory(cat: CourseCategoryKey | null): void {
  if (!cat) return
  const list = CLASSICAL_COURSES_CATALOG.filter((c) => c.category === cat)
  if (list.length === 0) return

  const currentMatchesCat = list.some((c) => c.id === selectedCourseId.value)
  if (!currentMatchesCat) {
    const storeMatchesCat = list.find((c) => c.id === store.activeCourseSlug)
    const nextCourse = storeMatchesCat ?? list[0]
    if (nextCourse) {
      selectedCourseId.value = nextCourse.id
      if (nextCourse.status === 'ready') {
        store.selectTacticsCourse(nextCourse.id)
      }
    }
  }
}

watch(
  activeCategory,
  (cat) => {
    syncSelectedCourseForCategory(cat)
  },
  { immediate: true },
)

watch(
  () => store.activeCourseSlug,
  (slug) => {
    if (!slug || !activeCategory.value) return
    const belongs = categoryCourses.value.some((c) => c.id === slug)
    if (belongs && selectedCourseId.value !== slug) {
      selectedCourseId.value = slug
    }
  },
)

const selectedCourse = computed<ClassicalCourseCatalogItem | null>(
  () => categoryCourses.value.find((c) => c.id === selectedCourseId.value) ?? categoryCourses.value[0] ?? null,
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

function handleSelectCourse(course: ClassicalCourseCatalogItem): void {
  selectedCourseId.value = course.id
  if (course.status === 'ready') {
    store.selectTacticsCourse(course.id)
  }
}

function stepCourse(delta: -1 | 1): void {
  const list = categoryCourses.value
  if (list.length <= 1) return
  const idx = list.findIndex((c) => c.id === selectedCourse.value?.id)
  const baseIdx = idx >= 0 ? idx : 0
  const nextCourse = list[(baseIdx + delta + list.length) % list.length]
  if (nextCourse) {
    handleSelectCourse(nextCourse)
  }
}

const courseCardSwipe = useHorizontalSwipe({
  onSwipeLeft: () => stepCourse(1),
  onSwipeRight: () => stepCourse(-1),
})

function handleOpenCategory(cat: CourseCategoryKey): void {
  void router.push(`/courses/${cat}`)
}

onUnmounted(() => {
  if (store.isBoardSessionActive) {
    store.pauseToHub()
  }
})
</script>

<template>
  <!-- 0. PUBLIC PLACEHOLDER FOR REGULAR USERS (OPEN TO testuser, developer, owner) -->
  <AppPageShell v-if="!authStore.canAccessCourses" vertical-center>
    <div
      class="flex w-full flex-col items-center justify-center gap-5 text-center text-text-primary select-none"
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

        <h1 class="font-display font-bold text-3xl @3xl:text-4xl tracking-wider uppercase text-text-primary">
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
  </AppPageShell>

  <!-- 1A. INTERMEDIATE COURSES ROUTER (/courses -> Tactics vs Endgames) -->
  <AppPageShell v-else-if="store.viewState === 'hub' && !activeCategory">
    <div class="flex w-full flex-col gap-3 sm:gap-5 text-text-primary select-none">
      <!-- Header -->
      <div class="flex flex-col @5xl:flex-row @5xl:items-center @5xl:justify-between gap-3 @3xl:gap-4 p-3.5 @3xl:p-5 rounded-lg bg-surface border border-border">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <NIcon size="24" class="text-warning">
              <BookOutline />
            </NIcon>
            <h1 class="font-display font-bold text-xl @3xl:text-2xl tracking-wide text-text-primary">
              {{ t('shared.nav.courses') }}
            </h1>
            <span class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40">
              3 Тактика · 4 Эндшпиль
            </span>
          </div>
          <p class="text-xs text-text-secondary max-w-3xl">
            Пошаговые авторские учебные программы: все курсы открыты в любой последовательности, а внутри каждого курса сохраняется строгий ритм «2 батча → Батч Дятла».
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

      <!-- Two Category Portal Cards: Tactics & Endgames -->
      <div class="grid grid-cols-1 @2xl:grid-cols-2 gap-3 sm:gap-4">
        <button
          v-for="cat in COURSE_CATEGORIES_META"
          :key="cat.key"
          type="button"
          class="group p-5 @3xl:p-6 rounded-lg bg-surface border border-border hover:border-brand/70 hover:bg-elevated/40 text-left transition-all cursor-pointer flex flex-col justify-between gap-4"
          @click="handleOpenCategory(cat.key)"
        >
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2.5 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40">
                {{ cat.badge }}
              </span>
              <NIcon
                size="18"
                class="text-text-secondary group-hover:text-brand group-hover:translate-x-0.5 transition-all"
              >
                <ArrowForwardOutline />
              </NIcon>
            </div>

            <h2 class="font-display font-bold text-xl text-text-primary">
              {{ cat.title }}
            </h2>

            <p class="text-xs @3xl:text-sm text-text-secondary leading-relaxed">
              {{ cat.description }}
            </p>
          </div>

          <div class="pt-3 border-t border-border/70 flex items-center justify-between text-xs font-condensed text-text-secondary">
            <span>{{ cat.scheduleSummary }}</span>
            <span class="font-bold uppercase text-brand">Открыть →</span>
          </div>
        </button>
      </div>
    </div>
  </AppPageShell>

  <!-- 1B. CATEGORY CURRICULUM VIEW (/courses/tactics or /courses/endgames) -->
  <AppPageShell v-else-if="store.viewState === 'hub' && activeCategory">
    <div class="flex w-full flex-col gap-3 sm:gap-5 text-text-primary select-none">
      <!-- Category Top Header with Back to /courses -->
      <div class="flex flex-col @5xl:flex-row @5xl:items-center @5xl:justify-between gap-3 p-3.5 @3xl:p-5 rounded-lg bg-surface border border-border">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <NButton size="tiny" secondary @click="router.push('/courses')">
              <template #icon>
                <NIcon><ArrowBackOutline /></NIcon>
              </template>
              {{ t('shared.nav.courses') }}
            </NButton>
            <h1 class="font-display font-bold text-xl @3xl:text-2xl tracking-wide text-text-primary">
              {{ activeCategoryMeta?.title }}
            </h1>
            <span
              v-if="activeCategoryMeta"
              class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40"
            >
              {{ activeCategoryMeta.badge }}
            </span>
          </div>
          <p class="text-xs text-text-secondary">
            Цикл внутри каждого курса: 2 батча решения → 1 Батч Дятла (работа над ошибками) → следующая пара батчей.
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

      <!-- Mobile / Compact Course Swipe Card (< @3xl) -->
      <div v-if="selectedCourse" class="@3xl:hidden select-none">
        <div
          class="rounded-md border border-brand/60 bg-elevated overflow-hidden flex items-stretch"
          @touchstart.passive="courseCardSwipe.onTouchstart"
          @touchend="courseCardSwipe.onTouchend"
          @touchcancel="courseCardSwipe.onTouchcancel"
        >
          <button
            type="button"
            class="w-10 shrink-0 flex items-center justify-center border-r border-border bg-surface/60 text-text-secondary hover:text-text-primary active:bg-surface active:text-brand transition-colors cursor-pointer"
            aria-label="Предыдущий курс"
            @click="stepCourse(-1)"
          >
            <NIcon size="18"><CaretBackSharp /></NIcon>
          </button>

          <div class="flex-1 min-w-0 p-3 flex flex-col justify-between gap-2">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase border bg-brand/15 text-brand border-brand/40">
                  Курс #{{ selectedCourse.number }} / {{ categoryCourses.length }}
                </span>

                <span
                  v-if="selectedCourse.status === 'ready'"
                  class="inline-flex items-center gap-1 text-[11px] font-condensed font-bold text-success"
                >
                  <NIcon size="13"><CheckmarkCircleOutline /></NIcon>
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
                {{ selectedCourse.title }}
              </div>

              <p class="text-xs text-text-secondary line-clamp-3">
                {{ selectedCourse.subtitle }}
              </p>
            </div>

            <div class="pt-1.5 border-t border-border/60 flex items-center justify-between text-[11px] font-condensed text-text-secondary">
              <span>{{ selectedCourse.scheduleLabel }}</span>
              <span class="font-bold text-text-primary">
                {{ resolveCourseVolumeLabel(selectedCourse) }}
              </span>
            </div>

            <div class="flex items-center justify-center gap-1.5 pt-0.5">
              <button
                v-for="course in categoryCourses"
                :key="course.id"
                type="button"
                :aria-label="course.title"
                class="h-1.5 rounded-xs transition-all cursor-pointer"
                :class="
                  course.id === selectedCourse.id
                    ? 'w-5 bg-brand'
                    : 'w-2 bg-border-hover hover:bg-text-secondary'
                "
                @click="handleSelectCourse(course)"
              />
            </div>
          </div>

          <button
            type="button"
            class="w-10 shrink-0 flex items-center justify-center border-l border-border bg-surface/60 text-text-secondary hover:text-text-primary active:bg-surface active:text-brand transition-colors cursor-pointer"
            aria-label="Следующий курс"
            @click="stepCourse(1)"
          >
            <NIcon size="18"><CaretForwardSharp /></NIcon>
          </button>
        </div>
      </div>

      <!-- Desktop Course Cards Grid (@3xl+) -->
      <div
        class="hidden @3xl:grid gap-3"
        :class="activeCategory === 'tactics' ? '@3xl:grid-cols-3' : '@3xl:grid-cols-2 @5xl:grid-cols-4'"
      >
        <button
          v-for="course in categoryCourses"
          :key="course.id"
          type="button"
          class="p-4 rounded-lg border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer"
          :class="
            selectedCourse?.id === course.id
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

      <!-- Active Course Curriculum Cabinet OR Coming Soon Placeholder -->
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
          {{ selectedCourse.subtitle }} Курс готовится к выпуску по стандарту «2 тематических батча → 1 выделенный Батч Дятла».
        </p>
      </div>
    </div>
  </AppPageShell>

  <!-- 2. POST-BATCH / POST-WOODPECKER REPORT -->
  <TrainingSessionReport v-else-if="store.viewState === 'report'" />

  <!-- 3. INTERACTIVE BOARD PLAY & ANALYSIS -->
  <GameLayout v-else :board-locked="store.isAutomatLocked">
    <template #left-panel>
      <TrainingSessionSidebar />
    </template>
    <template #top-info>
      <TrainingPlayTopInfo />
    </template>
    <template #center-column>
      <EndgameAutomatOverlay />
    </template>
    <template #right-panel>
      <RightSidebarSlot />
    </template>
  </GameLayout>
</template>
