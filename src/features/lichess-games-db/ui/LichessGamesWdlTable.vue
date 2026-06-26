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
  <div class="section-container">
    <div class="speed-wdl-table">
      <div v-for="perf in props.stats.perfStats" :key="perf.speed" class="speed-row">
        <span class="speed-name">{{ perf.speed }}:</span>

        <div class="wdl-bar-container row-bar">
          <div v-if="perf.gamesCount > 0" class="wdl-bar">
            <div class="wdl-segment win" :style="{ width: perf.winRate + '%' }">
              <span class="wdl-val" v-if="perf.winRate > 15">{{ Math.round(perf.winRate) }}% W</span>
            </div>
            <div class="wdl-segment draw" :style="{ width: perf.drawRate + '%' }">
              <span class="wdl-val" v-if="perf.drawRate > 15">{{ Math.round(perf.drawRate) }}% D</span>
            </div>
            <div class="wdl-segment loss" :style="{ width: perf.lossRate + '%' }">
              <span class="wdl-val" v-if="perf.lossRate > 15">{{ Math.round(perf.lossRate) }}% L</span>
            </div>
          </div>
          <div v-else class="empty-perf-bar">
            {{ $t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>

        <div class="speed-meta">
          <span class="speed-rating" v-if="perf.gamesCount > 0">
            {{ perf.avgRating }} {{ $t('features.lichessGamesDb.statistics.avgRating') }}
          </span>
          <span class="speed-games-count">
            ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: perf.gamesCount }) }})
          </span>
        </div>
      </div>

      <!-- Total row -->
      <div class="speed-row total-row">
        <span class="speed-name">{{ $t('features.lichessGamesDb.statistics.total') }}:</span>

        <div class="wdl-bar-container row-bar">
          <div v-if="props.stats.gamesCount > 0" class="wdl-bar">
            <div class="wdl-segment win" :style="{ width: wdlGlobalPercentage.win + '%' }">
              <span class="wdl-val" v-if="wdlGlobalPercentage.win > 15">
                {{ Math.round(wdlGlobalPercentage.win) }}% W
              </span>
            </div>
            <div class="wdl-segment draw" :style="{ width: wdlGlobalPercentage.draw + '%' }">
              <span class="wdl-val" v-if="wdlGlobalPercentage.draw > 15">
                {{ Math.round(wdlGlobalPercentage.draw) }}% D
              </span>
            </div>
            <div class="wdl-segment loss" :style="{ width: wdlGlobalPercentage.loss + '%' }">
              <span class="wdl-val" v-if="wdlGlobalPercentage.loss > 15">
                {{ Math.round(wdlGlobalPercentage.loss) }}% L
              </span>
            </div>
          </div>
        </div>

        <div class="speed-meta">
          <span class="speed-rating" v-if="props.stats.gamesCount > 0">
            {{ totalAvgRating }} {{ $t('features.lichessGamesDb.statistics.avgRating') }}
          </span>
          <span class="speed-games-count">
            ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: props.stats.gamesCount }) }})
          </span>
        </div>
      </div>
    </div>

    <!-- Unified WDL Labels -->
    <div class="wdl-labels">
      <span class="wdl-label-item win-label">
        <span class="dot"></span>{{ $t('features.lichessGamesDb.statistics.wins') }}
      </span>
      <span class="wdl-label-item draw-label">
        <span class="dot"></span>{{ $t('features.lichessGamesDb.statistics.draws') }}
      </span>
      <span class="wdl-label-item loss-label">
        <span class="dot"></span>{{ $t('features.lichessGamesDb.statistics.losses') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.section-container {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Speed Table Layout in einer Zeile */
.speed-wdl-table {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.speed-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.speed-name {
  width: 75px;
  flex-shrink: 0;
  font-weight: 700;
  color: #fff;
}

.wdl-bar-container {
  flex-grow: 1;
}

.speed-meta {
  width: 125px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.total-row {
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  padding-top: 10px;
  margin-top: 2px;
}

.speed-rating {
  color: #f39c12;
  font-weight: 600;
}

.empty-perf-bar {
  height: 20px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  font-style: italic;
}

/* WDL Progress Bars */
.wdl-bar {
  display: flex;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.wdl-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.4s ease;
}

.wdl-segment.win {
  background: #18a058;
}

.wdl-segment.draw {
  background: rgba(255, 255, 255, 0.2);
}

.wdl-segment.loss {
  background: #d03050;
}

.wdl-val {
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  white-space: nowrap;
}

.wdl-labels {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 4px;
  font-size: 11px;
}

.wdl-label-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.6);
}

.wdl-label-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.win-label .dot { background: #18a058; }
.draw-label .dot { background: rgba(255, 255, 255, 0.4); }
.loss-label .dot { background: #d03050; }
</style>
