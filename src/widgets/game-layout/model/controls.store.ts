// src/widgets/game-layout/model/controls.store.ts
import { useGameStore } from '@/entities/game'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const noop = () => {}

export const useControlsStore = defineStore('controls', () => {
  const gameStore = useGameStore()
  const uiStore = useUiStore()
  const { t } = useI18n()

  const canRequestNew = ref(false)
  const canRestart = ref(false)
  const canResign = ref(false)
  const canShare = ref(false)
  const canRequestHint = ref(true)
  const showEngineSelection = ref(true)

  const onRequestNew = ref<() => void>(noop)
  const onRestart = ref<() => void>(noop)
  const onShare = ref<() => void>(noop)

  async function performResign() {
    if (gameStore.gamePhase !== 'PLAYING') return

    const confirmed = await uiStore.showConfirmation(
      t('features.gameplay.confirmExit.title'),
      t('features.gameplay.confirmExit.message'),
    )
    if (confirmed === 'confirm') {
      gameStore.handleGameResignation()
    }
  }

  async function performRestart() {
    if (gameStore.gamePhase === 'PLAYING') {
      const confirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )
      if (confirmed !== 'confirm') return
    }
    onRestart.value()
  }

  async function performRequestNew() {
    if (gameStore.gamePhase === 'PLAYING') {
      const confirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )
      if (confirmed !== 'confirm') return
    }
    onRequestNew.value()
  }

  function setControls(config: {
    canRequestNew?: boolean
    canRestart?: boolean
    canResign?: boolean
    canShare?: boolean
    canRequestHint?: boolean
    showEngineSelection?: boolean
    onRequestNew?: () => void
    onRestart?: () => void
    onShare?: () => void
  }) {
    canRequestNew.value = config.canRequestNew ?? false
    canRestart.value = config.canRestart ?? false
    canResign.value = config.canResign ?? false
    canShare.value = config.canShare ?? false
    canRequestHint.value = config.canRequestHint ?? true
    showEngineSelection.value = config.showEngineSelection ?? true

    onRequestNew.value = config.onRequestNew ?? noop
    onRestart.value = config.onRestart ?? noop
    onShare.value = config.onShare ?? noop
  }

  function resetControls() {
    setControls({})
  }

  return {
    canRequestNew,
    canRestart,
    canResign,
    canShare,
    canRequestHint,
    showEngineSelection,
    onRequestNew,
    onRestart,
    onShare,
    performResign,
    performRestart,
    performRequestNew,
    setControls,
    resetControls,
  }
})
