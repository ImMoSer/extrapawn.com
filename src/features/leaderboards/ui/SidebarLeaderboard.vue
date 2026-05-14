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
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
  administrator: 'wK.svg',
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
  <div class="sidebar-leaderboard glass">
    <div class="leaderboard-header">
      <span class="header-title">{{
        t('features.leaderboards.sidebar.title', 'Top 10 (30d)')
      }}</span>
      <div v-if="isLoading" class="loading-spinner"></div>
    </div>

    <div class="leaderboard-content custom-scrollbar">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="col-rank">#</th>
            <th class="col-player">{{ t('features.leaderboards.table.player') }}</th>
            <th class="col-solved">{{ t('features.userCabinet.stats.modes.all', 'Solved') }}</th>
            <th class="col-rate">{{ t('features.leaderboards.sidebar.winRate', 'Quote') }}</th>
            <th class="col-score">
              {{ t('features.userCabinet.detailedAnalytics.bestScore', 'Best') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in data?.top10" :key="entry.id" class="entry-row">
            <td class="col-rank">{{ index + 1 }}</td>
            <td class="col-player">
              <div class="player-info">
                <img
                  v-if="getSubscriptionIcon(entry.tier)"
                  :src="getSubscriptionIcon(entry.tier)!"
                  class="tier-icon"
                />
                <span class="username" :title="entry.username">{{ entry.username }}</span>
              </div>
            </td>
            <td class="col-solved">{{ entry.solved }}</td>
            <td class="col-rate">{{ calculateWinRate(entry.solved, entry.failed) }}%</td>
            <td class="col-score">{{ entry.maxRating }}</td>
          </tr>
          <tr v-if="!isLoading && (!data?.top10 || data.top10.length === 0)" class="empty-row">
            <td colspan="5">{{ t('features.userCabinet.stats.noData') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data?.currentUser" class="current-user-footer">
      <div class="footer-label">{{ t('features.leaderboards.sidebar.currentUser', 'Du') }}</div>
      <table class="leaderboard-table">
        <tbody>
          <tr class="entry-row current-user-row">
            <td class="col-rank">-</td>
            <td class="col-player">
              <div class="player-info">
                <img
                  v-if="getSubscriptionIcon(data.currentUser.tier)"
                  :src="getSubscriptionIcon(data.currentUser.tier)!"
                  class="tier-icon"
                />
                <span class="username" :title="data.currentUser.username">{{
                  data.currentUser.username
                }}</span>
              </div>
            </td>
            <td class="col-solved">{{ data.currentUser.solved }}</td>
            <td class="col-rate">
              {{ calculateWinRate(data.currentUser.solved, data.currentUser.failed) }}%
            </td>
            <td class="col-score">{{ data.currentUser.maxRating }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.sidebar-leaderboard {
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  font-size: 0.85rem;
  color: var(--text-primary);
  max-height: 400px;
}

.leaderboard-header {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-primary);
  font-size: 0.75rem;
}

.leaderboard-content {
  overflow-y: auto;
  flex: 1;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.leaderboard-table th {
  padding: 8px 4px;
  text-align: left;
  font-size: 0.65rem;
  text-transform: uppercase;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--glass-border);
  font-weight: 600;
}

.leaderboard-table td {
  padding: 6px 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-rank {
  width: 25px;
  text-align: center !important;
}
.col-player {
  width: auto;
}
.col-solved {
  width: 45px;
  text-align: center !important;
}
.col-rate {
  width: 45px;
  text-align: center !important;
}
.col-score {
  width: 50px;
  text-align: right !important;
  padding-right: 8px !important;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.username {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tier-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.entry-row {
  transition: background 0.2s ease;
}

.entry-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.current-user-footer {
  padding: 4px 0 0 0;
  background: rgba(0, 229, 255, 0.05);
  border-top: 2px solid var(--color-primary);
}

.footer-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  padding: 2px 12px;
  color: var(--color-primary);
  font-weight: 800;
}

.current-user-row {
  background: transparent;
}

.empty-row td {
  text-align: center;
  padding: 20px;
  color: var(--text-disabled);
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 229, 255, 0.3);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
