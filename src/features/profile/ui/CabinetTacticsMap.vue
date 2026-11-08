<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import { CompassOutline, FlashOutline, LayersOutline } from '@vicons/ionicons5'
import {
  TACTICS_MOTIF_GROUPS,
  resolveScopeLabel,
  type ScopeStatDTO,
  type TacticalMotifAnalyticsDTO,
  type TacticsCabinetMapDTO,
  type TacticsMotifGroup,
} from '@/entities/training'

const props = defineProps<{
  mapData: TacticsCabinetMapDTO
  gateThreshold: number
}>()

const emit = defineEmits<{
  trainScope: [
    payload: {
      focusGroup: string
      focusKey: string
    },
  ]
}>()

const { t, te } = useI18n()

type SortMode = 'weakest' | 'blind_spots' | 'strongest'

const sortMode = ref<SortMode>('weakest')
const activeContour = ref<TacticsMotifGroup>('geometry')

const totalAttempts = (stat: ScopeStatDTO): number => stat.solved_count + stat.failed_count

const activeMotifList = computed<TacticalMotifAnalyticsDTO[]>(() => {
  const raw = props.mapData.motif_contours[activeContour.value] ?? []
  const list = [...raw]
  if (sortMode.value === 'weakest') {
    return list.sort((a, b) => a.motif.rating - b.motif.rating)
  }
  if (sortMode.value === 'strongest') {
    return list.sort((a, b) => b.motif.rating - a.motif.rating)
  }
  return list.sort((a, b) => totalAttempts(a.motif) - totalAttempts(b.motif))
})

interface StructuralSection {
  id: string
  focusGroup: string
  titleKey: string
  items: ScopeStatDTO[]
}

const structuralSections = computed<StructuralSection[]>(() => [
  {
    id: 'phase',
    focusGroup: 'phase',
    titleKey: 'features.trainingCenter.warmup.focusGroups.phase',
    items: props.mapData.phases,
  },
  {
    id: 'length',
    focusGroup: 'length',
    titleKey: 'features.trainingCenter.warmup.focusGroups.length',
    items: props.mapData.lengths,
  },
  {
    id: 'goal',
    focusGroup: 'goal',
    titleKey: 'features.trainingCenter.warmup.focusGroups.goal',
    items: props.mapData.goals,
  },
  {
    id: 'cognitive',
    focusGroup: 'cognitive',
    titleKey: 'features.trainingCenter.warmup.focusGroups.cognitive',
    items: props.mapData.cognitive,
  },
  {
    id: 'master_game',
    focusGroup: 'master_game',
    titleKey: 'features.trainingCenter.warmup.focusGroups.master_game',
    items: props.mapData.master_game,
  },
])

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
} {
  const attempts = totalAttempts(stat)
  if (attempts === 0) {
    return {
      barClass: 'bg-border-hover',
      badgeClass: 'border-border bg-elevated text-text-disabled',
    }
  }
  if (stat.rating >= props.gateThreshold && stat.ema_accuracy >= 0.65) {
    return {
      barClass: 'bg-success',
      badgeClass: 'border-success/40 bg-success/10 text-success',
    }
  }
  if (stat.rating < props.gateThreshold - 80 || stat.ema_accuracy < 0.5) {
    return {
      barClass: 'bg-danger',
      badgeClass: 'border-danger/40 bg-danger/10 text-danger',
    }
  }
  return {
    barClass: 'bg-warning',
    badgeClass: 'border-warning/40 bg-warning/10 text-warning',
  }
}
</script>

<template>
  <section class="rounded-xl border border-border bg-surface p-5 shadow-md">
    <!-- Top Header & Sort Controls -->
    <div class="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center">
      <div>
        <div class="flex items-center gap-2">
          <NIcon :component="LayersOutline" class="text-lg text-text-secondary" />
          <h2 class="font-display text-lg font-bold tracking-wider text-text-primary uppercase">
            {{ t('pages.userCabinet.map.tacticsTitle') }}
          </h2>
        </div>
        <p class="mt-0.5 text-xs text-text-secondary">
          {{ t('pages.userCabinet.map.tacticsSubtitle', { gate: gateThreshold }) }}
        </p>
      </div>

      <!-- Sort Selector -->
      <div class="inline-flex rounded-lg border border-border bg-elevated p-1">
        <button
          type="button"
          class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
          :class="
            sortMode === 'weakest'
              ? 'bg-surface text-text-primary border border-border-hover shadow-xs'
              : 'text-text-secondary hover:text-text-primary border border-transparent'
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
              ? 'bg-surface text-text-primary border border-border-hover shadow-xs'
              : 'text-text-secondary hover:text-text-primary border border-transparent'
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
              ? 'bg-surface text-text-primary border border-border-hover shadow-xs'
              : 'text-text-secondary hover:text-text-primary border border-transparent'
          "
          @click="sortMode = 'strongest'"
        >
          {{ t('pages.userCabinet.map.sortStrongest') }}
        </button>
      </div>
    </div>

    <!-- Main 2-Column Split: Left Structural Compass + Right 4 Motif Contours -->
    <div class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
      <!-- Left Column: Structural Compass (Phases, Lengths, Goals, Cognitive, Master Game) -->
      <div class="space-y-4 rounded-xl border border-border bg-canvas p-4 lg:col-span-5">
        <div class="flex items-center justify-between border-b border-border pb-2.5">
          <div class="flex items-center gap-2">
            <NIcon :component="CompassOutline" class="text-base text-accent" />
            <span class="text-xs font-bold tracking-wider text-text-primary uppercase">
              {{ t('pages.userCabinet.map.structuralCompass') }}
            </span>
          </div>
          <span class="font-condensed text-xs text-text-disabled">
            {{ t('pages.userCabinet.map.gateMarkerLabel', { gate: gateThreshold }) }}
          </span>
        </div>

        <div v-for="section in structuralSections" :key="section.id" class="space-y-2">
          <div class="text-[11px] font-bold tracking-wider text-text-secondary uppercase">
            {{ t(section.titleKey) }}
          </div>

          <div class="space-y-2">
            <div
              v-for="stat in section.items"
              :key="`${section.id}-${stat.key}`"
              class="rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-border-hover"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="truncate text-xs font-bold text-text-primary">
                    {{ resolveScopeLabel(section.focusGroup, stat.key, t, te) }}
                  </span>
                  <span
                    class="rounded border px-1.5 py-0.5 font-condensed text-[10px] font-bold"
                    :class="resolveStatusSemanticClass(stat).badgeClass"
                  >
                    {{ Math.round(stat.ema_accuracy * 100) }}%
                  </span>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <span class="font-condensed text-sm font-bold text-text-primary">
                    {{ Math.round(stat.rating) }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center gap-1 rounded border border-brand/40 bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand transition-colors hover:bg-brand/20"
                    @click="
                      emit('trainScope', {
                        focusGroup: section.focusGroup,
                        focusKey: stat.key,
                      })
                    "
                  >
                    <NIcon :component="FlashOutline" />
                    {{ t('pages.userCabinet.map.trainShort') }}
                  </button>
                </div>
              </div>

              <!-- Horizontal Bullet-Bar -->
              <div class="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="resolveStatusSemanticClass(stat).barClass"
                  :style="{ width: `${bulletFillPercent(stat.rating)}%` }"
                />
                <div
                  class="absolute top-0 bottom-0 w-0.5 bg-text-primary/80"
                  :style="{ left: `${gateMarkerPercent}%` }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: 4 Combat Motif Contour Tabs -->
      <div class="rounded-xl border border-border bg-canvas p-4 lg:col-span-7">
        <!-- 4 Contour Selector Tabs -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div
            v-for="contour in TACTICS_MOTIF_GROUPS"
            :key="contour"
            class="cursor-pointer rounded-lg border p-2.5 text-left transition-all flex flex-col justify-between gap-1.5"
            :class="
              activeContour === contour
                ? 'border-border-hover bg-elevated text-text-primary shadow-sm'
                : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="activeContour = contour"
          >
            <div class="text-xs font-bold uppercase truncate">
              {{ t(`features.trainingCenter.warmup.motifGroups.${contour}`) }}
            </div>
            <div class="flex items-center justify-between gap-1">
              <span class="font-condensed text-[11px] text-text-disabled">
                {{ (mapData.motif_contours[contour] ?? []).length }}
                {{ t('pages.userCabinet.map.motifsCount') }}
              </span>
              <button
                type="button"
                class="inline-flex cursor-pointer items-center gap-0.5 rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand transition-colors hover:bg-brand/20 shrink-0"
                @click.stop="
                  emit('trainScope', {
                    focusGroup: 'motif_group',
                    focusKey: contour,
                  })
                "
              >
                <NIcon :component="FlashOutline" />
                {{ t('pages.userCabinet.map.trainShort') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Motif Bullet-Bars List -->
        <div class="mt-4 space-y-2.5">
          <div
            v-for="item in activeMotifList"
            :key="item.motif.key"
            class="rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-hover"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-text-primary">
                  {{ resolveScopeLabel(activeContour, item.motif.key, t, te) }}
                </span>
                <span
                  class="rounded border px-1.5 py-0.5 font-condensed text-[11px] font-bold"
                  :class="resolveStatusSemanticClass(item.motif).badgeClass"
                >
                  EMA {{ Math.round(item.motif.ema_accuracy * 100) }}%
                </span>
                <span class="font-condensed text-xs text-text-secondary">
                  {{ totalAttempts(item.motif) }} {{ t('pages.userCabinet.map.attemptsShort') }}
                </span>
              </div>

              <div class="flex items-center gap-2.5">
                <span class="font-condensed text-base font-bold text-text-primary">
                  {{ Math.round(item.motif.rating) }}
                  <span class="text-xs font-normal text-text-disabled">
                    ±{{ Math.round(item.motif.rd) }}
                  </span>
                </span>

                <button
                  type="button"
                  class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand transition-colors hover:bg-brand/20"
                  @click="
                    emit('trainScope', {
                      focusGroup: 'motif',
                      focusKey: item.motif.key,
                    })
                  "
                >
                  <NIcon :component="FlashOutline" />
                  {{ t('pages.userCabinet.map.trainShort') }}
                </button>
              </div>
            </div>

            <!-- Horizontal Bullet-Bar -->
            <div class="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="resolveStatusSemanticClass(item.motif).barClass"
                :style="{ width: `${bulletFillPercent(item.motif.rating)}%` }"
              />
              <div
                class="absolute top-0 bottom-0 w-0.5 bg-text-primary/80"
                :style="{ left: `${gateMarkerPercent}%` }"
              />
            </div>

            <!-- Short Horizon (1-2m) vs Deep Horizon (3+m) Split Badges -->
            <div
              v-if="item.short_horizon || item.deep_horizon"
              class="mt-2 flex flex-wrap items-center gap-3 font-condensed text-xs text-text-secondary"
            >
              <span v-if="item.short_horizon" class="inline-flex items-center gap-1">
                <span class="text-text-disabled">{{ t('pages.userCabinet.map.shortHorizon') }}:</span>
                <strong class="text-text-primary">{{ Math.round(item.short_horizon.rating) }}</strong>
                <span>({{ Math.round(item.short_horizon.ema_accuracy * 100) }}%)</span>
              </span>
              <span v-if="item.deep_horizon" class="inline-flex items-center gap-1">
                <span class="text-text-disabled">{{ t('pages.userCabinet.map.deepHorizon') }}:</span>
                <strong class="text-text-primary">{{ Math.round(item.deep_horizon.rating) }}</strong>
                <span>({{ Math.round(item.deep_horizon.ema_accuracy * 100) }}%)</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
