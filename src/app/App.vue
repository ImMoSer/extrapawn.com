<!-- src/app/App.vue -->
<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { LanguageInitModal, LegalConsentModal, SettingsMenu } from '@/features/settings'
import { useViewportMode } from '@/shared/lib/layout/useViewportMode'
import { usePwaInstall } from '@/shared/lib/pwa/usePwaInstall'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'
import { naiveThemeOverrides } from '@/shared/theme/naive-overrides'
import { isDarkMode, toggleColorMode } from '@/shared/theme/tokens'
import ConfirmationModal from '@/shared/ui/ConfirmationModal.vue'
import { NavMenu } from '@/widgets/nav-menu'
import { DownloadOutline, MenuOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { darkTheme } from 'naive-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'
import AppUpdateNotifier from './ui/AppUpdateNotifier.vue'

const route = useRoute()
const { t, locale } = useI18n()
const { isDesktopShell } = useViewportMode()
const { canInstall, promptInstall } = usePwaInstall()

async function handleInstallApp(): Promise<void> {
  const accepted = await promptInstall()
  if (accepted) {
    isDrawerOpen.value = false
  }
}

watch(locale, () => {
  updateSeoWithRoute(route.meta as RouteMetaWithSeo, t)
})

const isDrawerOpen = ref(false)

const openDrawer = () => {
  isDrawerOpen.value = true
}

watch(isDesktopShell, (desktop) => {
  if (desktop && isDrawerOpen.value) {
    isDrawerOpen.value = false
  }
})

const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  const gameStore = useGameStore()
  if (gameStore.isGameActive) {
    event.preventDefault()
    event.returnValue = t('features.gameplay.confirmExit.browserMessage')
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})
</script>

<template>
  <n-config-provider :theme="isDarkMode ? darkTheme : null" :theme-overrides="naiveThemeOverrides">
    <n-message-provider :duration="6000">
      <n-dialog-provider>
        <div class="flex h-dvh w-screen overflow-hidden bg-canvas text-text-primary">
          <!-- Fixed Collapsed Desktop NavRail (Landscape >= 900px) -->
          <aside
            v-if="isDesktopShell"
            class="z-50 flex h-full w-[var(--nav-rail-w)] shrink-0 flex-col border-r border-border bg-surface select-none"
          >
            <!-- Top Action Bar (Settings + Dark/Light Mode Switcher) -->
            <div class="flex flex-col items-center justify-center gap-1 border-b border-border px-2 py-2">
              <SettingsMenu />
              <button
                type="button"
                class="flex cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-2 text-text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-text-primary"
                :title="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                :aria-label="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                @click="toggleColorMode"
              >
                <n-icon class="text-[1.25rem]">
                  <SunnyOutline v-if="isDarkMode" />
                  <MoonOutline v-else />
                </n-icon>
              </button>
            </div>

            <!-- Brand Mark -->
            <div class="flex min-h-[50px] items-center justify-center border-b border-border/60 px-2 py-2.5">
              <RouterLink
                to="/"
                class="flex items-center justify-center no-underline"
                title="EXTRAPAWN"
                aria-label="EXTRAPAWN"
              >
                <img
                  src="/webp/extra_pawn_black.webp"
                  alt="EXTRAPAWN"
                  width="28"
                  height="28"
                  class="h-7 w-7 object-contain"
                />
              </RouterLink>
            </div>

            <!-- Always-Collapsed Icon Navigation -->
            <div class="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <NavMenu :collapsed="true" />
            </div>

            <!-- Optional PWA Install Action (Desktop Chrome/Edge when installable) -->
            <div
              v-if="canInstall"
              class="flex items-center justify-center border-t border-border px-2 py-2"
            >
              <button
                type="button"
                class="flex cursor-pointer items-center justify-center rounded-md border border-brand/40 bg-brand/10 p-2 text-brand transition-colors hover:bg-brand hover:text-on-brand"
                :title="t('shared.nav.installAppTitle')"
                :aria-label="t('shared.nav.installAppTitle')"
                @click="handleInstallApp"
              >
                <n-icon class="text-[1.25rem]">
                  <DownloadOutline />
                </n-icon>
              </button>
            </div>
          </aside>

          <!-- Main Viewport Shell -->
          <div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <!-- Mobile / Portrait Header -->
            <header
              v-if="!isDesktopShell"
              class="relative z-40 flex h-[var(--mobile-header-h)] shrink-0 items-center justify-between border-b border-border bg-surface px-4"
            >
              <n-button
                quaternary
                circle
                title="Open navigation menu"
                aria-label="Open navigation menu"
                @click="openDrawer"
              >
                <template #icon>
                  <n-icon>
                    <MenuOutline />
                  </n-icon>
                </template>
              </n-button>

              <RouterLink
                v-if="route.path !== '/'"
                to="/"
                class="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 no-underline"
              >
                <img
                  src="/webp/extra_pawn_black.webp"
                  alt="EXTRAPAWN"
                  width="24"
                  height="24"
                  class="h-6 w-auto object-contain"
                />
                <span class="brand-text m-0 text-base whitespace-nowrap">EXTRAPAWN</span>
              </RouterLink>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="flex cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
                  :title="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                  :aria-label="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
                  @click="toggleColorMode"
                >
                  <n-icon class="text-[1.25rem]">
                    <SunnyOutline v-if="isDarkMode" />
                    <MoonOutline v-else />
                  </n-icon>
                </button>
                <SettingsMenu />
              </div>
            </header>

            <!-- Active Page / Game Stage -->
            <main class="relative min-h-0 w-full flex-1 overflow-hidden bg-canvas">
              <RouterView />
            </main>
          </div>

          <!-- Mobile Menu Drawer (Portrait / Compact) -->
          <n-drawer
            v-model:show="isDrawerOpen"
            placement="left"
            :width="280"
            class="border-r border-border bg-surface"
          >
            <n-drawer-content
              closable
              :body-content-style="{ padding: 0 }"
              class="bg-surface text-text-primary"
            >
              <template #header>
                <RouterLink
                  to="/"
                  class="flex w-full items-center justify-center no-underline"
                  @click="isDrawerOpen = false"
                >
                  <n-space align="center" :wrap="false">
                    <img
                      src="/webp/extra_pawn_black.webp"
                      alt="Logo"
                      class="h-8 w-auto object-contain"
                    />
                    <span class="brand-text text-lg">EXTRAPAWN</span>
                  </n-space>
                </RouterLink>
              </template>
              <NavMenu :collapsed="false" @select="isDrawerOpen = false" />

              <template v-if="canInstall" #footer>
                <div class="w-full">
                  <n-button
                    type="primary"
                    block
                    :title="t('shared.nav.installAppTitle')"
                    @click="handleInstallApp"
                  >
                    <template #icon>
                      <n-icon><DownloadOutline /></n-icon>
                    </template>
                    {{ t('shared.nav.installApp') }}
                  </n-button>
                </div>
              </template>
            </n-drawer-content>
          </n-drawer>

          <ConfirmationModal />
          <LanguageInitModal />
          <LegalConsentModal />
          <AppUpdateNotifier />
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
