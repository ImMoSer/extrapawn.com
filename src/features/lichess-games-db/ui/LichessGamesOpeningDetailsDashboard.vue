<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NScrollbar } from 'naive-ui'
import { userGamesRepository } from '@/entities/game'
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

    const allUserGames = await userGamesRepository.getGamesForUser(cleanUsername)
    const games = allUserGames.filter(g => g.userColor === color && g.openingNameBase === props.openingName)

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

    const allUserGames = await userGamesRepository.getGamesForUser(cleanUsername)
    const games = allUserGames.filter(g => g.userColor === color && g.openingNameBase === props.openingName)

    const authStore = useAuthStore()
    const keySeed = authStore.userProfile?.createdAt || 0
    await exportGamesAsBackup(props.username, color, props.openingName, games, keySeed)
  } catch (err) {
    console.error('Failed to export opening games:', err)
  }
}
</script>

<template>
  <div class="bg-surface/90 backdrop-blur-md border border-border rounded-xl p-6 flex flex-col gap-5 transition-all animate-fadeIn">
    <div class="flex justify-between items-center border-b border-border pb-3">
      <NButton secondary size="small" class="font-bold" @click="emit('back')">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="16" height="16" fill="currentColor">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="48" d="M328 112L184 256l144 144"/>
          </svg>
        </template>
        {{ $t('shared.buttons.back') }}
      </NButton>
      <h4 class="m-0 text-xs font-bold font-display uppercase tracking-wider text-text-secondary">{{ $t('features.lichessGamesDb.statistics.openingDetails') }}</h4>
    </div>

    <div v-if="loading" class="flex justify-center items-center h-[200px]">
      <div class="w-10 h-10 border-3 border-border border-t-neon-cyan rounded-full animate-spin"></div>
    </div>

    <div v-else-if="data" class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <span class="w-3 h-3 rounded-full border border-white/20" :class="color === 'white' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'bg-void border-white/40 shadow-[0_0_8px_rgba(0,0,0,0.8)]'"></span>
        <h3 class="m-0 text-2xl font-extrabold text-neon-cyan font-display drop-shadow-md">{{ data.openingName }}</h3>
      </div>

      <!-- Gesamt (Overall) row -->
      <div class="bg-danger/10 border border-danger/40 rounded-lg p-3.5 flex flex-col gap-2 transition-all hover:bg-danger/15">
        <div class="flex justify-between items-center gap-3">
          <span class="font-bold text-base text-text-primary truncate max-w-[250px]">{{ $t('features.lichessGamesDb.statistics.total') }}</span>
          <span class="text-sm text-text-secondary flex gap-2 items-center font-condensed">
            ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: data.gamesCount }) }})
            <strong class="text-warning font-bold">{{ data.performance }} TPR</strong>
          </span>
        </div>
        <div class="flex h-5 rounded overflow-hidden bg-surface border border-border">
          <div class="flex items-center justify-center bg-success transition-all" :style="{ width: data.winRate + '%' }">
            <span class="text-[10px] font-condensed font-bold text-void" v-if="data.winRate > 15">
              {{ Math.round(data.winRate) }}% W
            </span>
          </div>
          <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: data.drawRate + '%' }">
            <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="data.drawRate > 15">
              {{ Math.round(data.drawRate) }}% D
            </span>
          </div>
          <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: data.lossRate + '%' }">
            <span class="text-[10px] font-condensed font-bold text-white" v-if="data.lossRate > 15">
              {{ Math.round(data.lossRate) }}% L
            </span>
          </div>
        </div>
      </div>

      <!-- Scrollable list of variants -->
      <div class="text-xs font-bold tracking-wider text-text-secondary uppercase border-b border-border/40 pb-1.5 mt-2.5">
        {{ $t('features.lichessGamesDb.statistics.variants') }}
      </div>

      <div class="rounded-lg overflow-hidden border border-border/30 bg-void/50 p-2.5">
        <NScrollbar style="max-height: 400px;" trigger="none">
          <div class="flex flex-col gap-2.5">
            <div v-for="v in data.variants" :key="v.name" class="bg-surface/60 border border-border/40 rounded-lg p-3.5 flex flex-col gap-2 transition-all hover:bg-surface hover:border-border">
              <div class="flex justify-between items-center gap-3">
                <span class="font-bold text-sm text-text-primary truncate max-w-[250px]" :title="v.name">{{ v.name }}</span>
                <span class="text-xs text-text-secondary flex gap-2 items-center font-condensed">
                  ({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: v.gamesCount }) }})
                  <strong class="text-warning font-bold">{{ v.performance }} TPR</strong>
                </span>
              </div>
              <div class="flex h-5 rounded overflow-hidden bg-surface border border-border">
                <div class="flex items-center justify-center bg-success transition-all" :style="{ width: v.winRate + '%' }">
                  <span class="text-[10px] font-condensed font-bold text-void" v-if="v.winRate > 15">
                    {{ Math.round(v.winRate) }}% W
                  </span>
                </div>
                <div class="flex items-center justify-center bg-text-disabled/40 transition-all" :style="{ width: v.drawRate + '%' }">
                  <span class="text-[10px] font-condensed font-bold text-text-primary" v-if="v.drawRate > 15">
                    {{ Math.round(v.drawRate) }}% D
                  </span>
                </div>
                <div class="flex items-center justify-center bg-danger transition-all" :style="{ width: v.lossRate + '%' }">
                  <span class="text-[10px] font-condensed font-bold text-white" v-if="v.lossRate > 15">
                    {{ Math.round(v.lossRate) }}% L
                  </span>
                </div>
              </div>
            </div>
          </div>
        </NScrollbar>
      </div>

      <div class="mt-2.5 border-t border-border pt-4">
        <NButton size="medium" type="primary" secondary block @click="exportOpeningGames">
          {{ $t('features.lichessGamesDb.cacheSettings.exportBtn') }}
        </NButton>
      </div>
    </div>
  </div>
</template>
