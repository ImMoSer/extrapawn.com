<script setup lang="ts">
import { computed } from 'vue'
import { NRadioGroup, NRadioButton, NText, NScrollbar } from 'naive-ui'
import { OpeningStatsTable } from '@/features/opening-explorer'
import { usePlayCoachStore, PgnTree } from '@/features/play-coach'
import { pgnTreeVersion } from '@/shared/lib/pgn/PgnService'

const playCoachStore = usePlayCoachStore()

const topMoves = computed(() => {
  return playCoachStore.coachStats?.moves.slice(0, 10) || []
})
</script>

<template>
  <div class="play-coach-sidebar">
    <div class="sidebar-header">
      <n-text class="sidebar-title">Play Coach</n-text>
    </div>

    <div class="sidebar-content">
      <div class="form-group">
        <n-text class="input-label">Lichess Book Statistik (Rating)</n-text>
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

      <div class="active-game-section">
        <div class="coach-stats-section">
          <OpeningStatsTable
            v-if="playCoachStore.coachStats"
            :moves="topMoves"
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

        <div class="pgn-section" style="margin-top: 20px">
          <n-text class="input-label" style="margin-bottom: 8px; display: block">Partieverlauf</n-text>
          <div class="pgn-container">
            <n-scrollbar style="max-height: 400px">
              <div class="pgn-content">
                <PgnTree :key="pgnTreeVersion" />
              </div>
            </n-scrollbar>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play-coach-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background: var(--color-surface-2);
}

.sidebar-header {
  margin-bottom: 20px;
}

.sidebar-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.pgn-container {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
}

.pgn-content {
  line-height: 1.5;
}
</style>
