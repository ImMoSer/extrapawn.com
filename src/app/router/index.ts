// src/router/index.ts
import { useGameStore } from '@/entities/game'
import { usePuzzleStore } from '@/features/puzzle'
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
      path: '/endgames',
      redirect: '/theory-endings',
    },
    {
      path: '/tactics/:puzzleId?',
      name: 'tactics',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'tactics' },
      props: (route) => ({ submode: 'tactics', puzzleId: route.params.puzzleId }),
    },
    {
      path: '/finish-him/:puzzleId?',
      name: 'finish-him',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'finish_him' },
      props: (route) => ({ submode: 'finish_him', puzzleId: route.params.puzzleId }),
    },
    {
      path: '/practical-chess/:puzzleId?',
      name: 'practical-chess',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'practical_chess' },
      props: (route) => ({ submode: 'practical_chess', puzzleId: route.params.puzzleId }),
    },
    {
      path: '/theory-endings/:puzzleId?',
      name: 'theory-endings',
      component: () => import('@/pages/puzzle/ui/PuzzlePage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'theory_endings' },
      props: (route) => ({ submode: 'theory_endings', puzzleId: route.params.puzzleId }),
    },
    {
      path: '/workout/:type?/:puzzleId?',
      redirect: (to) => {
        if (to.params.type === 'tactics') return '/tactics'
        if (to.params.type === 'finish_him') return '/finish-him'
        if (to.params.type === 'practical_chess') return '/practical-chess'
        return '/theory-endings'
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
      redirect: '/workout',
    },
    {
      path: '/task-today/:planId?/:puzzleType?/:puzzleId?',
      name: 'task-today',
      component: () => import('@/pages/task-today').then((m) => m.TaskTodayPage),
      meta: { isGame: true, requiresAuth: true, game: 'task-today' },
      props: (route) => ({
        planId: route.params.planId,
        puzzleType: route.params.puzzleType,
        puzzleId: route.params.puzzleId,
      }),
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
