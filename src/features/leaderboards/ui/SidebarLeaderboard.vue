<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSidebarLeaderboardQuery } from '@/shared/api/queries/leaderboard.queries'

const props = defineProps<{
  gameMode: string
  subMode: string
  theme: string
  difficulty: string
}>()

const { t } = useI18n()

const { data, isLoading } = useSidebarLeaderboardQuery(
  computed(() => ({
    gameMode: props.gameMode,
    subMode: props.subMode,
    theme: props.theme,
    difficulty: props.difficulty,
  })),
)

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'rubyDiamond.svg',
  VIP: 'rubyDiamond.svg',
  vip: 'rubyDiamond.svg',
  Queen: 'wQ.svg',
  queen: 'wQ.svg',
  King: 'wK.svg',
  king: 'wK.svg',
  administrator: 'wK.svg',
  Administrator: 'wK.svg',
}

const getSubscriptionIcon = (tier?: string) => {
  if (!tier || !tierToPieceMap[tier]) return null
  return `/piece/alpha/${tierToPieceMap[tier]}`
}

const calculateWinRate = (solved: number, failed: number) => {
  const total = solved + failed
  if (total === 0) return 0
  return Math.round((solved / total) * 100)
}
</script>

<template>
  <div class="flex flex-col bg-surface/90 backdrop-blur-md border border-border rounded-xl overflow-hidden text-xs text-text-primary max-h-[400px] shadow-flat">
    <div class="px-3 py-2.5 bg-elevated/50 border-b border-border flex justify-between items-center">
      <span class="font-display font-bold uppercase tracking-wider text-neon-cyan text-[11px]">{{
        t('features.leaderboards.sidebar.title', 'Top 10 (30d)')
      }}</span>
      <div v-if="isLoading" class="w-3 h-3 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin"></div>
    </div>

    <div class="overflow-y-auto flex-1">
      <table class="w-full border-collapse table-fixed text-xs">
        <thead>
          <tr class="border-b border-border text-[10px] text-text-secondary uppercase font-semibold">
            <th class="w-6 py-2 px-1 text-center">#</th>
            <th class="py-2 px-1 text-left">{{ t('features.leaderboards.table.player') }}</th>
            <th class="w-11 py-2 px-1 text-center">{{ t('pages.userCabinet.stats.modes.all', 'Solved') }}</th>
            <th class="w-11 py-2 px-1 text-center">{{ t('features.leaderboards.sidebar.winRate', 'Quote') }}</th>
            <th class="w-12 py-2 px-1 text-right pr-2">
              {{ t('pages.userCabinet.detailedAnalytics.bestScore', 'Best') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in data?.top10" :key="entry.id" class="transition-colors hover:bg-elevated/40 border-b border-border/20">
            <td class="w-6 py-1.5 px-1 text-center font-condensed font-bold">{{ index + 1 }}</td>
            <td class="py-1.5 px-1 truncate">
              <div class="flex items-center gap-1.5 overflow-hidden">
                <img
                  v-if="getSubscriptionIcon(entry.tier)"
                  :src="getSubscriptionIcon(entry.tier)!"
                  class="w-4 h-4 shrink-0"
                />
                <span class="truncate font-semibold" :title="entry.username">{{ entry.username }}</span>
              </div>
            </td>
            <td class="w-11 py-1.5 px-1 text-center font-condensed">{{ entry.solved }}</td>
            <td class="w-11 py-1.5 px-1 text-center font-condensed font-bold text-success">{{ calculateWinRate(entry.solved, entry.failed) }}%</td>
            <td class="w-12 py-1.5 px-1 text-right pr-2 font-condensed font-bold text-warning">{{ entry.maxRating }}</td>
          </tr>
          <tr v-if="!isLoading && (!data?.top10 || data.top10.length === 0)" class="text-center">
            <td colspan="5" class="py-5 text-text-disabled italic">{{ t('pages.userCabinet.stats.noData') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data?.currentUser" class="pt-1 bg-neon-cyan/5 border-t-2 border-neon-cyan">
      <div class="text-[10px] uppercase font-extrabold px-3 text-neon-cyan font-display">{{ t('features.leaderboards.sidebar.currentUser', 'Du') }}</div>
      <table class="w-full border-collapse table-fixed text-xs">
        <tbody>
          <tr class="bg-transparent">
            <td class="w-6 py-1.5 px-1 text-center font-condensed">-</td>
            <td class="py-1.5 px-1 truncate">
              <div class="flex items-center gap-1.5 overflow-hidden">
                <img
                  v-if="getSubscriptionIcon(data.currentUser.tier)"
                  :src="getSubscriptionIcon(data.currentUser.tier)!"
                  class="w-4 h-4 shrink-0"
                />
                <span class="truncate font-bold text-neon-cyan" :title="data.currentUser.username">{{
                  data.currentUser.username
                }}</span>
              </div>
            </td>
            <td class="w-11 py-1.5 px-1 text-center font-condensed">{{ data.currentUser.solved }}</td>
            <td class="w-11 py-1.5 px-1 text-center font-condensed font-bold text-success">
              {{ calculateWinRate(data.currentUser.solved, data.currentUser.failed) }}%
            </td>
            <td class="w-12 py-1.5 px-1 text-right pr-2 font-condensed font-bold text-warning">{{ data.currentUser.maxRating }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
