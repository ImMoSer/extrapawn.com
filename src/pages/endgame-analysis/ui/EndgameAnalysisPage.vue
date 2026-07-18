<script setup lang="ts">
import { computed, onMounted, ref, watch, onUnmounted } from 'vue'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  LichessEndgameDashboard,
  useLichessEndgameAnalysisStore,
  EndgameTrainingSidebar,
  EndgameTrainingTopInfo,
  EndgameTrainingPuzzleQueue
} from '@/features/lichess-endgame-analysis'
import { useLichessGamesDbStore } from '@/features/lichess-games-db'
import { useAuthStore } from '@/entities/user'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'
import { useCoachStore } from '@/features/coach'

const { t } = useI18n()
const message = useMessage()
const gamesStore = useLichessGamesDbStore()
const endgameStore = useLichessEndgameAnalysisStore()
const authStore = useAuthStore()
const coachStore = useCoachStore()

const activeTab = ref<'classifications' | 'queue'>('classifications')

// Automatically switch to 'queue' when a category is selected and training starts
watch(() => endgameStore.activeCategory, (newCat) => {
  if (newCat) {
    activeTab.value = 'queue'
  } else {
    activeTab.value = 'classifications'
  }
})

// Enable coach during endgame training gameplay, disable it when not playing
watch(() => endgameStore.isPlaying, (playing) => {
  if (playing) {
    coachStore.setCoachEnabled(true)
  } else {
    coachStore.setCoachEnabled(false)
  }
}, { immediate: true })

onUnmounted(() => {
  coachStore.setCoachEnabled(false)
})

// Benutzername ermitteln
const username = computed(() => authStore.userProfile?.id || '')

// Anzahl der lokalen Spiele im Cache
const localGamesCount = computed(() => {
  return gamesStore.stats?.total || 0
})

// Stats beim Mounten laden
onMounted(async () => {
  if (username.value) {
    try {
      await gamesStore.loadStats(username.value)
    } catch (err) {
      console.error('[EndgameAnalysisPage] Fehler beim Laden der Spieldaten-Stats:', err)
    }
  }
})

// Direkte Analyse der lokalen Cached-Spiele
const handleAnalyzeLocal = async () => {
  if (!username.value) {
    message.error('Kein Lichess-Benutzername gefunden.')
    return
  }

  try {
    const buffer = await gamesStore.getCompressedBackupBuffer(username.value)
    if (!buffer) {
      message.error('Es wurden keine Partien im lokalen Cache gefunden. Bitte lade zuerst deine Spiele im User Cabinet.')
      return
    }
    
    await endgameStore.analyzeBackupBuffer(buffer)
    message.success('Endspiel-Analyse erfolgreich abgeschlossen!')
  } catch (err) {
    const errorObject = err as Error
    message.error(errorObject.message || 'Fehler beim Ausführen der Endspiel-Analyse.')
  }
}
</script>

<template>
  <div class="page-container">
    <LichessEndgameDashboard 
      v-if="!endgameStore.isPlaying"
      :local-games-count="localGamesCount" 
      @analyze-local="handleAnalyzeLocal" 
    />
    <GameLayout v-else>
      <template #left-panel>
        <div class="left-panel-wrapper">
          <div class="left-panel-tabs">
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'classifications' }"
              @click="activeTab = 'classifications'"
            >
              {{ t('features.lichessEndgameAnalysis.classifications') }}
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: activeTab === 'queue' }"
              @click="activeTab = 'queue'"
            >
              {{ t('features.lichessEndgameAnalysis.puzzleQueue') }}
            </button>
          </div>
          <div class="left-panel-content">
            <EndgameTrainingSidebar v-show="activeTab === 'classifications'" />
            <EndgameTrainingPuzzleQueue v-show="activeTab === 'queue'" />
          </div>
        </div>
      </template>
      <template #top-info>
        <EndgameTrainingTopInfo />
      </template>
      <template #center-column>
        <!-- Board is handled by GameLayout -->
      </template>
      <template #right-panel>
        <CoachSidebarWidget />
      </template>
    </GameLayout>
  </div>
</template>

<style scoped>
.page-container {
  min-height: calc(100vh - 80px);
  background-color: #0b0c14;
}

.left-panel-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.left-panel-tabs {
  display: flex;
  background: var(--bg-1, #0b0d17);
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
}

.tab-btn {
  flex: 1;
  padding: 14px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  outline: none;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.02);
}

.tab-btn.active {
  color: var(--neon-bordeaux, #d9004c);
  text-shadow: 0 0 10px rgba(217, 0, 76, 0.3);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 10%;
  width: 80%;
  height: 2px;
  background: var(--neon-bordeaux, #d9004c);
  box-shadow: 0 0 8px var(--neon-bordeaux, #d9004c);
}

.left-panel-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>

