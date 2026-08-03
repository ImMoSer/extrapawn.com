// src/stores/ui.store.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import i18n from '@/shared/config/i18n'

const t = i18n.global.t

type ResolveFunction = (value: 'confirm' | 'cancel' | 'extra' | null) => void

export type ModalVariant = 'primary' | 'danger' | 'warning' | 'info'
export type ModalIcon = 'lock' | 'warning' | 'info' | null

interface ConfirmationOptions {
  confirmText?: string
  cancelText?: string
  extraText?: string
  showCancel?: boolean
  showExtra?: boolean
  persistent?: boolean
  variant?: ModalVariant
  icon?: ModalIcon
  telegramAttached?: boolean
}

export const useUiStore = defineStore('ui', () => {
  // For Confirmation Modal
  const isModalVisible = ref(false)
  const isModalPersistent = ref(false)
  const modalTitle = ref('')
  const modalMessage = ref('')
  const modalConfirmText = ref(t('shared.buttons.confirm'))
  const modalCancelText = ref(t('shared.buttons.cancel'))
  const modalExtraText = ref('')
  const isCancelButtonVisible = ref(true)
  const isExtraButtonVisible = ref(false)
  const modalVariant = ref<ModalVariant>('primary')
  const modalIcon = ref<ModalIcon>(null)
  const modalTelegramAttached = ref(false)

  let resolvePromise: ResolveFunction | null = null

  function showConfirmation(
    title: string,
    message: string,
    options: ConfirmationOptions = {},
  ): Promise<'confirm' | 'cancel' | 'extra' | null> {
    modalTitle.value = title
    modalMessage.value = message
    modalConfirmText.value = options.confirmText || t('shared.buttons.confirm')
    modalCancelText.value = options.cancelText || t('shared.buttons.cancel')
    modalExtraText.value = options.extraText || ''
    isCancelButtonVisible.value = options.showCancel ?? true
    isExtraButtonVisible.value = options.showExtra ?? false
    isModalPersistent.value = options.persistent ?? false
    modalVariant.value = options.variant || 'primary'
    modalIcon.value = options.icon ?? null
    modalTelegramAttached.value = options.telegramAttached ?? false
    isModalVisible.value = true

    return new Promise<'confirm' | 'cancel' | 'extra' | null>((resolve) => {
      resolvePromise = resolve
    })
  }

  function showRestrictionModal(
    customMessage?: string,
    telegramAttached?: boolean,
  ): Promise<'confirm' | 'cancel' | 'extra' | null> {
    return showConfirmation(
      t('puzzleCategories.tierRestriction.title'),
      customMessage || t('puzzleCategories.tierRestriction.message'),
      {
        confirmText: t('puzzleCategories.tierRestriction.upgradeBtn'),
        cancelText: t('puzzleCategories.tierRestriction.cancelBtn'),
        showCancel: true,
        variant: 'primary',
        icon: 'lock',
        telegramAttached: telegramAttached ?? false,
      },
    )
  }

  function handleConfirm() {
    if (resolvePromise) {
      resolvePromise('confirm')
    }
    isModalVisible.value = false
    reset()
  }

  function handleCancel() {
    if (resolvePromise) {
      resolvePromise('cancel')
    }
    isModalVisible.value = false
    reset()
  }

  function handleExtra() {
    if (resolvePromise) {
      resolvePromise('extra')
    }
    isModalVisible.value = false
    reset()
  }

  function handleOverlayClick() {
    if (!isModalPersistent.value) {
      handleCancel()
    }
  }

  function reset() {
    modalTitle.value = ''
    modalMessage.value = ''
    resolvePromise = null
    modalConfirmText.value = t('shared.buttons.confirm')
    modalCancelText.value = t('shared.buttons.cancel')
    modalExtraText.value = ''
    isCancelButtonVisible.value = true
    isExtraButtonVisible.value = false
    isModalPersistent.value = false
    modalVariant.value = 'primary'
    modalIcon.value = null
    modalTelegramAttached.value = false
  }

  return {
    // Confirmation Modal
    isModalVisible,
    modalTitle,
    modalMessage,
    modalConfirmText,
    modalCancelText,
    modalExtraText,
    isCancelButtonVisible,
    isExtraButtonVisible,
    modalVariant,
    modalIcon,
    modalTelegramAttached,
    showConfirmation,
    showRestrictionModal,
    handleConfirm,
    handleCancel,
    handleExtra,
    handleOverlayClick,
  }
})
