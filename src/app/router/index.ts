import { useGameStore } from '@/entities/game'
import i18n from '@/shared/config/i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/entities/user'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'welcome',
      component: () => import('@/pages/welcome').then((m) => m.WelcomePage),
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
      component: () => import('@/pages/training-center').then((m) => m.TrainingCenterPage),
      props: { mode: 'course' },
      meta: { isGame: true, requiresAuth: true, game: 'training-center' },
    },
    {
      path: '/warmup',
      name: 'warmup',
      component: () => import('@/pages/training-center').then((m) => m.TrainingCenterPage),
      props: { mode: 'warmup' },
      meta: { isGame: true, requiresAuth: true, game: 'warmup' },
    },
    {
      path: '/kursdiplom/:courseId',
      name: 'course-diploma',
      component: () => import('@/pages/course-diploma').then((m) => m.CourseDiplomaPage),
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
      component: () => import('@/pages/user-cabinet').then((m) => m.UserCabinetPage),
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
      component: () => import('@/pages/about').then((m) => m.AboutPage),
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
      component: () => import('@/pages/legal').then((m) => m.LegalPage),
    },
    {
      path: '/pricing',
      name: 'pricing',
      component: () => import('@/pages/pricing').then((m) => m.PricingPage),
      meta: {
        seo: {
          titleKey: 'seo.pricing.title',
          descriptionKey: 'seo.pricing.description',
        },
      },
    },
    {
      path: '/courses',
      name: 'courses',
      component: () => import('@/pages/courses').then((m) => m.CoursesPage),
    },
    {
      path: '/club-player',
      name: 'club-player',
      component: () => import('@/pages/club-player').then((m) => m.ClubPlayerPage),
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

  const isPublicDeveloperCabinet =
    to.name === 'user-cabinet' &&
    typeof to.params.id === 'string' &&
    to.params.id.trim().toLowerCase() === 'mo3ep'
  const requiresAuth = Boolean(to.meta.requiresAuth) && !isPublicDeveloperCabinet
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
      await authStore.login(['email:read', 'preference:read'], to.fullPath)
      return false
    }
    if (!from.name) {
      return { name: 'welcome' }
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
