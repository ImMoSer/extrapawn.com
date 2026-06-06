import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useRepertoireTrainingStore = defineStore('repertoire-training', () => {
  const isTrainingActive = ref(false)
  const trainingChapterId = ref<string | null>(null)

  // Overall session statistics
  const sessionStats = ref({
    variantsPlayed: 0,
    variantsSolved: 0, // Run with zero mistakes
    startTime: 0,
  })

  // Statistics for the current variation run
  const variantStats = ref({
    correct: 0,
    wrong: 0,
  })

  const variantAccuracy = computed(() => {
    const total = variantStats.value.correct + variantStats.value.wrong
    if (total === 0) return 0
    return Math.round((variantStats.value.correct / total) * 100)
  })

  function resetSession() {
    sessionStats.value = {
      variantsPlayed: 0,
      variantsSolved: 0,
      startTime: Date.now(),
    }
    resetVariant()
  }

  function resetVariant() {
    variantStats.value = {
      correct: 0,
      wrong: 0,
    }
  }

  return {
    isTrainingActive,
    trainingChapterId,
    sessionStats,
    variantStats,
    variantAccuracy,
    resetSession,
    resetVariant,
  }
})
