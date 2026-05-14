import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useStudyStore, isChapterTrimmed } from '@/entities/study'

export const useReplyTrainingStore = defineStore('reply-training', () => {
  const isReplyTrainingActive = ref(false)
  const trainingChapterId = ref<string | null>(null)

  const isReadyToReply = computed(() => {
    const studyStore = useStudyStore()
    if (!studyStore.activeStudy) return false
    const studyChapters = studyStore.chapters.filter(
      (c) => c.studyId === studyStore.activeStudy?.id,
    )
    return studyChapters.some((c) => c.chapter_type === 'repertoire' && isChapterTrimmed(c))
  })

  // Gesamte Session
  const sessionStats = ref({
    variantsPlayed: 0,
    variantsSolved: 0, // Only error-free attempts
    startTime: 0,
  })

  // Aktueller Durchlauf einer Variante
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
    isReplyTrainingActive,
    trainingChapterId,
    isReadyToReply,
    sessionStats,
    variantStats,
    variantAccuracy,
    resetSession,
    resetVariant,
  }
})
