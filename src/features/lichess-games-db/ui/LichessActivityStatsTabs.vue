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
  <div class="flex flex-col w-full">
    <NTabs type="segment" size="small" v-model:value="activeTab">
      <NTab name="today">{{ t('features.lichessGamesDb.cacheSettings.tabToday') }}</NTab>
      <NTab name="week">{{ t('features.lichessGamesDb.cacheSettings.tabWeek') }}</NTab>
    </NTabs>

    <div class="mt-3.5 flex flex-col gap-3.5">
      <!-- Bullet -->
      <div class="flex items-center gap-4">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">Bullet:</span>
        <div class="grow">
          <div v-if="currentStats.bullet.games > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: currentStats.bullet.winRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="currentStats.bullet.winRate > 15">{{ Math.round(currentStats.bullet.winRate) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: currentStats.bullet.drawRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="currentStats.bullet.drawRate > 15">{{ Math.round(currentStats.bullet.drawRate) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: currentStats.bullet.lossRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="currentStats.bullet.lossRate > 15">{{ Math.round(currentStats.bullet.lossRate) }}% L</span>
            </div>
          </div>
          <div v-else class="h-5 text-xs italic text-text-disabled flex items-center">
            {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>
        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span>{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.bullet.games }) }}</span>
        </div>
      </div>

      <!-- Blitz -->
      <div class="flex items-center gap-4">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">Blitz:</span>
        <div class="grow">
          <div v-if="currentStats.blitz.games > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: currentStats.blitz.winRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="currentStats.blitz.winRate > 15">{{ Math.round(currentStats.blitz.winRate) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: currentStats.blitz.drawRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="currentStats.blitz.drawRate > 15">{{ Math.round(currentStats.blitz.drawRate) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: currentStats.blitz.lossRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="currentStats.blitz.lossRate > 15">{{ Math.round(currentStats.blitz.lossRate) }}% L</span>
            </div>
          </div>
          <div v-else class="h-5 text-xs italic text-text-disabled flex items-center">
            {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>
        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span>{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.blitz.games }) }}</span>
        </div>
      </div>

      <!-- Rapid -->
      <div class="flex items-center gap-4">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">Rapid:</span>
        <div class="grow">
          <div v-if="currentStats.rapid.games > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: currentStats.rapid.winRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="currentStats.rapid.winRate > 15">{{ Math.round(currentStats.rapid.winRate) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: currentStats.rapid.drawRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="currentStats.rapid.drawRate > 15">{{ Math.round(currentStats.rapid.drawRate) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: currentStats.rapid.lossRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="currentStats.rapid.lossRate > 15">{{ Math.round(currentStats.rapid.lossRate) }}% L</span>
            </div>
          </div>
          <div v-else class="h-5 text-xs italic text-text-disabled flex items-center">
            {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>
        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span>{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.rapid.games }) }}</span>
        </div>
      </div>

      <!-- Classical -->
      <div class="flex items-center gap-4">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">Classical:</span>
        <div class="grow">
          <div v-if="currentStats.classical.games > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: currentStats.classical.winRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="currentStats.classical.winRate > 15">{{ Math.round(currentStats.classical.winRate) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: currentStats.classical.drawRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="currentStats.classical.drawRate > 15">{{ Math.round(currentStats.classical.drawRate) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: currentStats.classical.lossRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="currentStats.classical.lossRate > 15">{{ Math.round(currentStats.classical.lossRate) }}% L</span>
            </div>
          </div>
          <div v-else class="h-5 text-xs italic text-text-disabled flex items-center">
            {{ t('features.lichessGamesDb.statistics.noGamesPlayed') }}
          </div>
        </div>
        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed text-text-secondary">
          <span>{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.classical.games }) }}</span>
        </div>
      </div>

      <!-- Total row -->
      <div class="flex items-center gap-4 border-t border-dashed border-border pt-2.5 mt-0.5">
        <span class="w-[75px] shrink-0 font-bold text-text-primary text-sm">{{ t('features.lichessGamesDb.statistics.total') }}:</span>
        <div class="grow">
          <div v-if="currentStats.total.games > 0" class="flex h-5 rounded overflow-hidden bg-surface border border-border">
            <div class="flex items-center justify-center bg-success transition-all" :style="{ width: currentStats.total.winRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-void" v-if="currentStats.total.winRate > 15">{{ Math.round(currentStats.total.winRate) }}% W</span>
            </div>
            <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: currentStats.total.drawRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="currentStats.total.drawRate > 15">{{ Math.round(currentStats.total.drawRate) }}% D</span>
            </div>
            <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: currentStats.total.lossRate + '%' }">
              <span class="text-[10px] font-condensed font-bold text-white" v-if="currentStats.total.lossRate > 15">{{ Math.round(currentStats.total.lossRate) }}% L</span>
            </div>
          </div>
        </div>
        <div class="w-[125px] shrink-0 flex flex-col items-end text-xs font-condensed font-bold text-text-primary">
          <span>{{ t('features.lichessGamesDb.statistics.gamesCount', { count: currentStats.total.games }) }}</span>
        </div>
      </div>
    </div>

    <!-- Unified WDL Labels -->
    <div v-if="currentStats.total.games > 0" class="flex justify-center gap-5 mt-2.5 text-xs text-text-secondary">
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
