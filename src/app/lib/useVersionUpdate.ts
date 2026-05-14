import { useDialog } from 'naive-ui'
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

export function useVersionUpdate() {
  const { t } = useI18n()
  const dialog = useDialog()
  const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION

  // Intervall für den Check (alle 10 Minuten)
  let checkInterval: ReturnType<typeof setInterval> | null = null

  const checkForUpdate = async () => {
    // Nur im Produktionsmodus prüfen
    if (import.meta.env.DEV) return

    try {
      // Fetch version.json mit Cache-Bust (t=timestamp)
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })

      if (!response.ok) return

      const data = await response.json()

      if (data.version && data.version !== CURRENT_VERSION) {
        showUpdateModal(data.version)
        // Check stoppen, wenn Modal offen
        if (checkInterval) clearInterval(checkInterval)
      }
    } catch (e) {
      console.warn('Version check failed', e)
    }
  }

  const showUpdateModal = (newVersion: string) => {
    dialog.success({
      title: t('common.updateNotification.title'),
      content: t('common.updateNotification.content', { version: newVersion }),
      positiveText: t('common.updateNotification.button'),
      closable: false,
      maskClosable: false,
      onPositiveClick: () => {
        handleHardReload()
      },
    })
  }

  const handleHardReload = async () => {
    // 1. Service Worker Caches löschen (falls vorhanden)
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    // 2. LocalStorage Cache Keys löschen (falls du welche nutzt)
    // localStorage.clear() // Optional: Zu radikal?

    // 3. Harter Reload
    window.location.reload()
  }

  onMounted(() => {
    // Sofort beim Start prüfen
    checkForUpdate()

    // Dann alle 10 Minuten im Hintergrund
    checkInterval = setInterval(checkForUpdate, 10 * 60 * 1000)
  })

  onUnmounted(() => {
    if (checkInterval) clearInterval(checkInterval)
  })
}
