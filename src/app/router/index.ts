import { useGameStore } from '@/entities/game'
import i18n from '@/shared/config/i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/entities/user'

import { AboutPage } from '@/pages/about'
import { LegalPage } from '@/pages/legal'
import { PricingPage } from '@/pages/pricing'
import { WelcomePage } from '@/pages/welcome'
import { ClubPlayerPage } from '@/pages/club-player'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'

import { UserCabinetPage } from '@/pages/user-cabinet'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: WelcomePage,
      meta: {
        seo: {
          titleKey: 'seo.welcome.title',
          descriptionKey: 'seo.welcome.description',
        },
      },
    },
    {
      path: '/training',
      name: 'training-center',
      component: () => import('@/pages/task-today').then((m) => m.TaskTodayPage),
      props: { mode: 'course' },
      meta: { isGame: true, requiresAuth: true, game: 'training-center' },
    },
    {
      path: '/warmup',
      name: 'warmup',
      component: () => import('@/pages/task-today').then((m) => m.TaskTodayPage),
      props: { mode: 'warmup' },
      meta: { isGame: true, requiresAuth: true, game: 'warmup' },
    },
    {
      path: '/task-today/:pathMatch(.*)*',
      redirect: '/training',
    },
    {
      path: '/endgames',
      redirect: { path: '/warmup', query: { discipline: 'theoretical_endgames' } },
    },
    {
      path: '/tactics/:puzzleId?',
      redirect: { path: '/warmup', query: { discipline: 'tactics' } },
    },
    {
      path: '/finish-him/:puzzleId?',
      redirect: { path: '/warmup', query: { discipline: 'finishhim' } },
    },
    {
      path: '/practical-chess/:puzzleId?',
      redirect: { path: '/warmup', query: { discipline: 'practical_chess' } },
    },
    {
      path: '/theory-endings/:puzzleId?',
      redirect: { path: '/warmup', query: { discipline: 'theoretical_endgames' } },
    },
    {
      path: '/workout/:type?/:puzzleId?',
      redirect: (to) => {
        if (to.params.type === 'tactics') {
          return { path: '/warmup', query: { discipline: 'tactics' } }
        }
        if (to.params.type === 'finish_him') {
          return { path: '/warmup', query: { discipline: 'finishhim' } }
        }
        if (to.params.type === 'practical_chess') {
          return { path: '/warmup', query: { discipline: 'practical_chess' } }
        }
        return { path: '/warmup', query: { discipline: 'theoretical_endgames' } }
      },
    },
    {
      path: '/user-cabinet/:id?',
      name: 'user-cabinet',
      component: UserCabinetPage,
      meta: {
        requiresAuth: true,
        seo: {
          titleKey: 'seo.userCabinet.title',
          descriptionKey: 'seo.userCabinet.description',
        },
      },
    },
    {
      path: '/about',
      name: 'about',
      component: AboutPage,
      meta: {
        seo: {
          titleKey: 'seo.about.title',
          descriptionKey: 'seo.about.description',
        },
      },
    },
    {
      path: '/legal',
      name: 'legal',
      component: LegalPage,
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: PricingPage,
      meta: {
        seo: {
          titleKey: 'seo.pricing.title',
          descriptionKey: 'seo.pricing.description',
        },
      },
    },
    {
      path: '/club-player',
      name: 'club-player',
      component: ClubPlayerPage,
    },
    {
      path: '/bonus',
      redirect: '/club-player',
    },
    {
      path: '/learning-coach',
      redirect: '/training',
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/about',
    },
  ],
})

router.beforeEach(async (to, from) => {
  const authStore = useAuthStore()
  const t = i18n.global.t

  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.isLoading,
        (isLoading) => {
          if (!isLoading) {
            unwatch()
            resolve()
          }
        },
      )
    })
  }

  const requiresAuth = to.meta.requiresAuth
  const isAuthenticated = authStore.isAuthenticated

  if (requiresAuth && !isAuthenticated) {
    localStorage.setItem('redirect_after_login', to.fullPath)
    const uiStore = useUiStore()

    const userConfirmedLogin = await uiStore.showConfirmation(
      t('shared.auth.requiredForAction'),
      t('pages.userCabinet.loginPrompt'),
      {
        confirmText: t('shared.nav.loginWithLichess'),
        showCancel: true,
      },
    )

    if (userConfirmedLogin === 'confirm') {
      authStore.login()
    }
    return false
  }

  if (from.meta.isGame && to.meta.game !== from.meta.game) {
    const gameStore = useGameStore()
    const uiStore = useUiStore()
    if (gameStore.isGameActive) {
      const userConfirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )

      if (userConfirmed === 'confirm') {
        gameStore.stop()
        return
      } else {
        return false
      }
    } else {
      gameStore.stop()
      return
    }
  } else {
    return
  }
})

router.afterEach(async (to) => {
  const t = i18n.global.t

  updateSeoWithRoute(to.meta as RouteMetaWithSeo, t)
})

router.onError((error, to) => {
  const isChunkError =
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Failed to find module') ||
    error.message.includes('chunk')

  if (isChunkError) {
    console.warn('[Router] Chunk-Ladefehler erkannt. Erzwinge Reload auf neue Version:', error)
    window.location.href = to.fullPath
  }
})

export default router
