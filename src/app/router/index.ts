// src/router/index.ts
import { useGameStore } from '@/entities/game'
import { useGlobalTeardown } from '@/app/lib/useGlobalTeardown'
import { usePuzzleStore } from '@/features/puzzle'
import i18n from '@/shared/config/i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/entities/user'
import { useAccessControl } from '@/features/access-control'

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
      }
    },
    {
      path: '/sparring/:gameId?',
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
        requiresPaid: true,
        game: 'repertoire-training',
        seo: {
          titleKey: 'seo.repertoireTraining.title',
          descriptionKey: 'seo.repertoireTraining.description',
        },
      },
    },
    {
      path: '/user-cabinet/:id?',
      name: 'user-cabinet',
      component: UserCabinetPage,
      meta: {
        requiresAuth: true,
        requiresPaid: true,
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
      path: '/task-today/:planId?/:puzzleType?/:puzzleId?',
      name: 'task-today',
      component: () => import('@/pages/task-today/ui/TaskTodayPage.vue'),
      meta: { isGame: true, requiresAuth: true, game: 'task-today' },
      props: (route) => ({
        planId: route.params.planId,
        puzzleType: route.params.puzzleType,
        puzzleId: route.params.puzzleId,
      }),
    },
    {
      path: '/endgame-analysis',
      name: 'endgame-analysis',
      component: () => import('@/pages/endgame-analysis/ui/EndgameAnalysisPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/open-flow-test',
      name: 'open-flow-test',
      component: () => import('@/pages/open-flow-test/ui/OpenFlowTestPage.vue'),
    },
    {
      path: '/giftcode/:code',
      name: 'giftcode',
      component: () => import('@/pages/giftcode/ui/GiftCodeRedeemPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/about',
    },
  ],
})

router.beforeEach(async (to, from) => {
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

  const accessControl = useAccessControl()
  const requiresAuth = to.meta.requiresAuth
  const requiresPaid = to.meta.requiresPaid
  const isAuthenticated = authStore.isAuthenticated

  // Auto-redeem pending gift code after login if present
  const pendingGiftCode = localStorage.getItem('pending_gift_code')
  if (pendingGiftCode && isAuthenticated) {
    localStorage.removeItem('pending_gift_code')
    try {
      const { apiClient } = await import('@/shared/api/client')
      const res = await apiClient<{ success: boolean }>('/billing/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: pendingGiftCode })
      })
      if (res.success) {
        await authStore.checkSession()
        await uiStore.showConfirmation(
          t('puzzleCategories.tierRestriction.giftSuccess'),
          t('puzzleCategories.tierRestriction.message'),
          {
            confirmText: t('shared.buttons.confirm'),
            showCancel: false,
            variant: 'primary',
            icon: 'info'
          }
        )
      }
    } catch {
      // Ignored
    }
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
    return false
  }

  if (requiresPaid) {
    const hasAccess = await accessControl.requireFullAccess(undefined, '/')
    if (!hasAccess) return false
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
        return
      } else {
        return false
      }
    } else {
      const { triggerTeardown } = useGlobalTeardown()
      triggerTeardown()
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
