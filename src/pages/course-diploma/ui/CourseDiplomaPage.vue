<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NResult, NSpin } from 'naive-ui'
import {
  ArrowBackOutline,
  CalendarOutline,
  CheckmarkCircleOutline,
  FlashOutline,
  RibbonOutline,
  ShareSocialOutline,
  SparklesOutline,
  TimeOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import {
  formatElapsedDuration,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  trainingApi,
  type CourseDiplomaDTO,
  type CourseScopeSummaryDTO,
} from '@/entities/training'
import { ENGINE_NAMES } from '@/shared/types/api.types'

const { t, te, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const diploma = ref<CourseDiplomaDTO | null>(null)
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)
const isCopied = ref<boolean>(false)

const courseId = computed<string>(() => {
  const raw = route.params.courseId
  return typeof raw === 'string' ? raw.trim() : ''
})

async function loadDiploma(): Promise<void> {
  if (!courseId.value) {
    errorMessage.value = t('features.trainingCenter.diploma.notFoundDesc')
    isLoading.value = false
    return
  }
  isLoading.value = true
  errorMessage.value = null
  try {
    diploma.value = await trainingApi.getCourseDiploma(courseId.value)
  } catch {
    errorMessage.value = t('features.trainingCenter.diploma.notFoundDesc')
    diploma.value = null
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadDiploma()
})

watch(courseId, () => {
  void loadDiploma()
})

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function formatBoardTimeMs(ms?: number): string {
  if (!ms || ms <= 0) return '0s'
  const totalSec = Math.max(1, Math.round(ms / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) {
    return `${hours}${t('features.trainingCenter.units.hourShort')} ${minutes}${t('features.trainingCenter.units.minShort')}`
  }
  if (minutes > 0) {
    return `${minutes}${t('features.trainingCenter.units.minShort')} ${seconds}s`
  }
  return `${seconds}s`
}

function formatDelta(val?: number): string {
  if (val === undefined) return '0'
  const rounded = Math.round(val * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

const avgPuzzleTimeText = computed<string>(() => {
  const d = diploma.value
  if (!d || !d.summary.total_time_ms || d.total_attempts <= 0) return '—'
  const avgMs = Math.round(d.summary.total_time_ms / d.total_attempts)
  return formatBoardTimeMs(avgMs)
})

interface ScopeGroupSection {
  id: string
  title: string
  items: Array<
    CourseScopeSummaryDTO & {
      label: string
      total: number
      accuracyPct: number
    }
  >
}

const scopeSections = computed<ScopeGroupSection[]>(() => {
  const rawScopes = diploma.value?.summary.scopes
  if (!rawScopes || rawScopes.length === 0) return []

  const enrich = (s: CourseScopeSummaryDTO) => {
    const total = s.solved_count + s.failed_count
    const accuracyPct = total > 0 ? Math.round((s.solved_count / total) * 100) : 100
    return {
      ...s,
      label: resolveScopeLabel(s.group, s.key, t, te),
      total,
      accuracyPct,
    }
  }

  const byGroup = (groups: string[]) =>
    rawScopes
      .filter((s) => groups.includes(s.group) && s.solved_count + s.failed_count > 0)
      .map(enrich)
      .sort((a, b) => b.total - a.total || b.accuracyPct - a.accuracyPct)

  const sections: ScopeGroupSection[] = []

  const domains = byGroup(['domain'])
  if (domains.length > 0) {
    sections.push({
      id: 'domains',
      title: t('features.trainingCenter.diploma.scopesGroupDomains'),
      items: domains,
    })
  }

  const objectives = byGroup(['objective'])
  if (objectives.length > 0) {
    sections.push({
      id: 'objectives',
      title: t('features.trainingCenter.diploma.scopesGroupObjectives'),
      items: objectives,
    })
  }

  const classes = byGroup(['class'])
  if (classes.length > 0) {
    sections.push({
      id: 'classes',
      title: t('features.trainingCenter.diploma.scopesGroupClasses'),
      items: classes,
    })
  }

  const phases = byGroup(['phase'])
  if (phases.length > 0) {
    sections.push({
      id: 'phases',
      title: t('features.trainingCenter.diploma.scopesGroupPhases'),
      items: phases,
    })
  }

  const cognitive = byGroup(['cognitive'])
  if (cognitive.length > 0) {
    sections.push({
      id: 'cognitive',
      title: t('features.trainingCenter.diploma.scopesGroupCognitive'),
      items: cognitive,
    })
  }

  const motifs = byGroup(['geometry', 'operator', 'concept', 'trigger'])
  if (motifs.length > 0) {
    sections.push({
      id: 'motifs',
      title: t('features.trainingCenter.diploma.scopesGroupMotifs'),
      items: motifs,
    })
  }

  return sections
})

async function handleCopyDiplomaLink(): Promise<void> {
  if (typeof window === 'undefined' || !diploma.value) return
  const url = `${window.location.origin}/kursdiplom/${diploma.value.course.id}`
  try {
    await navigator.clipboard.writeText(url)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2500)
  } catch {
    // Fallback ignored if clipboard permission denied
  }
}

function handleOpenTrainingCenter(): void {
  const disc = diploma.value?.course.discipline
  if (disc) {
    void router.push({ path: '/training', query: { discipline: disc } })
    return
  }
  void router.push('/training')
}
</script>

<template>
  <div class="mx-auto my-6 max-w-4xl px-4 max-md:my-3 max-md:px-2 select-none">
    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-8"
    >
      <NSpin size="large" />
      <span class="text-sm text-text-secondary">
        {{ t('features.trainingCenter.diploma.loading') }}
      </span>
    </div>

    <!-- Not Found / Error State -->
    <div
      v-else-if="errorMessage || !diploma"
      class="rounded-xl border border-border bg-surface py-16 shadow-md"
    >
      <NResult
        status="404"
        :title="t('features.trainingCenter.diploma.notFoundTitle')"
        :description="errorMessage ?? t('features.trainingCenter.diploma.notFoundDesc')"
      >
        <template #footer>
          <div class="flex justify-center gap-3">
            <NButton secondary @click="router.push('/')">
              <template #icon>
                <NIcon :component="ArrowBackOutline" />
              </template>
              {{ t('shared.nav.home') }}
            </NButton>
            <NButton type="primary" @click="router.push('/training')">
              {{ t('features.trainingCenter.diploma.ctaTrainTooBtn') }}
            </NButton>
          </div>
        </template>
      </NResult>
    </div>

    <!-- Official Course Completion Diploma Card -->
    <div v-else class="space-y-6">
      <!-- Top Action Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <NButton secondary size="small" @click="router.push('/user-cabinet')">
          <template #icon>
            <NIcon :component="ArrowBackOutline" />
          </template>
          {{ t('features.trainingCenter.actions.openCabinet') }}
        </NButton>

        <div class="flex flex-wrap items-center gap-2">
          <NButton
            type="primary"
            size="small"
            @click="handleCopyDiplomaLink"
          >
            <template #icon>
              <NIcon :component="isCopied ? CheckmarkCircleOutline : ShareSocialOutline" />
            </template>
            {{
              isCopied
                ? t('features.trainingCenter.diploma.linkCopied')
                : t('shared.buttons.copyLink')
            }}
          </NButton>
        </div>
      </div>

      <!-- Certificate Frame -->
      <article
        class="relative overflow-hidden rounded-xl border-2 border-neon-cyan/50 bg-surface p-6 shadow-xl sm:p-8"
      >
        <!-- Decorative Corner Glows -->
        <div
          class="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-neon-cyan/10 blur-3xl"
        />
        <div
          class="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-neon-purple/10 blur-3xl"
        />

        <!-- Certificate Header -->
        <header
          class="relative flex flex-col items-start justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-center"
        >
          <div class="space-y-1.5">
            <div class="inline-flex items-center gap-2 rounded border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1 font-condensed text-xs font-bold tracking-widest text-neon-cyan uppercase">
              <NIcon :component="RibbonOutline" class="text-sm" />
              {{ t('features.trainingCenter.diploma.badge') }} · EXTRAPAWN
            </div>
            <h1 class="font-display text-2xl font-bold tracking-wide text-text-primary sm:text-3xl">
              {{ t('features.trainingCenter.diploma.pageTitle') }}
            </h1>
            <p class="text-xs text-text-secondary sm:text-sm">
              {{ t('features.trainingCenter.diploma.pageSubtitle') }}
            </p>
          </div>

          <div class="flex flex-col items-start sm:items-end">
            <div class="inline-flex items-center gap-1.5 rounded border border-success/40 bg-success/10 px-3 py-1 font-condensed text-xs font-bold text-success uppercase">
              <NIcon :component="CheckmarkCircleOutline" />
              {{ t('features.trainingCenter.course.status.completed') }} · 100%
            </div>
            <div class="mt-2 font-condensed text-[11px] text-text-secondary">
              {{ t('features.trainingCenter.diploma.certificateIdLabel') }}:
              <span class="text-text-primary">{{ diploma.course.id.slice(0, 8).toUpperCase() }}</span>
            </div>
          </div>
        </header>

        <!-- Recipient & Course Identity Strip -->
        <section
          class="relative mt-6 grid grid-cols-1 gap-4 rounded-lg border border-border bg-void/70 p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <!-- Player -->
          <div class="flex flex-col justify-between">
            <span class="font-condensed text-[11px] font-bold tracking-wider text-text-secondary uppercase">
              {{ t('features.trainingCenter.diploma.awardedTo') }}
            </span>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="font-display text-xl font-bold text-neon-cyan truncate">
                @{{ diploma.username }}
              </span>
            </div>
            <a
              :href="`https://lichess.org/@/${encodeURIComponent(diploma.username)}`"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-block font-condensed text-xs text-text-secondary hover:text-neon-cyan transition-colors"
            >
              {{ t('features.trainingCenter.diploma.lichessProfileLink') }}
            </a>
          </div>

          <!-- Discipline -->
          <div class="flex flex-col justify-between">
            <span class="font-condensed text-[11px] font-bold tracking-wider text-text-secondary uppercase">
              {{ t('features.trainingCenter.diploma.disciplineLabel') }}
            </span>
            <div class="mt-1 font-display text-lg font-bold text-text-primary">
              {{ resolveDisciplineLabel(diploma.course.discipline, t) }}
            </div>
            <span class="mt-1 font-condensed text-xs text-neon-purple">
              {{
                t('features.trainingCenter.course.quotaTarget', {
                  count: diploma.course.target_puzzles,
                })
              }}
            </span>
          </div>

          <!-- Difficulty Tier & Bot -->
          <div class="flex flex-col justify-between">
            <span class="font-condensed text-[11px] font-bold tracking-wider text-text-secondary uppercase">
              {{ t('features.trainingCenter.diploma.rankTierLabel') }}
            </span>
            <div class="mt-1 flex items-center gap-2">
              <NIcon :component="TrophyOutline" class="text-warning" />
              <span class="font-display text-lg font-bold text-text-primary">
                {{ resolveDifficultyLabel(diploma.course.difficulty, t) }}
              </span>
            </div>
            <span class="mt-1 font-condensed text-xs text-text-secondary">
              {{ t('features.trainingCenter.diploma.sparringBotLabel') }}:
              <strong class="text-text-primary">{{ ENGINE_NAMES[diploma.course.bot_engine] }}</strong>
            </span>
          </div>

          <!-- Course Horizon -->
          <div class="flex flex-col justify-between">
            <span class="font-condensed text-[11px] font-bold tracking-wider text-text-secondary uppercase">
              {{ t('features.trainingCenter.diploma.courseFormatLabel') }}
            </span>
            <div class="mt-1 font-display text-lg font-bold text-text-primary">
              {{
                t('features.trainingCenter.course.durationDays', {
                  days: diploma.course.duration_days,
                })
              }}
            </div>
            <span class="mt-1 font-condensed text-xs text-success">
              {{
                t('features.trainingCenter.diploma.cardCompletedIn', {
                  duration: formatElapsedDuration(diploma.elapsed_duration_sec, t),
                })
              }}
            </span>
          </div>
        </section>

        <!-- Primary KPI Bento Grid -->
        <section class="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- 1. Quota Solved -->
          <div class="rounded-lg border border-border bg-elevated p-4 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs text-text-secondary uppercase font-condensed">
              <span>{{ t('features.trainingCenter.diploma.kpiQuotaTitle') }}</span>
              <NIcon :component="CheckmarkCircleOutline" class="text-success text-base" />
            </div>
            <div class="mt-2 font-condensed text-2xl font-bold text-success">
              {{ diploma.course.solved_puzzles }} / {{ diploma.course.target_puzzles }}
            </div>
            <div class="mt-1 font-condensed text-xs text-text-secondary">
              {{
                t('features.trainingCenter.diploma.kpiQuotaSub', {
                  attempts: diploma.total_attempts,
                  fails: diploma.course.failed_puzzles,
                })
              }}
            </div>
          </div>

          <!-- 2. Course Accuracy -->
          <div class="rounded-lg border border-border bg-elevated p-4 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs text-text-secondary uppercase font-condensed">
              <span>{{ t('features.trainingCenter.diploma.kpiAccuracyTitle') }}</span>
              <NIcon :component="SparklesOutline" class="text-neon-cyan text-base" />
            </div>
            <div class="mt-2 font-condensed text-2xl font-bold text-neon-cyan">
              {{ diploma.accuracy_percent }}%
            </div>
            <div class="mt-1 font-condensed text-xs text-text-secondary">
              {{
                t('features.trainingCenter.diploma.kpiAccuracySub', {
                  solved: diploma.course.solved_puzzles,
                  attempts: diploma.total_attempts,
                })
              }}
            </div>
          </div>

          <!-- 3. Sprint Duration -->
          <div class="rounded-lg border border-border bg-elevated p-4 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs text-text-secondary uppercase font-condensed">
              <span>{{ t('features.trainingCenter.diploma.kpiSprintTitle') }}</span>
              <NIcon :component="TimeOutline" class="text-warning text-base" />
            </div>
            <div class="mt-2 font-condensed text-2xl font-bold text-warning">
              {{ formatElapsedDuration(diploma.elapsed_duration_sec, t) }}
            </div>
            <div class="mt-1 font-condensed text-xs text-text-secondary">
              {{
                t('features.trainingCenter.diploma.kpiSprintSub', {
                  days: diploma.course.duration_days,
                })
              }}
            </div>
          </div>

          <!-- 4. Glicko-2 Rating & Delta -->
          <div class="rounded-lg border border-border bg-elevated p-4 flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs text-text-secondary uppercase font-condensed">
              <span>{{ t('features.trainingCenter.diploma.kpiRatingTitle') }}</span>
              <NIcon :component="FlashOutline" class="text-neon-purple text-base" />
            </div>
            <template
              v-if="
                diploma.summary.has_detailed_telemetry &&
                diploma.summary.rating_start !== undefined &&
                diploma.summary.rating_end !== undefined
              "
            >
              <div class="mt-2 flex items-baseline gap-2 font-condensed">
                <span class="text-2xl font-bold text-text-primary">
                  {{ Math.round(diploma.summary.rating_end) }}
                </span>
                <span
                  class="text-sm font-bold"
                  :class="
                    (diploma.summary.rating_delta ?? 0) >= 0 ? 'text-success' : 'text-danger'
                  "
                >
                  ({{ formatDelta(diploma.summary.rating_delta) }})
                </span>
              </div>
              <div class="mt-1 font-condensed text-xs text-text-secondary">
                {{
                  t('features.trainingCenter.diploma.kpiRatingDeltaSub', {
                    start: Math.round(diploma.summary.rating_start),
                    end: Math.round(diploma.summary.rating_end),
                  })
                }}
              </div>
            </template>
            <template v-else>
              <div class="mt-2 font-condensed text-2xl font-bold text-text-primary">
                {{ Math.round(diploma.current_global_rating) }}
              </div>
              <div class="mt-1 font-condensed text-xs text-text-secondary">
                {{ t('features.trainingCenter.diploma.kpiRatingCurrentSub') }}
              </div>
            </template>
          </div>
        </section>

        <!-- Secondary Telemetry Row (Pure Board Time & Woodpecker, if recorded in summary_json) -->
        <section
          v-if="diploma.summary.has_detailed_telemetry && (diploma.summary.total_time_ms ?? 0) > 0"
          class="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2"
        >
          <div class="rounded-lg border border-border bg-void/60 p-4 flex items-center justify-between">
            <div>
              <div class="text-xs font-condensed uppercase text-text-secondary">
                {{ t('features.trainingCenter.diploma.kpiBoardTimeTitle') }}
              </div>
              <div class="mt-0.5 text-xs font-condensed text-text-secondary">
                {{
                  t('features.trainingCenter.diploma.kpiBoardTimeSub', {
                    avg: avgPuzzleTimeText,
                  })
                }}
              </div>
            </div>
            <div class="font-condensed text-xl font-bold text-neon-cyan">
              {{ formatBoardTimeMs(diploma.summary.total_time_ms) }}
            </div>
          </div>

          <div class="rounded-lg border border-border bg-void/60 p-4 flex items-center justify-between">
            <div>
              <div class="text-xs font-condensed uppercase text-text-secondary">
                {{ t('features.trainingCenter.diploma.kpiWoodpeckerTitle') }}
              </div>
              <div class="mt-0.5 text-xs font-condensed text-text-secondary">
                {{
                  t('features.trainingCenter.diploma.kpiWoodpeckerSub', {
                    queued: diploma.summary.woodpecker_queued ?? 0,
                    graduated: diploma.summary.woodpecker_graduated ?? 0,
                  })
                }}
              </div>
            </div>
            <div class="font-condensed text-xl font-bold text-neon-purple">
              3/3: {{ diploma.summary.woodpecker_graduated ?? 0 }}
            </div>
          </div>
        </section>

        <!-- Detailed Scope Breakdown (when present in summary_json) -->
        <section
          v-if="scopeSections.length > 0"
          class="mt-6 rounded-lg border border-border bg-void/50 p-5 space-y-5"
        >
          <h2 class="font-display text-sm font-bold tracking-wider text-text-primary uppercase border-b border-border pb-2.5">
            {{ t('features.trainingCenter.diploma.scopesSectionTitle') }}
          </h2>

          <div
            v-for="section in scopeSections"
            :key="section.id"
            class="space-y-2.5"
          >
            <h3 class="font-condensed text-xs font-bold tracking-wider text-neon-cyan uppercase">
              {{ section.title }}
            </h3>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div
                v-for="item in section.items"
                :key="`${item.group}:${item.key}`"
                class="rounded border border-border bg-surface p-2.5 flex flex-col gap-1.5"
              >
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-medium text-text-primary truncate">
                    {{ item.label }}
                  </span>
                  <span class="font-condensed text-text-secondary shrink-0">
                    {{
                      t('features.trainingCenter.diploma.scopeSolvedRatio', {
                        solved: item.solved_count,
                        total: item.total,
                        pct: item.accuracyPct,
                      })
                    }}
                  </span>
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-sm bg-elevated">
                  <div
                    class="h-full transition-all"
                    :class="
                      item.accuracyPct >= 85
                        ? 'bg-success'
                        : item.accuracyPct >= 65
                          ? 'bg-neon-cyan'
                          : 'bg-warning'
                    "
                    :style="{ width: `${item.accuracyPct}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Certificate Footer: Timestamps & Verification Stamp -->
        <footer
          class="mt-6 flex flex-col justify-between gap-4 border-t border-border pt-5 sm:flex-row sm:items-center"
        >
          <div class="flex flex-wrap items-center gap-5 font-condensed text-xs text-text-secondary">
            <div class="flex items-center gap-1.5">
              <NIcon :component="CalendarOutline" class="text-neon-cyan" />
              <span>{{ t('features.trainingCenter.diploma.timelineStart') }}:</span>
              <strong class="text-text-primary">{{ formatDateTime(diploma.course.started_at) }}</strong>
            </div>
            <div class="flex items-center gap-1.5">
              <NIcon :component="CheckmarkCircleOutline" class="text-success" />
              <span>{{ t('features.trainingCenter.diploma.timelineFinish') }}:</span>
              <strong class="text-text-primary">{{ formatDateTime(diploma.course.completed_at) }}</strong>
            </div>
          </div>

          <div class="font-condensed text-[11px] font-bold tracking-widest text-neon-purple uppercase">
            {{ t('features.trainingCenter.diploma.verifiedStamp') }}
          </div>
        </footer>
      </article>

      <!-- Bottom Call-to-Action Strip -->
      <div class="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row">
        <div class="text-sm text-text-secondary">
          {{ t('features.trainingCenter.subtitle') }}
        </div>
        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <NButton secondary @click="handleCopyDiplomaLink">
            <template #icon>
              <NIcon :component="isCopied ? CheckmarkCircleOutline : ShareSocialOutline" />
            </template>
            {{
              isCopied
                ? t('features.trainingCenter.diploma.linkCopied')
                : t('features.trainingCenter.diploma.copyDiplomaLinkBtn')
            }}
          </NButton>
          <NButton type="primary" @click="handleOpenTrainingCenter">
            {{ t('features.trainingCenter.diploma.ctaTrainTooBtn') }}
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>

