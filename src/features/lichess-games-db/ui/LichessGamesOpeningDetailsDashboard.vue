<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NScrollbar } from 'naive-ui'
import { gamesDb } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { exportGamesAsBackup } from '../model/open-export'

const props = defineProps<{
  username: string
  openingName: string
  color: 'white' | 'black'
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

interface VariantStats {
  name: string
  gamesCount: number
  wins: number
  draws: number
  losses: number
  winRate: number
  drawRate: number
  lossRate: number
  performance: number
}

interface PopupData {
  openingName: string
  gamesCount: number
  wins: number
  draws: number
  losses: number
  winRate: number
  drawRate: number
  lossRate: number
  performance: number
  variants: VariantStats[]
}

const data = ref<PopupData | null>(null)
const loading = ref(true)

function getVariantName(opening: string, openingNameBase: string): string {
  if (!opening || !openingNameBase) return 'Sidelines'
  if (opening.trim() === openingNameBase.trim()) return 'Sidelines'

  const colonIndex = opening.indexOf(':')
  if (colonIndex === -1) return 'Sidelines'

  const afterColon = opening.slice(colonIndex + 1).trim()
  const firstPart = afterColon.split(',')[0]?.trim()
  return firstPart || 'Sidelines'
}

async function loadData() {
  loading.value = true
  try {
    const cleanUsername = props.username.trim().toLowerCase()
    const color = props.color

    const games = await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .filter(g => g.userColor === color && g.openingNameBase === props.openingName)
      .toArray()

    let totalWins = 0
    let totalDraws = 0
    let totalLosses = 0
    let totalOppRating = 0

    const variantGroups: Record<string, { wins: number; draws: number; losses: number; totalOpponentRating: number; gamesCount: number }> = {}

    for (const game of games) {
      const variant = getVariantName(game.opening || '', game.openingNameBase || '')
      if (!variantGroups[variant]) {
        variantGroups[variant] = { wins: 0, draws: 0, losses: 0, totalOpponentRating: 0, gamesCount: 0 }
      }
      
      const g = variantGroups[variant]
      g.gamesCount++
      if (game.userResult === 'win') {
        g.wins++
        totalWins++
      } else if (game.userResult === 'draw') {
        g.draws++
        totalDraws++
      } else if (game.userResult === 'loss') {
        g.losses++
        totalLosses++
      }
      
      const oppRating = game.userColor === 'white' ? game.black_elo : game.white_elo
      g.totalOpponentRating += oppRating
      totalOppRating += oppRating
    }

    const totalGames = games.length
    const winRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0
    const drawRate = totalGames > 0 ? (totalDraws / totalGames) * 100 : 0
    const lossRate = totalGames > 0 ? (totalLosses / totalGames) * 100 : 0
    const scorePercent = totalGames > 0 ? (totalWins + 0.5 * totalDraws) / totalGames : 0

    let diff = 0
    if (scorePercent === 1) {
      diff = 400
    } else if (scorePercent === 0) {
      diff = -400
    } else {
      diff = Math.round((scorePercent - 0.5) * 800)
    }
    const avgOppRating = totalGames > 0 ? Math.round(totalOppRating / totalGames) : 0
    const performance = Math.round(avgOppRating + diff)

    const variants = Object.entries(variantGroups).map(([name, v]) => {
      const vWinRate = v.gamesCount > 0 ? (v.wins / v.gamesCount) * 100 : 0
      const vDrawRate = v.gamesCount > 0 ? (v.draws / v.gamesCount) * 100 : 0
      const vLossRate = v.gamesCount > 0 ? (v.losses / v.gamesCount) * 100 : 0
      
      const vAvgOppRating = v.gamesCount > 0 ? Math.round(v.totalOpponentRating / v.gamesCount) : 0
      const vScorePercent = v.gamesCount > 0 ? (v.wins + 0.5 * v.draws) / v.gamesCount : 0
      const vDiff = vScorePercent === 1 ? 400 : vScorePercent === 0 ? -400 : Math.round((vScorePercent - 0.5) * 800)
      
      return {
        name,
        gamesCount: v.gamesCount,
        wins: v.wins,
        draws: v.draws,
        losses: v.losses,
        winRate: vWinRate,
        drawRate: vDrawRate,
        lossRate: vLossRate,
        performance: Math.round(vAvgOppRating + vDiff)
      }
    }).sort((a, b) => b.gamesCount - a.gamesCount)

    data.value = {
      openingName: props.openingName,
      gamesCount: totalGames,
      wins: totalWins,
      draws: totalDraws,
      losses: totalLosses,
      winRate,
      drawRate,
      lossRate,
      performance,
      variants
    }
  } catch (err) {
    console.error('Failed to load opening variant data:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

async function exportOpeningGames() {
  if (!props.username || !data.value) return
  try {
    const cleanUsername = props.username.trim().toLowerCase()
    const color = props.color

    const games = await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .filter(g => g.userColor === color && g.openingNameBase === props.openingName)
      .toArray()

    const authStore = useAuthStore()
    const keySeed = authStore.userProfile?.createdAt || 0
    await exportGamesAsBackup(props.username, color, props.openingName, games, keySeed)
  } catch (err) {
    console.error('Failed to export opening games:', err)
  }
}
</script>

<template>
  <div class="opening-details-dashboard">
    <div class="dashboard-header">
      <NButton secondary size="small" class="back-btn" @click="emit('back')">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/>
          </svg>
        </template>
        {{ $t('shared.buttons.back') }}
      </NButton>
      <h4 class="dashboard-subtitle">{{ $t('features.lichessGamesDb.statistics.openingDetails') }}</h4>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loader"></div>
    </div>

    <div v-else-if="data" class="dashboard-content">
      <div class="opening-name-row">
        <span class="color-indicator" :class="color"></span>
        <h3 class="opening-name">{{ data.openingName }}</h3>
      </div>

      <!-- Gesamt (Overall) row -->
      <div class="variant-card total-card">
        <div class="variant-header">
          <span class="variant-title">{{ $t('features.lichessGamesDb.statistics.total') }}</span>
          <span class="variant-meta">
            ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: data.gamesCount }) }})
            <strong class="perf-val">{{ data.performance }} TPR</strong>
          </span>
        </div>
        <div class="wdl-bar">
          <div class="wdl-segment win" :style="{ width: data.winRate + '%' }">
            <span class="wdl-val" v-if="data.winRate > 15">
              {{ Math.round(data.winRate) }}% W
            </span>
          </div>
          <div class="wdl-segment draw" :style="{ width: data.drawRate + '%' }">
            <span class="wdl-val" v-if="data.drawRate > 15">
              {{ Math.round(data.drawRate) }}% D
            </span>
          </div>
          <div class="wdl-segment loss" :style="{ width: data.lossRate + '%' }">
            <span class="wdl-val" v-if="data.lossRate > 15">
              {{ Math.round(data.lossRate) }}% L
            </span>
          </div>
        </div>
      </div>

      <!-- Scrollable list of variants -->
      <div class="variants-section-title">
        {{ $t('features.lichessGamesDb.statistics.variants') }}
      </div>

      <div class="scroll-wrapper">
        <NScrollbar style="max-height: 400px;" trigger="none">
          <div class="variants-list">
            <div v-for="v in data.variants" :key="v.name" class="variant-card">
              <div class="variant-header">
                <span class="variant-title" :title="v.name">{{ v.name }}</span>
                <span class="variant-meta">
                  ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: v.gamesCount }) }})
                  <strong class="perf-val">{{ v.performance }} TPR</strong>
                </span>
              </div>
              <div class="wdl-bar">
                <div class="wdl-segment win" :style="{ width: v.winRate + '%' }">
                  <span class="wdl-val" v-if="v.winRate > 15">
                    {{ Math.round(v.winRate) }}% W
                  </span>
                </div>
                <div class="wdl-segment draw" :style="{ width: v.drawRate + '%' }">
                  <span class="wdl-val" v-if="v.drawRate > 15">
                    {{ Math.round(v.drawRate) }}% D
                  </span>
                </div>
                <div class="wdl-segment loss" :style="{ width: v.lossRate + '%' }">
                  <span class="wdl-val" v-if="v.lossRate > 15">
                    {{ Math.round(v.lossRate) }}% L
                  </span>
                </div>
              </div>
            </div>
          </div>
        </NScrollbar>
      </div>

      <div class="dashboard-actions">
        <NButton size="medium" type="primary" secondary block @click="exportOpeningGames">
          {{ $t('features.lichessGamesDb.cacheSettings.exportBtn') }}
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opening-details-dashboard {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition: all 0.3s ease;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 12px;
}

.dashboard-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.back-btn {
  font-weight: bold;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.opening-name-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.color-indicator.white {
  background-color: #ffffff;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.color-indicator.black {
  background-color: #1a1a1a;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
}

.opening-name {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--neon-cyan, #00e5ff);
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.25);
}

.variant-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
}

.variant-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.total-card {
  border-color: var(--neon-bordeaux, #d9004c);
  background: rgba(217, 0, 76, 0.05);
}

.total-card:hover {
  border-color: var(--neon-bordeaux, #d9004c);
  background: rgba(217, 0, 76, 0.08);
}

.variant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.variant-title {
  font-weight: bold;
  font-size: 1.05rem;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.variant-meta {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  gap: 8px;
  align-items: center;
}

.perf-val {
  color: var(--neon-yellow, #f7d547);
  text-shadow: 0 0 8px rgba(247, 213, 71, 0.3);
}

.variants-section-title {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  padding-bottom: 6px;
  margin-top: 10px;
}

.scroll-wrapper {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.03);
  background: rgba(0, 0, 0, 0.15);
  padding: 10px;
}

.variants-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* WDL Progress Bars */
.wdl-bar {
  display: flex;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
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
  font-weight: 900;
  color: #fff;
  white-space: nowrap;
}

.dashboard-actions {
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 16px;
}

/* Loader styling */
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--neon-cyan, #00e5ff);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
