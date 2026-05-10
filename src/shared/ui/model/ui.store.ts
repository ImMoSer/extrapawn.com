// src/stores/ui.store.ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
import i18n from '@/shared/config/i18n'
import { InsufficientPawnCoinsError } from '@/shared/api/client'

const t = i18n.global.t

type ResolveFunction = (value: 'confirm' | 'cancel' | 'extra' | null) => void

interface ConfirmationOptions {
  confirmText?: string
  cancelText?: string
  extraText?: string
  showCancel?: boolean
  showExtra?: boolean
  persistent?: boolean
}

export const useUiStore = defineStore('ui', () => {
  // For Confirmation Modal
  const isModalVisible = ref(false)
  const isModalPersistent = ref(false)
  const modalTitle = ref('')
  const modalMessage = ref('')
  const modalConfirmText = ref(t('common.actions.confirm'))
  const modalCancelText = ref(t('common.actions.cancel'))
  const modalExtraText = ref('')
  const isCancelButtonVisible = ref(true)
  const isExtraButtonVisible = ref(false)

  let resolvePromise: ResolveFunction | null = null

  function showConfirmation(
    title: string,
    message: string,
    options: ConfirmationOptions = {},
  ): Promise<'confirm' | 'cancel' | 'extra' | null> {
    modalTitle.value = title
    modalMessage.value = message
    modalConfirmText.value = options.confirmText || t('common.actions.confirm')
    modalCancelText.value = options.cancelText || t('common.actions.cancel')
    modalExtraText.value = options.extraText || ''
    isCancelButtonVisible.value = options.showCancel ?? true
    isExtraButtonVisible.value = options.showExtra ?? false
    isModalPersistent.value = options.persistent ?? false
    isModalVisible.value = true

    return new Promise<'confirm' | 'cancel' | 'extra' | null>((resolve) => {
      resolvePromise = resolve
    })
  }

  /**
   * Centralized handler for InsufficientPawnCoinsError.
   * Shows the confirmation modal and executes a callback if the user confirms (e.g., redirect to pricing).
   */
  async function handlePawnCoinsError(
    error: unknown,
    onPricingRedirect?: () => void,
    onCancel?: () => void,
  ): Promise<boolean> {
    if (error instanceof InsufficientPawnCoinsError) {
      const e = error as InsufficientPawnCoinsError
      const confirmed = await showConfirmation(
        t('features.pricing.insufficientCoins.title'),
        t('features.pricing.insufficientCoins.message', {
          required: e.required,
          available: e.available,
        }) +
          '\n\n' +
          t('features.pricing.insufficientCoins.subMessage'),
        {
          confirmText: t('features.pricing.insufficientCoins.goToPricing'),
          cancelText: t('common.actions.close'),
        },
      )

      if (confirmed === 'confirm') {
        if (onPricingRedirect) onPricingRedirect()
      } else {
        if (onCancel) onCancel()
      }
      return true
    }
    return false
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
    modalConfirmText.value = t('common.actions.confirm')
    modalCancelText.value = t('common.actions.cancel')
    modalExtraText.value = ''
    isCancelButtonVisible.value = true
    isExtraButtonVisible.value = false
    isModalPersistent.value = false
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
    showConfirmation,
    handlePawnCoinsError,
    handleConfirm,
    handleCancel,
    handleExtra,
    handleOverlayClick,
  }
})
