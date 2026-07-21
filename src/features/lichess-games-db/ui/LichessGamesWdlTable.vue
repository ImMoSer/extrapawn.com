<script setup lang="ts">
import { computed } from 'vue'
import type { TabStats } from '../model/lichess-games-db.store'

const props = defineProps<{
  stats: TabStats
}>()

const wdlGlobalPercentage = computed(() => {
  if (!props.stats || props.stats.gamesCount === 0) return { win: 0, draw: 0, loss: 0 }
  const total = props.stats.gamesCount
  return {
    win: (props.stats.wins / total) * 100,
    draw: (props.stats.draws / total) * 100,
    loss: (props.stats.losses / total) * 100
  }
})

const totalAvgRating = computed(() => {
  if (!props.stats || !props.stats.perfStats) return 0
  let totalRatingSum = 0
  let totalGamesCount = 0
  for (const perf of props.stats.perfStats) {
    if (perf.gamesCount > 0) {
      totalRatingSum += perf.avgRating * perf.gamesCount
      totalGamesCount += perf.gamesCount
    }
  }
  return totalGamesCount > 0 ? Math.round(totalRatingSum / totalGamesCount) : 0
})
</script>

<template>
  <div class="mb-5 flex flex-col gap-3">
    <div class="flex flex-col gap-3.5">
      <div v-for="perf in props.stats.perfStats" :key="perf.speed" class="flex items-center gap-4">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">{{ perf.speed }}:</span>

        <div class="grow">
          <div v-if="perf.gamesCount > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: perf.winRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="perf.winRate > 15">{{ Math.round(perf.winRate) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: perf.drawRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="perf.drawRate > 15">{{ Math.round(perf.drawRate) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: perf.lossRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="perf.lossRate > 15">{{ Math.round(perf.lossRate) }}% L</span>
            </div>
          </div>
          <div v-else class="h-5 text-xs italic text-text-disabled flex items-center">
            {{ $t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>

        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span class="text-warning font-semibold" v-if="perf.gamesCount > 0">
            {{ perf.avgRating }} {{ $t('features.lichessGamesDb.statistics.avgRating') }}
          </span>
          <span>
            ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: perf.gamesCount }) }})
          </span>
        </div>
      </div>

      <!-- Total row -->
      <div class="flex items-center gap-4 border-t border-dashed border-border pt-2.5 mt-0.5">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">{{ $t('features.lichessGamesDb.statistics.total') }}:</span>

        <div class="grow">
          <div v-if="props.stats.gamesCount > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: wdlGlobalPercentage.win + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="wdlGlobalPercentage.win > 15">
                {{ Math.round(wdlGlobalPercentage.win) }}% W
              </span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: wdlGlobalPercentage.draw + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="wdlGlobalPercentage.draw > 15">
                {{ Math.round(wdlGlobalPercentage.draw) }}% D
              </span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: wdlGlobalPercentage.loss + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="wdlGlobalPercentage.loss > 15">
                {{ Math.round(wdlGlobalPercentage.loss) }}% L
              </span>
            </div>
          </div>
        </div>

        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span class="text-warning font-semibold" v-if="props.stats.gamesCount > 0">
            {{ totalAvgRating }} {{ $t('features.lichessGamesDb.statistics.avgRating') }}
          </span>
          <span>
            ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: props.stats.gamesCount }) }})
          </span>
        </div>
      </div>
    </div>

    <!-- Unified WDL Labels -->
    <div class="flex justify-center gap-5 mt-1 text-xs text-text-secondary">
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-success"></span>{{ $t('features.lichessGamesDb.statistics.wins') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-text-disabled"></span>{{ $t('features.lichessGamesDb.statistics.draws') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-danger"></span>{{ $t('features.lichessGamesDb.statistics.losses') }}
      </span>
    </div>
  </div>
</template>
