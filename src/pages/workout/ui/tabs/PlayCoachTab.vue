<script setup lang="ts">
import { NButton, NRadioGroup, NRadioButton, NText } from 'naive-ui'
import { OpeningStatsTable } from '@/features/opening-explorer'
import { usePlayCoachStore } from '@/features/workout'
import { useGameStore } from '@/entities/game'

const playCoachStore = usePlayCoachStore()
const gameStore = useGameStore()

function togglePlayCoach() {
  if (playCoachStore.isActive) {
    playCoachStore.stop()
    gameStore.setGamePhase('IDLE')
  } else {
    gameStore.setGamePhase('PLAYING')
    playCoachStore.start()
  }
}
</script>

<template>
  <div class="tab-panel">
    <template v-if="!playCoachStore.isActive">
      <div class="form-group">
        <n-text class="input-label">Spielstärke</n-text>
        <n-radio-group
          v-model:value="playCoachStore.selectedRange"
          size="medium"
          expand
          class="radio-grp"
        >
          <n-radio-button value="1000-1499">1000-1499</n-radio-button>
          <n-radio-button value="1500-1799">1500-1799</n-radio-button>
          <n-radio-button value="1800-2200">1800-2200</n-radio-button>
        </n-radio-group>
      </div>

      <div class="form-group" style="margin-top: 12px">
        <n-text class="input-label">Deine Farbe</n-text>
        <n-radio-group
          v-model:value="playCoachStore.userColor"
          size="medium"
          expand
          class="radio-grp"
        >
          <n-radio-button value="white">White</n-radio-button>
          <n-radio-button value="black">Black</n-radio-button>
        </n-radio-group>
      </div>
    </template>

    <div v-else class="active-game-info">
      <div class="info-row">
        <span class="label">Spielstärke:</span>
        <span class="value">{{ playCoachStore.selectedRange }}</span>
      </div>
      <div class="info-row">
        <span class="label">Deine Farbe:</span>
        <span class="value">{{ playCoachStore.userColor === 'white' ? 'Weiß' : 'Schwarz' }}</span>
      </div>
    </div>

    <div class="form-group" style="margin-top: 16px">
      <n-button
        block
        strong
        :type="playCoachStore.isActive ? 'error' : 'primary'"
        @click="togglePlayCoach"
      >
        {{ playCoachStore.isActive ? 'Stop PlayCoach' : 'Start PlayCoach' }}
      </n-button>
    </div>

    <div v-if="playCoachStore.isActive" class="coach-stats-section" style="margin-top: 20px">
      <n-text class="input-label" style="margin-bottom: 8px; display: block"
        >Lichess Book Statistik</n-text
      >
      <OpeningStatsTable
        v-if="playCoachStore.coachStats"
        :moves="playCoachStore.coachStats.moves"
        :isReviewMode="true"
        :total="playCoachStore.coachStats.summary?.total || 0"
        :win_p="playCoachStore.coachStats.summary?.win_p || 0"
        :draw_p="playCoachStore.coachStats.summary?.draw_p || 0"
        :loss_p="playCoachStore.coachStats.summary?.loss_p || 0"
        :avg-elo="playCoachStore.coachStats.summary?.avgElo || 0"
      />
      <div v-else-if="playCoachStore.isLoading" class="loading-stats">Lade Statistik...</div>
      <div v-else class="out-of-book-msg">Theory ends here. Maia is now playing.</div>
    </div>
  </div>
</template>

<style scoped>
.tab-panel {
  display: flex;
  flex-direction: column;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.input-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}
.radio-grp {
  width: 100%;
}
:deep(.n-radio-group .n-radio-button) {
  flex: 1;
  text-align: center;
}

.active-game-info {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.info-row .label {
  color: var(--color-text-muted);
  font-weight: 500;
}

.info-row .value {
  color: var(--color-text-primary);
  font-weight: 700;
}

.loading-stats,
.out-of-book-msg {
  padding: 20px;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.out-of-book-msg {
  color: var(--color-accent);
  border-color: rgba(var(--color-accent-rgb), 0.2);
}
</style>
