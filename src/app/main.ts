// src/main.ts
import '@/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

import i18n from '@/shared/config/i18n'
import FallbackApp from './FallbackApp.vue'

// Basic synchronous checks
const checkEnvironment = () => {
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'
  const isIsolated = window.crossOriginIsolated
  const hasCacheApi = 'caches' in window
  const hasOpfs = navigator.storage && typeof navigator.storage.getDirectory === 'function'

  return hasSharedArrayBuffer && isIsolated && hasCacheApi && hasOpfs
}

async function boot() {
  // Phase 0: Environment Validation (Fastest Check)
  if (!checkEnvironment()) {
    console.error('Environment check failed.')
    const app = createApp(FallbackApp)
    app.use(i18n)
    app.mount('#app')
    return
  }

  // Phase 1: Identity/Session Check (Prioritized)
  // We check Auth status BEFORE loading the rest of the app.
  const { useAuthStore } = await import('@/entities/user')
  const pinia = createPinia()
  const tempApp = createApp({}) // Temporary app for Pinia context
  tempApp.use(pinia)
  const authStore = useAuthStore()
  await authStore.initialize()

  // Branch A: User not logged in -> Show minimal Login Screen
  if (!authStore.isAuthenticated) {
    // Save the current path to redirect back after login
    if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
      localStorage.setItem(
        'redirect_after_login',
        window.location.pathname + window.location.search,
      )
    }

    const LoginApp = (await import('./LoginApp.vue')).default
    const loginApp = createApp(LoginApp)
    loginApp.use(pinia)
    loginApp.use(i18n)
    loginApp.mount('#app')
    return
  }

  // Branch B: User is logged in -> Load the full application
  // Phase 2: Application Assembly (Heavy Imports)
  const App = (await import('./App.vue')).default
  const router = (await import('./router')).default
  const { setupErrorHandler } = await import('./lib/error-handler')

  const app = createApp(App)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 60 * 5,
      },
    },
  })

  app.use(pinia)
  app.use(router)
  app.use(i18n)
  app.use(VueQueryPlugin, { queryClient })
  setupErrorHandler(app)

  // Handle post-login redirects
  const redirectPath = localStorage.getItem('redirect_after_login')
  if (redirectPath) {
    localStorage.removeItem('redirect_after_login')
    router.push(redirectPath)
  }

  // Phase 3: Mount Main App (Cabinet)
  app.mount('#app')
}

boot().catch(console.error)
