<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { LichessActivityItem } from '../model/lichess-games-db.store'
import { NTabs, NTab } from 'naive-ui'

const props = defineProps<{
  activity: LichessActivityItem[]
}>()

const { t } = useI18n()
const activeTab = ref<'today' | 'week'>('today')

interface PerfStats {
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number
  lossRate: number
  drawRate: number
}

interface PeriodStats {
  bullet: PerfStats
  blitz: PerfStats
  rapid: PerfStats
  classical: PerfStats
  total: PerfStats
}

const statsForPeriod = computed(() => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOf7DaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000

  const getStats = (minTimestamp: number): PeriodStats => {
    const createEmptyStats = (): PerfStats => ({
      games: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      lossRate: 0,
      drawRate: 0
    })

    const res: PeriodStats = {
      bullet: createEmptyStats(),
      blitz: createEmptyStats(),
      rapid: createEmptyStats(),
      classical: createEmptyStats(),
      total: createEmptyStats()
    }

    for (const item of props.activity) {
      if (!item.interval || !item.games) continue
      if (item.interval.start >= minTimestamp) {
        const perfKeys = ['bullet', 'blitz', 'rapid', 'classical'] as const
        for (const key of perfKeys) {
          const gamesData = item.games[key]
          if (gamesData) {
            const nb = (gamesData.win || 0) + (gamesData.loss || 0) + (gamesData.draw || 0)
            res[key].games += nb
            res[key].wins += gamesData.win || 0
            res[key].losses += gamesData.loss || 0
            res[key].draws += gamesData.draw || 0

            res.total.games += nb
            res.total.wins += gamesData.win || 0
            res.total.losses += gamesData.loss || 0
            res.total.draws += gamesData.draw || 0
          }
        }
      }
    }

    // Rates berechnen
    const calculateRates = (stat: PerfStats) => {
      if (stat.games > 0) {
        stat.winRate = (stat.wins / stat.games) * 100
        stat.lossRate = (stat.losses / stat.games) * 100
        stat.drawRate = (stat.draws / stat.games) * 100
      }
    }

    calculateRates(res.bullet)
    calculateRates(res.blitz)
    calculateRates(res.rapid)
    calculateRates(res.classical)
    calculateRates(res.total)

    return res
  }

  return {
    today: getStats(startOfToday),
    week: getStats(startOf7DaysAgo)
  }
})

const currentStats = computed(() => statsForPeriod.value[activeTab.value])
</script>

<template>
  <div class="lichess-activity-stats-tabs">
    <NTabs type="segment" size="small" v-model:value="activeTab">
      <NTab name="today">{{ t('features.lichessGamesDb.cacheSettings.tabToday') }}</NTab>
      <NTab name="week">{{ t('features.lichessGamesDb.cacheSettings.tabWeek') }}</NTab>
    </NTabs>

    <div class="activity-stats-content" style="margin-top: 14px;">
      <div class="speed-wdl-table">
        <!-- Bullet -->
        <div class="speed-row">
          <span class="speed-name">Bullet:</span>

          <div class="wdl-bar-container row-bar">
            <div v-if="currentStats.bullet.games > 0" class="wdl-bar">
              <div class="wdl-segment win" :style="{ width: currentStats.bullet.winRate + '%' }">
                <span class="wdl-val" v-if="currentStats.bullet.winRate > 15">{{ Math.round(currentStats.bullet.winRate) }}% W</span>
              </div>
              <div class="wdl-segment draw" :style="{ width: currentStats.bullet.drawRate + '%' }">
                <span class="wdl-val" v-if="currentStats.bullet.drawRate > 15">{{ Math.round(currentStats.bullet.drawRate) }}% D</span>
              </div>
              <div class="wdl-segment loss" :style="{ width: currentStats.bullet.lossRate + '%' }">
                <span class="wdl-val" v-if="currentStats.bullet.lossRate > 15">{{ Math.round(currentStats.bullet.lossRate) }}% L</span>
              </div>
            </div>
            <div v-else class="empty-perf-bar">
              {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
            </div>
          </div>

          <div class="speed-meta">
            <span class="speed-games-count">{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.bullet.games }) }}</span>
          </div>
        </div>

        <!-- Blitz -->
        <div class="speed-row">
          <span class="speed-name">Blitz:</span>

          <div class="wdl-bar-container row-bar">
            <div v-if="currentStats.blitz.games > 0" class="wdl-bar">
              <div class="wdl-segment win" :style="{ width: currentStats.blitz.winRate + '%' }">
                <span class="wdl-val" v-if="currentStats.blitz.winRate > 15">{{ Math.round(currentStats.blitz.winRate) }}% W</span>
              </div>
              <div class="wdl-segment draw" :style="{ width: currentStats.blitz.drawRate + '%' }">
                <span class="wdl-val" v-if="currentStats.blitz.drawRate > 15">{{ Math.round(currentStats.blitz.drawRate) }}% D</span>
              </div>
              <div class="wdl-segment loss" :style="{ width: currentStats.blitz.lossRate + '%' }">
                <span class="wdl-val" v-if="currentStats.blitz.lossRate > 15">{{ Math.round(currentStats.blitz.lossRate) }}% L</span>
              </div>
            </div>
            <div v-else class="empty-perf-bar">
              {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
            </div>
          </div>

          <div class="speed-meta">
            <span class="speed-games-count">{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.blitz.games }) }}</span>
          </div>
        </div>

        <!-- Rapid -->
        <div class="speed-row">
          <span class="speed-name">Rapid:</span>

          <div class="wdl-bar-container row-bar">
            <div v-if="currentStats.rapid.games > 0" class="wdl-bar">
              <div class="wdl-segment win" :style="{ width: currentStats.rapid.winRate + '%' }">
                <span class="wdl-val" v-if="currentStats.rapid.winRate > 15">{{ Math.round(currentStats.rapid.winRate) }}% W</span>
              </div>
              <div class="wdl-segment draw" :style="{ width: currentStats.rapid.drawRate + '%' }">
                <span class="wdl-val" v-if="currentStats.rapid.drawRate > 15">{{ Math.round(currentStats.rapid.drawRate) }}% D</span>
              </div>
              <div class="wdl-segment loss" :style="{ width: currentStats.rapid.lossRate + '%' }">
                <span class="wdl-val" v-if="currentStats.rapid.lossRate > 15">{{ Math.round(currentStats.rapid.lossRate) }}% L</span>
              </div>
            </div>
            <div v-else class="empty-perf-bar">
              {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
            </div>
          </div>

          <div class="speed-meta">
            <span class="speed-games-count">{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.rapid.games }) }}</span>
          </div>
        </div>

        <!-- Classical -->
        <div class="speed-row">
          <span class="speed-name">Classical:</span>

          <div class="wdl-bar-container row-bar">
            <div v-if="currentStats.classical.games > 0" class="wdl-bar">
              <div class="wdl-segment win" :style="{ width: currentStats.classical.winRate + '%' }">
                <span class="wdl-val" v-if="currentStats.classical.winRate > 15">{{ Math.round(currentStats.classical.winRate) }}% W</span>
              </div>
              <div class="wdl-segment draw" :style="{ width: currentStats.classical.drawRate + '%' }">
                <span class="wdl-val" v-if="currentStats.classical.drawRate > 15">{{ Math.round(currentStats.classical.drawRate) }}% D</span>
              </div>
              <div class="wdl-segment loss" :style="{ width: currentStats.classical.lossRate + '%' }">
                <span class="wdl-val" v-if="currentStats.classical.lossRate > 15">{{ Math.round(currentStats.classical.lossRate) }}% L</span>
              </div>
            </div>
            <div v-else class="empty-perf-bar">
              {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
            </div>
          </div>

          <div class="speed-meta">
            <span class="speed-games-count">{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.classical.games }) }}</span>
          </div>
        </div>

        <!-- Total row -->
        <div class="speed-row total-row">
          <span class="speed-name">{{ t('features.lichessGamesDb.statistics.total') }}:</span>

          <div class="wdl-bar-container row-bar">
            <div v-if="currentStats.total.games > 0" class="wdl-bar">
              <div class="wdl-segment win" :style="{ width: currentStats.total.winRate + '%' }">
                <span class="wdl-val" v-if="currentStats.total.winRate > 15">{{ Math.round(currentStats.total.winRate) }}% W</span>
              </div>
              <div class="wdl-segment draw" :style="{ width: currentStats.total.drawRate + '%' }">
                <span class="wdl-val" v-if="currentStats.total.drawRate > 15">{{ Math.round(currentStats.total.drawRate) }}% D</span>
              </div>
              <div class="wdl-segment loss" :style="{ width: currentStats.total.lossRate + '%' }">
                <span class="wdl-val" v-if="currentStats.total.lossRate > 15">{{ Math.round(currentStats.total.lossRate) }}% L</span>
              </div>
            </div>
          </div>

          <div class="speed-meta">
            <span class="speed-games-count" style="font-weight: 700; color: #fff;">
              {{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.total.games }) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified WDL Labels -->
    <div v-if="currentStats.total.games > 0" class="wdl-labels">
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
.lichess-activity-stats-tabs {
  display: flex;
  flex-direction: column;
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
