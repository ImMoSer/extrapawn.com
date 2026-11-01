<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import {
  FlashOutline,
  ShieldHalfOutline,
  TrophyOutline,
  ChevronForwardOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import {
  resolveScopeLabel,
  type EndgameCabinetMapDTO,
  type EndgameClassAnalyticsDTO,
  type EndgameDomainAnalyticsDTO,
  type ScopeStatDTO,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'

const props = defineProps<{
  mapData: EndgameCabinetMapDTO
  discipline: Exclude<TrainingDiscipline, 'tactics'>
  gateThreshold: number
}>()

const emit = defineEmits<{
  trainScope: [
    payload: {
      focusGroup: string
      focusKey: string
      objective?: TrainingObjective
    },
  ]
}>()

const { t, te } = useI18n()

type SortMode = 'weakest' | 'blind_spots' | 'strongest'

const sortMode = ref<SortMode>('weakest')
const selectedDomainKey = ref<string>('')

const totalAttempts = (stat: ScopeStatDTO): number => stat.solved_count + stat.failed_count

const sortedDomains = computed<EndgameDomainAnalyticsDTO[]>(() => {
  const list = [...props.mapData.domains]
  if (sortMode.value === 'weakest') {
    return list.sort((a, b) => a.domain.rating - b.domain.rating)
  }
  if (sortMode.value === 'strongest') {
    return list.sort((a, b) => b.domain.rating - a.domain.rating)
  }
  return list.sort((a, b) => totalAttempts(a.domain) - totalAttempts(b.domain))
})

watch(
  sortedDomains,
  (domains) => {
    const first = domains[0]
    if (!first) {
      selectedDomainKey.value = ''
      return
    }
    const stillExists = domains.some((d) => d.domain.key === selectedDomainKey.value)
    if (!stillExists) {
      selectedDomainKey.value = first.domain.key
    }
  },
  { immediate: true },
)

const activeDomainEntry = computed<EndgameDomainAnalyticsDTO | null>(() => {
  return (
    props.mapData.domains.find((d) => d.domain.key === selectedDomainKey.value) ??
    sortedDomains.value[0] ??
    null
  )
})

const sortedClasses = computed<EndgameClassAnalyticsDTO[]>(() => {
  const entry = activeDomainEntry.value
  if (!entry) return []
  const list = [...entry.classes]
  if (sortMode.value === 'weakest') {
    return list.sort((a, b) => a.stat.rating - b.stat.rating)
  }
  if (sortMode.value === 'strongest') {
    return list.sort((a, b) => b.stat.rating - a.stat.rating)
  }
  return list.sort((a, b) => totalAttempts(a.stat) - totalAttempts(b.stat))
})

const winObjectiveStat = computed<ScopeStatDTO | null>(() => {
  return props.mapData.objectives?.find((o) => o.key === 'win') ?? null
})

const drawObjectiveStat = computed<ScopeStatDTO | null>(() => {
  return props.mapData.objectives?.find((o) => o.key === 'hold_draw') ?? null
})

function bulletFillPercent(rating: number): number {
  const minR = 600
  const maxR = 2600
  const clamped = Math.min(maxR, Math.max(minR, rating))
  return Math.round(((clamped - minR) / (maxR - minR)) * 100)
}

const gateMarkerPercent = computed<number>(() => {
  const minR = 600
  const maxR = 2600
  const clamped = Math.min(maxR, Math.max(minR, props.gateThreshold))
  return Math.round(((clamped - minR) / (maxR - minR)) * 100)
})

function resolveStatusSemanticClass(stat: ScopeStatDTO): {
  barClass: string
  badgeClass: string
  borderClass: string
} {
  const attempts = totalAttempts(stat)
  if (attempts === 0) {
    return {
      barClass: 'bg-border-hover',
      badgeClass: 'border-border bg-elevated text-text-disabled',
      borderClass: 'border-border',
    }
  }
  if (stat.rating >= props.gateThreshold && stat.ema_accuracy >= 0.65) {
    return {
      barClass: 'bg-success',
      badgeClass: 'border-success/40 bg-success/10 text-success',
      borderClass: 'border-success/35',
    }
  }
  if (stat.rating < props.gateThreshold - 80 || stat.ema_accuracy < 0.5) {
    return {
      barClass: 'bg-danger',
      badgeClass: 'border-danger/40 bg-danger/10 text-danger',
      borderClass: 'border-danger/35',
    }
  }
  return {
    barClass: 'bg-warning',
    badgeClass: 'border-warning/40 bg-warning/10 text-warning',
    borderClass: 'border-warning/35',
  }
}
</script>

<template>
  <section class="rounded-xl border border-border bg-surface p-5 shadow-md">
    <!-- Top Section Header & Sorting Controls -->
    <div class="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center">
      <div>
        <div class="flex items-center gap-2">
          <NIcon :component="SparklesOutline" class="text-lg text-neon-cyan" />
          <h2 class="font-display text-lg font-bold tracking-wider text-text-primary uppercase">
            {{ t('pages.userCabinet.map.endgameTitle') }}
          </h2>
        </div>
        <p class="mt-0.5 text-xs text-text-secondary">
          {{ t('pages.userCabinet.map.endgameSubtitle', { gate: gateThreshold }) }}
        </p>
      </div>

      <!-- Sort Selector -->
      <div class="inline-flex rounded-lg border border-border bg-elevated p-1">
        <button
          type="button"
          class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
          :class="
            sortMode === 'weakest'
              ? 'bg-neon-cyan/15 text-neon-cyan'
              : 'text-text-secondary hover:text-text-primary'
          "
          @click="sortMode = 'weakest'"
        >
          {{ t('pages.userCabinet.map.sortWeakest') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
          :class="
            sortMode === 'blind_spots'
              ? 'bg-neon-cyan/15 text-neon-cyan'
              : 'text-text-secondary hover:text-text-primary'
          "
          @click="sortMode = 'blind_spots'"
        >
          {{ t('pages.userCabinet.map.sortBlindSpots') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
          :class="
            sortMode === 'strongest'
              ? 'bg-neon-cyan/15 text-neon-cyan'
              : 'text-text-secondary hover:text-text-primary'
          "
          @click="sortMode = 'strongest'"
        >
          {{ t('pages.userCabinet.map.sortStrongest') }}
        </button>
      </div>
    </div>

    <!-- Global Objective Vector Bar (Theoretical Endgames Only: Win vs Hold Draw — FIDE) -->
    <div
      v-if="discipline === 'theoretical_endgames' && (winObjectiveStat || drawObjectiveStat)"
      class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      <!-- Win Vector -->
      <div
        v-if="winObjectiveStat"
        class="flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-elevated/60 p-3.5"
      >
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-success/40 bg-success/10 text-success">
            <NIcon :component="TrophyOutline" class="text-xl" />
          </div>
          <div>
            <div class="text-xs font-bold tracking-wider text-success uppercase">
              {{ t('features.trainingCenter.badges.objectiveWin') }}
            </div>
            <div class="mt-0.5 flex items-baseline gap-2">
              <span class="font-condensed text-xl font-bold text-text-primary">
                {{ Math.round(winObjectiveStat.rating) }}
              </span>
              <span class="font-condensed text-xs text-text-secondary">
                EMA {{ Math.round(winObjectiveStat.ema_accuracy * 100) }}% ·
                {{ totalAttempts(winObjectiveStat) }} {{ t('pages.userCabinet.map.attemptsShort') }}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-bold text-success transition-colors hover:bg-success/20"
          @click="emit('trainScope', { focusGroup: 'objective', focusKey: 'win', objective: 'win' })"
        >
          <NIcon :component="FlashOutline" />
          {{ t('pages.userCabinet.diagnostics.trainWarmup') }}
        </button>
      </div>

      <!-- Hold Draw — FIDE Vector -->
      <div
        v-if="drawObjectiveStat"
        class="flex items-center justify-between gap-3 rounded-xl border border-info/30 bg-elevated/60 p-3.5"
      >
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-info/40 bg-info/10 text-info">
            <NIcon :component="ShieldHalfOutline" class="text-xl" />
          </div>
          <div>
            <div class="text-xs font-bold tracking-wider text-info uppercase">
              {{ t('features.trainingCenter.badges.objectiveHoldDraw') }}
            </div>
            <div class="mt-0.5 flex items-baseline gap-2">
              <span class="font-condensed text-xl font-bold text-text-primary">
                {{ Math.round(drawObjectiveStat.rating) }}
              </span>
              <span class="font-condensed text-xs text-text-secondary">
                EMA {{ Math.round(drawObjectiveStat.ema_accuracy * 100) }}% ·
                {{ totalAttempts(drawObjectiveStat) }} {{ t('pages.userCabinet.map.attemptsShort') }}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-bold text-info transition-colors hover:bg-info/20"
          @click="
            emit('trainScope', {
              focusGroup: 'objective',
              focusKey: 'hold_draw',
              objective: 'hold_draw',
            })
          "
        >
          <NIcon :component="FlashOutline" />
          {{ t('pages.userCabinet.diagnostics.trainWarmup') }}
        </button>
      </div>
    </div>

    <!-- Main Split: Domain Cards (Left) + Concrete Classes Drill-Down (Right) -->
    <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
      <!-- Left Column: Endgame Domains -->
      <div class="space-y-2.5 lg:col-span-5">
        <div class="flex items-center justify-between px-1">
          <span class="text-xs font-bold tracking-wider text-text-secondary uppercase">
            {{ t('pages.userCabinet.map.domainsHeader') }} ({{ sortedDomains.length }})
          </span>
          <span class="font-condensed text-xs text-text-disabled">
            {{ t('pages.userCabinet.map.gateMarkerLabel', { gate: gateThreshold }) }}
          </span>
        </div>

        <div
          v-for="item in sortedDomains"
          :key="item.domain.key"
          class="group cursor-pointer rounded-xl border p-3.5 transition-all duration-150"
          :class="
            selectedDomainKey === item.domain.key
              ? 'border-neon-cyan bg-elevated shadow-sm'
              : `${resolveStatusSemanticClass(item.domain).borderClass} bg-void/60 hover:border-border-hover hover:bg-elevated/50`
          "
          @click="selectedDomainKey = item.domain.key"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="truncate text-sm font-bold text-text-primary">
                {{ resolveScopeLabel('domain', item.domain.key, t, te) }}
              </span>
              <span
                class="rounded border px-1.5 py-0.5 font-condensed text-[11px] font-bold"
                :class="resolveStatusSemanticClass(item.domain).badgeClass"
              >
                EMA {{ Math.round(item.domain.ema_accuracy * 100) }}%
              </span>
            </div>

            <div class="flex items-center gap-2">
              <span class="font-condensed text-lg font-bold text-text-primary">
                {{ Math.round(item.domain.rating) }}
              </span>
              <button
                type="button"
                class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-neon-cyan transition-colors hover:border-neon-cyan/50 hover:bg-neon-cyan/10"
                :title="t('pages.userCabinet.diagnostics.trainWarmup')"
                @click.stop="
                  emit('trainScope', {
                    focusGroup: 'domain',
                    focusKey: item.domain.key,
                  })
                "
              >
                <NIcon :component="FlashOutline" />
              </button>
              <NIcon
                :component="ChevronForwardOutline"
                class="text-sm transition-transform"
                :class="
                  selectedDomainKey === item.domain.key
                    ? 'translate-x-0.5 text-neon-cyan'
                    : 'text-text-disabled'
                "
              />
            </div>
          </div>

          <!-- Horizontal Bullet-Bar with Gate Threshold Marker -->
          <div class="relative mt-2.5 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="resolveStatusSemanticClass(item.domain).barClass"
              :style="{ width: `${bulletFillPercent(item.domain.rating)}%` }"
            />
            <div
              class="absolute top-0 bottom-0 w-0.5 bg-text-primary/80"
              :style="{ left: `${gateMarkerPercent}%` }"
            />
          </div>

          <div class="mt-1.5 flex items-center justify-between font-condensed text-[11px] text-text-secondary">
            <span>
              {{ item.classes.length }} {{ t('pages.userCabinet.map.classesCount') }}
            </span>
            <span>
              {{ item.domain.solved_count }}W / {{ item.domain.failed_count }}L ({{
                totalAttempts(item.domain)
              }})
            </span>
          </div>
        </div>
      </div>

      <!-- Right Column: Material Classes Bullet-List inside Selected Domain -->
      <div class="rounded-xl border border-border bg-void/40 p-4 lg:col-span-7">
        <template v-if="activeDomainEntry">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <span class="text-xs font-semibold tracking-wider text-neon-cyan uppercase">
                {{ t('pages.userCabinet.map.activeDomainDrilldown') }}
              </span>
              <h3 class="font-display text-base font-bold text-text-primary">
                {{ resolveScopeLabel('domain', activeDomainEntry.domain.key, t, te) }}
              </h3>
            </div>

            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 text-xs font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/20"
              @click="
                emit('trainScope', {
                  focusGroup: 'domain',
                  focusKey: activeDomainEntry.domain.key,
                })
              "
            >
              <NIcon :component="FlashOutline" />
              {{ t('pages.userCabinet.map.trainEntireDomain') }}
            </button>
          </div>

          <div class="mt-3 space-y-3">
            <div
              v-for="cls in sortedClasses"
              :key="cls.stat.key"
              class="rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-hover"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-text-primary">
                    {{ resolveScopeLabel('class', cls.stat.key, t, te) }}
                  </span>
                  <span
                    class="rounded border px-1.5 py-0.5 font-condensed text-[11px] font-bold"
                    :class="resolveStatusSemanticClass(cls.stat).badgeClass"
                  >
                    EMA {{ Math.round(cls.stat.ema_accuracy * 100) }}%
                  </span>
                  <span class="font-condensed text-xs text-text-secondary">
                    {{ totalAttempts(cls.stat) }} {{ t('pages.userCabinet.map.attemptsShort') }}
                  </span>
                </div>

                <div class="flex items-center gap-2.5">
                  <span class="font-condensed text-base font-bold text-text-primary">
                    {{ Math.round(cls.stat.rating) }}
                    <span class="text-xs font-normal text-text-disabled">
                      ±{{ Math.round(cls.stat.rd) }}
                    </span>
                  </span>

                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1 text-xs font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/20"
                    @click="
                      emit('trainScope', {
                        focusGroup: 'class',
                        focusKey: cls.stat.key,
                      })
                    "
                  >
                    <NIcon :component="FlashOutline" />
                    {{ t('pages.userCabinet.diagnostics.trainWarmup') }}
                  </button>
                </div>
              </div>

              <!-- Class Bullet Bar -->
              <div class="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-void">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="resolveStatusSemanticClass(cls.stat).barClass"
                  :style="{ width: `${bulletFillPercent(cls.stat.rating)}%` }"
                />
                <div
                  class="absolute top-0 bottom-0 w-0.5 bg-text-primary/80"
                  :style="{ left: `${gateMarkerPercent}%` }"
                />
              </div>

              <!-- Dual Inline Vector Split for Theoretical Endgames (Win vs Hold Draw) -->
              <div
                v-if="discipline === 'theoretical_endgames' && (cls.win || cls.hold_draw)"
                class="mt-2.5 grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2"
              >
                <div
                  v-if="cls.win"
                  class="flex items-center justify-between rounded-md border border-border bg-elevated/60 px-2.5 py-1.5 text-xs"
                >
                  <div class="flex items-center gap-1.5 text-success">
                    <NIcon :component="TrophyOutline" />
                    <span class="font-semibold">{{ t('features.trainingCenter.badges.objectiveWin') }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-condensed font-bold text-text-primary">
                      {{ Math.round(cls.win.rating) }}
                    </span>
                    <span class="font-condensed text-[11px] text-text-secondary">
                      ({{ Math.round(cls.win.ema_accuracy * 100) }}%)
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer rounded border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success hover:bg-success/20"
                      @click="
                        emit('trainScope', {
                          focusGroup: 'class',
                          focusKey: cls.stat.key,
                          objective: 'win',
                        })
                      "
                    >
                      {{ t('pages.userCabinet.map.trainShort') }}
                    </button>
                  </div>
                </div>

                <div
                  v-if="cls.hold_draw"
                  class="flex items-center justify-between rounded-md border border-border bg-elevated/60 px-2.5 py-1.5 text-xs"
                >
                  <div class="flex items-center gap-1.5 text-info">
                    <NIcon :component="ShieldHalfOutline" />
                    <span class="font-semibold">{{ t('features.trainingCenter.badges.objectiveHoldDraw') }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-condensed font-bold text-text-primary">
                      {{ Math.round(cls.hold_draw.rating) }}
                    </span>
                    <span class="font-condensed text-[11px] text-text-secondary">
                      ({{ Math.round(cls.hold_draw.ema_accuracy * 100) }}%)
                    </span>
                    <button
                      type="button"
                      class="cursor-pointer rounded border border-info/40 bg-info/10 px-1.5 py-0.5 text-[10px] font-bold text-info hover:bg-info/20"
                      @click="
                        emit('trainScope', {
                          focusGroup: 'class',
                          focusKey: cls.stat.key,
                          objective: 'hold_draw',
                        })
                      "
                    >
                      {{ t('pages.userCabinet.map.trainShort') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
