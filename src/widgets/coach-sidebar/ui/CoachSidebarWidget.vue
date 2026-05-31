<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { CoachSidebar, useCoachStore } from '@/features/coach'
import { EngineLines, useAnalysisStore } from '@/features/analysis'
import { useGameStore, PgnTree } from '@/entities/game'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { NButtonGroup, NButton, NIcon, NText } from 'naive-ui'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
} from '@vicons/ionicons5'

const gameStore = useGameStore()
const coachStore = useCoachStore()
const analysisStore = useAnalysisStore()

const activeTab = ref('coach')

watch(activeTab, async (newTab) => {
  if (newTab === 'analyse') {
    // 1. Disable the Coach completely (stops coach engine, resets coach UI state, clears coach board shapes)
    coachStore.setCoachEnabled(false)

    // 2. Start Stockfish engine analysis and show evaluation
    await analysisStore.showPanel(true)
  } else {
    // 1. Stop Stockfish engine analysis, clear engine board shapes
    await analysisStore.hidePanel()

    // 2. Restore the board to the actual game state FEN
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())

    // 3. Enable the Coach completely (spins up coach engine for current position, renders coach shapes)
    coachStore.setCoachEnabled(true)
  }
})

onUnmounted(async () => {
  await analysisStore.hidePanel()
  coachStore.setCoachEnabled(false)
})
</script>

<template>
  <CoachSidebar v-model:active-tab="activeTab">
    <template #analyse>
      <div class="analysis-tab-content">
        <!-- Navigation Buttons -->
        <div class="nav-toolbar">
          <n-button-group class="nav-group">
            <n-button quaternary circle @click="gameStore.navigatePgn('start')" title="Start der Partie">
              <template #icon><n-icon><PlaySkipBackOutline /></n-icon></template>
            </n-button>
            <n-button quaternary circle @click="gameStore.navigatePgn('backward')" title="Zug zurück">
              <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
            </n-button>
            <n-button quaternary circle @click="gameStore.navigatePgn('forward')" title="Zug vorwärts">
              <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
            </n-button>
            <n-button quaternary circle @click="gameStore.navigatePgn('end')" title="Ende der Partie">
              <template #icon><n-icon><PlaySkipForwardOutline /></n-icon></template>
            </n-button>
          </n-button-group>
        </div>

        <div class="pgn-section">
          <n-text class="section-label">Partieverlauf</n-text>
          <div class="pgn-container">
            <PgnTree :key="pgnTreeVersion" />
          </div>
        </div>

        <div class="engine-section">
          <n-text class="section-label">Engine-Linien</n-text>
          <EngineLines />
        </div>
      </div>
    </template>
  </CoachSidebar>
</template>

<style scoped>
.analysis-tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 14px 16px;
}

.nav-toolbar {
  display: flex;
  justify-content: center;
}

.nav-group {
  width: 100%;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 2px;
}

.nav-group .n-button {
  flex: 1;
  border-radius: 6px;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #71717a);
  margin-bottom: 8px;
  display: block;
}

.pgn-container {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  max-height: 250px;
  overflow-y: auto;
}

.pgn-container::-webkit-scrollbar {
  width: 4px;
}
.pgn-container::-webkit-scrollbar-track {
  background: transparent;
}
.pgn-container::-webkit-scrollbar-thumb {
  background-color: #27272a;
  border-radius: 4px;
}
.pgn-container::-webkit-scrollbar-thumb:hover {
  background-color: #3f3f46;
}
</style>
