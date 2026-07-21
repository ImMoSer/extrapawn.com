<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LichessProfile } from '../model/lichess-games-db.store'

const props = defineProps<{
  profile: LichessProfile
}>()

const { t } = useI18n()

interface PerfRow {
  speed: string
  games: number
  rating: number
  prov?: boolean
}

const perfsList = computed<PerfRow[]>(() => {
  const result: PerfRow[] = []
  const perfKeys = ['bullet', 'blitz', 'rapid', 'classical'] as const

  for (const key of perfKeys) {
    const data = props.profile.perfs[key]
    result.push({
      speed: key.charAt(0).toUpperCase() + key.slice(1),
      games: data?.games || 0,
      rating: data?.rating || 1500,
      prov: data?.prov
    })
  }
  return result
})

const totalPerfsGames = computed(() => {
  return perfsList.value.reduce((sum, item) => sum + item.games, 0)
})

const wdlGlobalPercentage = computed(() => {
  const count = props.profile.count
  if (!count) return { win: 0, draw: 0, loss: 0 }
  const total = (count.win || 0) + (count.draw || 0) + (count.loss || 0)
  if (total === 0) return { win: 0, draw: 0, loss: 0 }
  return {
    win: ((count.win || 0) / total) * 100,
    draw: ((count.draw || 0) / total) * 100,
    loss: ((count.loss || 0) / total) * 100
  }
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <div class="flex flex-col gap-3.5">
      <div v-for="perf in perfsList" :key="perf.speed" class="flex items-center gap-4">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">{{ perf.speed }}:</span>

        <div class="grow">
          <!-- Einfarbiger Balken zur Darstellung der relativen Spieleverteilung -->
          <div v-if="perf.games > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success/60 transition-all" :style="{ width: (totalPerfsGames > 0 ? (perf.games / totalPerfsGames) * 100 : 0) + '%' }">
            </div>
          </div>
          <div v-else class="h-5 text-xs italic text-text-disabled flex items-center">
            {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>

        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span class="text-warning font-semibold" v-if="perf.games > 0">
            {{ perf.rating }}{{ perf.prov ? '?' : '' }} {{ t('features.lichessGamesDb.statistics.avgRating') }}
          </span>
          <span>
            ({{ t('features.lichessGamesDb.statistics.gamesCount', { count: perf.games }) }})
          </span>
        </div>
      </div>

      <!-- Total row -->
      <div class="flex items-center gap-4 border-t border-dashed border-border pt-2.5 mt-0.5">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">{{ t('features.lichessGamesDb.statistics.total') }}:</span>

        <div class="grow">
          <!-- WDL Bar for Total Profile Stats -->
          <div v-if="props.profile.count && ((props.profile.count.win || 0) + (props.profile.count.draw || 0) + (props.profile.count.loss || 0)) > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: wdlGlobalPercentage.win + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="wdlGlobalPercentage.win > 15">{{ Math.round(wdlGlobalPercentage.win) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: wdlGlobalPercentage.draw + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="wdlGlobalPercentage.draw > 15">{{ Math.round(wdlGlobalPercentage.draw) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: wdlGlobalPercentage.loss + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="wdlGlobalPercentage.loss > 15">{{ Math.round(wdlGlobalPercentage.loss) }}% L</span>
            </div>
          </div>
        </div>

        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed font-bold text-text-primary">
          <span>
            {{ t('features.lichessGamesDb.statistics.gamesCount', { count: props.profile.count?.all || 0 }) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Unified WDL Labels -->
    <div v-if="props.profile.count && ((props.profile.count.win || 0) + (props.profile.count.draw || 0) + (props.profile.count.loss || 0)) > 0" class="flex justify-center gap-5 mt-2 text-xs text-text-secondary">
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-success"></span>{{ t('features.lichessGamesDb.statistics.wins') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-text-disabled"></span>{{ t('features.lichessGamesDb.statistics.draws') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-danger"></span>{{ t('features.lichessGamesDb.statistics.losses') }}
      </span>
    </div>
  </div>
</template>
