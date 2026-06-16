import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import type { EndgameAnalysisResponse } from './lichess-endgame-analysis.types'

export const useLichessEndgameAnalysisStore = defineStore('lichessEndgameAnalysis', () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const analysisResult = ref<EndgameAnalysisResponse | null>(null)

  const analyzeBackupBuffer = async (fileBuffer: ArrayBuffer): Promise<void> => {
    isLoading.value = true
    error.value = null
    analysisResult.value = null

    try {
      logger.info(`[EndgameAnalysisStore] Starte Analyse fuer Buffer (${fileBuffer.byteLength} Bytes)`)
      
      const response = await apiClient<EndgameAnalysisResponse>(
        '/engine-eval/endgame/analyze',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: fileBuffer,
        }
      )

      if (!response || !response.stats || !response.checked_games) {
        throw new Error('Ungueltige Antwortstruktur vom Analyse-Service erhalten.')
      }

      analysisResult.value = response
      logger.info('[EndgameAnalysisStore] Analyse erfolgreich abgeschlossen.')
    } catch (err) {
      const errorObject = err as Error
      const errMsg = errorObject.message || 'Ein unerwarteter Fehler ist bei der Analyse aufgetreten.'
      error.value = errMsg
      logger.error('[EndgameAnalysisStore] Fehler bei der Analyse:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const resetResult = () => {
    analysisResult.value = null
    error.value = null
  }

  return {
    isLoading,
    error,
    analysisResult,
    analyzeBackupBuffer,
    resetResult,
  }
})
