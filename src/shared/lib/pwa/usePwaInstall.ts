import { computed, ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isInstalled = ref<boolean>(false)
let initialized = false

function detectStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  const byMedia =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  const byNavigator = Boolean((window.navigator as NavigatorWithStandalone).standalone)
  return byMedia || byNavigator
}

function initPwaInstallListeners(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  isInstalled.value = detectStandaloneMode()

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    isInstalled.value = true
  })

  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(display-mode: standalone)')
    mql.addEventListener('change', (e) => {
      if (e.matches) {
        isInstalled.value = true
        deferredPrompt.value = null
      }
    })
  }
}

initPwaInstallListeners()

export function usePwaInstall() {
  initPwaInstallListeners()

  const canInstall = computed<boolean>(
    () => !isInstalled.value && deferredPrompt.value !== null,
  )

  async function promptInstall(): Promise<boolean> {
    const evt = deferredPrompt.value
    if (!evt) return false
    await evt.prompt()
    const choice = await evt.userChoice
    deferredPrompt.value = null
    if (choice.outcome === 'accepted') {
      isInstalled.value = true
      return true
    }
    return false
  }

  return {
    canInstall,
    isInstalled,
    promptInstall,
  }
}
