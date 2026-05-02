// src/router/index.ts
import { useGameStore } from '@/entities/game'
import { useFinishHimStore } from '@/features/finish-him'
import i18n from '@/shared/config/i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/entities/user'
import { useOpeningSparringStore } from '@/features/opening-sparring'
import { usePracticalChessStore } from '@/features/practical-chess'
import { useStudyStore } from '@/features/study'
import { useTheoryEndingsStore } from '@/features/theory-endings'
import { useTornadoStore } from '@/features/tornado'

import { AboutPage } from '@/pages/about'
import { FinishHimPage } from '@/pages/finish-him'
import { LegalPage } from '@/pages/legal'
import { PricingPage } from '@/pages/pricing'
import { RecordsPagePage as RecordsPage } from '@/pages/records-page'
import { WelcomePage } from '@/pages/welcome'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'

import { TornadoPage } from '@/pages/tornado'
import { TornadoMistakesPage } from '@/pages/tornado-mistakes'
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
      path: '/finish-him',
      name: 'finish-him-selection',
      component: () => import('@/pages/finish-him/ui/FinishHimSelectionPage.vue'),
      meta: {
        requiresAuth: true,
        gameMode: 'finish-him',
        seo: {
          titleKey: 'seo.finishHim.title',
          descriptionKey: 'seo.finishHim.description',
          keywordsKey: 'seo.finishHim.keywords',
        },
      },
    },
    {
      path: '/finish-him/play',
      name: 'finish-him-play',
      component: FinishHimPage,
      meta: { isGame: true, requiresAuth: true, game: 'finish-him' },
    },
    {
      path: '/finish-him/playout/:color/:fen',
      name: 'finish-him-playout',
      component: FinishHimPage,
      meta: { isGame: true, requiresAuth: true, game: 'finish-him' },
    },
    {
      path: '/finish-him/:puzzleId',
      name: 'finish-him-puzzle',
      component: FinishHimPage,
      meta: { isGame: true, requiresAuth: true, game: 'finish-him' },
    },
    {
      path: '/tornado',
      name: 'tornado-selection',
      component: () => import('@/pages/tornado/ui/TornadoSelectionPage.vue'),
      meta: {
        requiresAuth: true,
        gameMode: 'tornado',
        seo: {
          titleKey: 'seo.tornado.title',
          descriptionKey: 'seo.tornado.description',
          keywordsKey: 'seo.tornado.keywords',
        },
      },
    },
    {
      path: '/tornado/:mode',
      name: 'tornado',
      component: TornadoPage,
      meta: { isGame: true, requiresAuth: true, game: 'tornado' },
    },
    {
      path: '/tornado/mistakes',
      name: 'tornado-mistakes',
      component: TornadoMistakesPage,
      meta: { requiresAuth: true },
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
      path: '/diamond-hunter/:openingSlug?/:color?',
      name: 'diamond-hunter',
      component: () => import('@/pages/diamond-hunter').then((m) => m.DiamondHunterPage),
      meta: {
        isGame: true,
        game: 'opening-training',
        requiresAuth: true,
        seo: {
          titleKey: 'seo.diamondHunter.title',
          descriptionKey: 'seo.diamondHunter.description',
          keywordsKey: 'seo.diamondHunter.keywords',
        },
      },
    },
    {
      path: '/opening-sparring/:openingSlug?/:color?',
      name: 'opening-sparring',
      component: () => import('@/pages/opening-sparring').then((m) => m.OpeningSparringPage),
      meta: { isGame: true, game: 'opening-sparring', requiresAuth: true },
    },
    {
      path: '/opening-trainer/:openingSlug?/:color?',
      redirect: (to) => ({
        name: 'diamond-hunter',
        params: to.params,
      }),
    },
    {
      path: '/theory-endings',
      name: 'theory-endings-selection',
      component: () => import('@/pages/theory-ending/ui/TheoryEndingsSelectionPage.vue'),
      meta: {
        requiresAuth: true,
        gameMode: 'theory',
        seo: {
          titleKey: 'seo.theoryEndings.title',
          descriptionKey: 'seo.theoryEndings.description',
        },
      },
    },
    {
      path: '/theory-endings/play/:type?/:puzzleId?',
      name: 'theory-endings-play',
      component: () => import('@/pages/theory-ending').then((m) => m.TheoryEndingPage),
      meta: { isGame: true, requiresAuth: true, game: 'theory' },
    },
    {
      path: '/theory-endings/:type(win|draw)/:puzzleId',
      name: 'theory-endings-puzzle',
      component: () => import('@/pages/theory-ending').then((m) => m.TheoryEndingPage),
      meta: { isGame: true, requiresAuth: true, game: 'theory' },
    },
    {
      path: '/study/:studyId?/:chapterId?',
      name: 'study-view',
      component: () => import('@/pages/study').then((m) => m.StudyPage),
      meta: { isGame: true, game: 'study', requiresAuth: true },
    },
    {
      path: '/study/:lichessId/:color(white|black)',
      name: 'study-cloud',
      component: () => import('@/pages/study').then((m) => m.StudyPage),
      meta: { isGame: true, game: 'study', requiresAuth: false },
    },
    {
      path: '/study-speedrun',
      name: 'study-speedrun',
      component: () => import('@/pages/study-speedrun/ui/StudySpeedrunPage.vue'),
      meta: { isGame: true, game: 'study-speedrun', requiresAuth: true },
    },
    {
      path: '/practical-chess',
      name: 'practical-chess',
      component: () => import('@/pages/practical-chess/ui/PracticalChessSelectionPage.vue'),
      meta: { requiresAuth: true, gameMode: 'practical' },
    },
    {
      path: '/practical-chess/play/:id?',
      name: 'practical-chess-play',
      component: () => import('@/pages/practical-chess').then((m) => m.PracticalChessPage),
      meta: { isGame: true, requiresAuth: true, game: 'practical-chess' },
    },
    {
      path: '/practical-chess/:id',
      name: 'practical-chess-puzzle',
      component: () => import('@/pages/practical-chess').then((m) => m.PracticalChessPage),
      meta: { isGame: true, requiresAuth: true, game: 'practical-chess' },
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
  const studyStore = useStudyStore()
  const t = i18n.global.t

  if (studyStore.cloudLoading) {
    await uiStore.showConfirmation(t('common.actions.error'), t('features.study.manager.messages.syncInProgress'), {
      confirmText: t('common.actions.ok'),
      showCancel: false,
    })
    return next(false)
  }

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
    const isTornadoToMistakes = from.name === 'tornado' && to.name === 'tornado-mistakes'

    if (gameStore.isGameActive && !isTornadoToMistakes) {
      const userConfirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )

      if (userConfirmed === 'confirm') {
        await gameStore.handleGameResignation()
        await gameStore.resetGame()
        next()
      } else {
        next(false)
      }
    } else {
      await gameStore.resetGame()
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

  // Исключение для перехода из режима "Торнадо" на страницу ошибок "Торнадо"
  const isTornadoToMistakes = fromBaseRoute === 'tornado' && toBaseRoute === 'tornado-mistakes'

  if (fromBaseRoute === 'finish-him' && toBaseRoute !== 'finish-him') {
    useFinishHimStore().reset()
  } else if (fromBaseRoute === 'tornado' && toBaseRoute !== 'tornado' && !isTornadoToMistakes) {
    useTornadoStore().reset()
  } else if (fromBaseRoute?.startsWith('theory-endings') && !toBaseRoute?.startsWith('theory-endings')) {
    useTheoryEndingsStore().reset()
  } else if (fromBaseRoute?.startsWith('practical-chess') && !toBaseRoute?.startsWith('practical-chess')) {
    usePracticalChessStore().reset()
  } else if (fromBaseRoute === 'opening-sparring' && toBaseRoute !== 'opening-sparring') {
    useOpeningSparringStore().reset()
  }

  // Update SEO Meta Tags with translations
  updateSeoWithRoute(to.meta as RouteMetaWithSeo, t)
})

export default router
