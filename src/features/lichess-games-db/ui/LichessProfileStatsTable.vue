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
  <div class="lichess-profile-stats-table">
    <div class="speed-wdl-table">
      <div v-for="perf in perfsList" :key="perf.speed" class="speed-row">
        <span class="speed-name">{{ perf.speed }}:</span>

        <div class="wdl-bar-container row-bar">
          <!-- Einfarbiger Balken zur Darstellung der relativen Spieleverteilung -->
          <div v-if="perf.games > 0" class="wdl-bar">
            <div class="wdl-segment count-bar" :style="{ width: (totalPerfsGames > 0 ? (perf.games / totalPerfsGames) * 100 : 0) + '%' }">
            </div>
          </div>
          <div v-else class="empty-perf-bar">
            {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>

        <div class="speed-meta">
          <span class="speed-rating" v-if="perf.games > 0">
            {{ perf.rating }}{{ perf.prov ? '?' : '' }} {{ t('features.lichessGamesDb.statistics.avgRating') }}
          </span>
          <span class="speed-games-count">
            ({{ t('features.lichessGamesDb.statistics.gamesCount', { count: perf.games }) }})
          </span>
        </div>
      </div>

      <!-- Total row -->
      <div class="speed-row total-row">
        <span class="speed-name">{{ t('features.lichessGamesDb.statistics.total') }}:</span>

        <div class="wdl-bar-container row-bar">
          <!-- WDL Bar for Total Profile Stats -->
          <div v-if="props.profile.count && ((props.profile.count.win || 0) + (props.profile.count.draw || 0) + (props.profile.count.loss || 0)) > 0" class="wdl-bar">
            <div class="wdl-segment win" :style="{ width: wdlGlobalPercentage.win + '%' }">
              <span class="wdl-val" v-if="wdlGlobalPercentage.win > 15">{{ Math.round(wdlGlobalPercentage.win) }}% W</span>
            </div>
            <div class="wdl-segment draw" :style="{ width: wdlGlobalPercentage.draw + '%' }">
              <span class="wdl-val" v-if="wdlGlobalPercentage.draw > 15">{{ Math.round(wdlGlobalPercentage.draw) }}% D</span>
            </div>
            <div class="wdl-segment loss" :style="{ width: wdlGlobalPercentage.loss + '%' }">
              <span class="wdl-val" v-if="wdlGlobalPercentage.loss > 15">{{ Math.round(wdlGlobalPercentage.loss) }}% L</span>
            </div>
          </div>
        </div>

        <div class="speed-meta">
          <span class="speed-games-count" style="font-weight: 700; color: #fff;">
            {{ t('features.lichessGamesDb.statistics.gamesCount', { count: props.profile.count?.all || 0 }) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Unified WDL Labels -->
    <div v-if="props.profile.count && ((props.profile.count.win || 0) + (props.profile.count.draw || 0) + (props.profile.count.loss || 0)) > 0" class="wdl-labels">
      <span class="wdl-label-item win-label">
        <span class="dot"></span>{{ t('features.lichessGamesDb.statistics.wins') }}
      </span>
      <span class="wdl-label-item draw-label">
        <span class="dot"></span>{{ t('features.lichessGamesDb.statistics.draws') }}
      </span>
      <span class="wdl-label-item loss-label">
        <span class="dot"></span>{{ t('features.lichessGamesDb.statistics.losses') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.lichess-profile-stats-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

.speed-games-count {
  color: rgba(255, 255, 255, 0.6);
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

.wdl-segment.count-bar {
  background: #18a058;
  opacity: 0.6;
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
  margin-top: 8px;
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
