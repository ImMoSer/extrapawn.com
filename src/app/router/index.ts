// src/router/index.ts
import { useGameStore } from '@/entities/game'
import { useGlobalTeardown } from '@/app/lib/useGlobalTeardown'
import { usePuzzleStore } from '@/features/puzzle'
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
import { RepertoireTrainingPage } from '@/pages/repertoire-training'

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
      redirect: '/theory-endings',
    },
    {
      path: '/tactics',
      name: 'tactics',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'tactics' },
      props: { submode: 'tactics' },
    },
    {
      path: '/finish-him',
      name: 'finish-him',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'finish_him' },
      props: { submode: 'finish_him' },
    },
    {
      path: '/practical-chess',
      name: 'practical-chess',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'practical_chess' },
      props: { submode: 'practical_chess' },
    },
    {
      path: '/theory-endings',
      name: 'theory-endings',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'theory_endings' },
      props: { submode: 'theory_endings' },
    },
    {
      path: '/workout/:type?/:puzzleId?',
      redirect: (to) => {
        if (to.params.type === 'tactics') return '/tactics'
        if (to.params.type === 'finish_him') return '/finish-him'
        if (to.params.type === 'practical_chess') return '/practical-chess'
        return '/theory-endings'
      }
    },
    {
      path: '/sparring',
      name: 'sparring',
      component: SparringPage,
      meta: { isGame: true, requiresAuth: true, game: 'sparring' },
    },
    {
      path: '/repertoire-training',
      name: 'repertoire-training',
      component: RepertoireTrainingPage,
      meta: {
        isGame: true,
        requiresAuth: true,
        game: 'repertoire-training',
        seo: {
          titleKey: 'seo.repertoireTraining.title',
          descriptionKey: 'seo.repertoireTraining.description',
        },
      },
    },
    {
      path: '/open-check',
      name: 'open-check',
      component: () => import('@/pages/open-check/ui/OpenCheckPage.vue'),
      meta: {
        requiresAuth: true,
        seo: {
          titleKey: 'seo.openCheck.title',
          descriptionKey: 'seo.openCheck.description',
        },
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
      path: '/endgame-analysis',
      name: 'endgame-analysis',
      component: () => import('@/pages/endgame-analysis/ui/EndgameAnalysisPage.vue'),
      meta: { requiresAuth: true },
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
  const t = i18n.global.t

  const puzzleGames = ['tactics', 'finish_him', 'practical_chess', 'theory_endings']
  const isFromPuzzle = puzzleGames.includes(String(from.meta.game))
  const isToPuzzle = puzzleGames.includes(String(to.meta.game))

  if (isFromPuzzle && !isToPuzzle) {
    usePuzzleStore().reset()
  }

  // Update SEO Meta Tags with translations
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
