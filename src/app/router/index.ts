// src/router/index.ts
import { useGameStore } from '@/entities/game'
import { useGlobalTeardown } from '@/app/lib/useGlobalTeardown'
import { useEndgamesStore } from '@/features/endgames'
import { useTacticsStore } from '@/features/tactics'
import i18n from '@/shared/config/i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/entities/user'
import { InsufficientPawnCoinsError } from '@/shared/api/client'

import { AboutPage } from '@/pages/about'
import { LegalPage } from '@/pages/legal'
import { PricingPage } from '@/pages/pricing'
import { RecordsPagePage as RecordsPage } from '@/pages/records-page'
import { WelcomePage } from '@/pages/welcome'
import { SparringPage } from '@/pages/sparring'
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
      path: '/endgames',
      name: 'endgames',
      component: () => import('@/pages/endgames/ui/Endgames.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'endgames' },
    },
    {
      path: '/tactics',
      name: 'tactics',
      component: () => import('@/pages/tactics/ui/Tactics.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'tactics' },
    },
    {
      path: '/finish-him',
      redirect: '/endgames',
    },
    {
      path: '/workout/:type?/:puzzleId?',
      redirect: (to) => {
        if (to.params.type === 'tactics') return '/tactics'
        return '/endgames'
      }
    },
    {
      path: '/sparring',
      name: 'sparring',
      component: SparringPage,
      meta: { isGame: true, requiresAuth: true, game: 'sparring' },
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
      path: '/records/:id?',
      name: 'records',
      component: RecordsPage,
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
      path: '/bonus',
      name: 'bonus',
      component: () => import('@/pages/bonus/ui/BonusView.vue'),
    },
    {
      path: '/learning-coach',
      redirect: '/workout',
    },
    {
      path: '/theory-endings',
      redirect: '/endgames',
    },
    {
      path: '/task-today',
      name: 'task-today',
      component: () => import('@/pages/task-today/ui/TaskTodayPage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'task-today' },
    },
    {
      path: '/practical-chess',
      redirect: '/endgames',
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/about',
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const gameStore = useGameStore()
  const uiStore = useUiStore()
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

  if (to.meta.isGame && authStore.isDailyLimitExceeded()) {
    const error = new InsufficientPawnCoinsError('Daily PawnCoins limit exceeded', 5, 0)
    uiStore.handlePawnCoinsError(
      error,
      () => {}
    )
    return next('/pricing')
  }

  // Bypass auth for "example" mode
  if (to.params.id === 'example') {
    return next()
  }

  if (requiresAuth && !isAuthenticated) {
    localStorage.setItem('redirect_after_login', to.fullPath)

    const userConfirmedLogin = await uiStore.showConfirmation(
      t('features.auth.requiredForAction'),
      t('features.userCabinet.loginPrompt'),
      {
        confirmText: t('nav.loginWithLichess'),
        showCancel: true,
      },
    )

    if (userConfirmedLogin === 'confirm') {
      authStore.login()
    }
    return next(false)
  }

  if (from.meta.isGame && to.meta.game !== from.meta.game) {
    if (gameStore.isGameActive) {
      const userConfirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )

      if (userConfirmed === 'confirm') {
        const { triggerTeardown } = useGlobalTeardown()
        triggerTeardown()
        next()
      } else {
        next(false)
      }
    } else {
      const { triggerTeardown } = useGlobalTeardown()
      triggerTeardown()
      next()
    }
  } else {
    next()
  }
})

router.afterEach(async (to, from) => {
  const fromBaseRoute = String(from.name)
  const toBaseRoute = String(to.name)
  const t = i18n.global.t

  if (fromBaseRoute?.startsWith('endgames') && !toBaseRoute?.startsWith('endgames')) {
    useEndgamesStore().reset()
  }
  if (fromBaseRoute?.startsWith('tactics') && !toBaseRoute?.startsWith('tactics')) {
    useTacticsStore().reset()
  }

  // Update SEO Meta Tags with translations
  updateSeoWithRoute(to.meta as RouteMetaWithSeo, t)
})

export default router
