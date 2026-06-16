<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { LichessEndgameDashboard, useLichessEndgameAnalysisStore } from '@/features/lichess-endgame-analysis'
import { useLichessGamesDbStore } from '@/features/lichess-games-db'
import { useAuthStore } from '@/entities/user'

const message = useMessage()
const gamesStore = useLichessGamesDbStore()
const endgameStore = useLichessEndgameAnalysisStore()
const authStore = useAuthStore()

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
      :local-games-count="localGamesCount" 
      @analyze-local="handleAnalyzeLocal" 
    />
  </div>
</template>

<style scoped>
.page-container {
  min-height: calc(100vh - 80px);
  background-color: #0b0c14;
}
</style>
