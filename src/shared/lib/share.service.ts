// src/services/share.service.ts
import i18n from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import type { Color as ChessgroundColor, EngineId } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'

type ShareMode = 'finish-him' | 'theory-endings' | 'practical-chess'

class ShareServiceController {
  /**
   * Показывает всплывающее уведомление.
   * @param titleKey - Ключ для заголовка из i18n.
   * @param messageKey - Ключ для сообщения из i18n.
   */
  private showNotification(titleKey: string, messageKey: string) {
    const uiStore = useUiStore()
    const t = i18n.global.t
    uiStore.showConfirmation(t(titleKey), t(messageKey), { showCancel: false })
  }

  /**
   * Копирует текст в буфер обмена, используя современный Clipboard API с фолбэком.
   * @param text - Текст для копирования.
   */
  private copyToClipboard(text: string): void {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          logger.info('[ShareService] Link copied via Clipboard API:', text)
          this.showNotification('common.actions.ok', 'common.actions.linkCopied')
        })
        .catch((err) => {
          logger.error('[ShareService] Could not copy link via Clipboard API:', err)
          this.fallbackCopyToClipboard(text)
        })
    } else {
      this.fallbackCopyToClipboard(text)
    }
  }

  /**
   * Фолбэк-метод копирования для старых браузеров или небезопасных контекстов.
   */
  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'absolute'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      logger.info('[ShareService] Link copied via execCommand fallback:', text)
      this.showNotification('common.actions.ok', 'common.actions.linkCopied')
    } catch (err) {
      logger.error('[ShareService] Could not copy link via fallback:', err)
      this.showNotification('common.actions.error', 'common.actions.copyFailed')
    }
    document.body.removeChild(textArea)
  }

  /**
   * Основная функция "Поделиться". Использует Web Share API, если доступно, иначе копирует ссылку.
   * @param mode - Игровой режим.
   * @param id - ID задачи или башни.
   */
  public async share(
    mode: ShareMode,
    id: string,
    options?: {
      engineId?: EngineId
      userColor?: ChessgroundColor
      theoryType?: 'win' | 'draw'
    },
  ): Promise<void> {
    let url = `${window.location.origin}/${mode}/${id}`

    if (mode === 'theory-endings' && options?.theoryType) {
      url = `${window.location.origin}/theory-endings/${options.theoryType}/${id}`
    }

    const shareData = {
      title: 'Extrapawn.com Challenge YOU!',
      url: url,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
        logger.info('[ShareService] Successfully shared via Web Share API.')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          logger.error('[ShareService] Error using Web Share API:', error)
          this.copyToClipboard(url) // Фолбэк на копирование при ошибке
        } else {
          logger.info('[ShareService] Web Share dialog was cancelled by the user.')
        }
      }
    } else {
      logger.info('[ShareService] Web Share API not supported, falling back to clipboard.')
      this.copyToClipboard(url)
    }
  }
}

export const shareService = new ShareServiceController()
