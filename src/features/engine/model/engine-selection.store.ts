import { useGameStore } from '@/entities/game'
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AVAILABLE_ENGINES } from '../config/constants'

const ENGINE_STORAGE_KEY = 'user_selected_engine'

export const useEngineSelectionStore = defineStore('engine-selection', () => {
  const availableEngines = ref<EngineId[]>([...AVAILABLE_ENGINES])

  const loadSavedEngine = (): EngineId => {
    try {
      const savedEngine = localStorage.getItem(ENGINE_STORAGE_KEY)
      if (savedEngine && availableEngines.value.includes(savedEngine as EngineId)) {
        return savedEngine as EngineId
      }
    } catch (error) {
      logger.error('[EngineSelectionStore] Failed to load engine from localStorage', error)
    }
    return 'maia-2200'
  }

  const selectedEngine = ref<EngineId>(loadSavedEngine())
  const isEngineSelectorOpen = ref(false)

  function toggleEngineSelector() {
    isEngineSelectorOpen.value = !isEngineSelectorOpen.value
  }

  function setEngine(engineId: EngineId) {
    if (selectedEngine.value === engineId) return

    selectedEngine.value = engineId
    isEngineSelectorOpen.value = false
    try {
      localStorage.setItem(ENGINE_STORAGE_KEY, engineId)
      logger.info(`[EngineSelectionStore] Saved selected engine: ${engineId}`)
      const gameStore = useGameStore()
      gameStore.setBotEngineId(engineId)
    } catch (error) {
      logger.error('[EngineSelectionStore] Failed to save engine', error)
    }
  }

  return {
    availableEngines,
    selectedEngine,
    isEngineSelectorOpen,
    toggleEngineSelector,
    setEngine,
  }
})
