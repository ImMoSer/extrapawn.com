<!-- src/app/App.vue -->
<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { LanguageInitModal, LegalConsentModal, SettingsMenu } from '@/features/settings'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'
import { naiveThemeOverrides } from '@/shared/theme/naive-overrides'
import { isDarkMode, toggleColorMode } from '@/shared/theme/tokens'
import ConfirmationModal from '@/shared/ui/ConfirmationModal.vue'
import { NavMenu } from '@/widgets/nav-menu'
import { MenuOutline, MoonOutline, SunnyOutline } from '@vicons/ionicons5'
import { darkTheme } from 'naive-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'
import AppUpdateNotifier from './ui/AppUpdateNotifier.vue'

const route = useRoute()
const { t, locale } = useI18n()

watch(locale, () => {
  updateSeoWithRoute(route.meta as RouteMetaWithSeo, t)
})

const isLandscape = ref(false)
const isSidebarCollapsed = ref(true)
const isDrawerOpen = ref(false)

const openDrawer = () => {
  isDrawerOpen.value = true
}

const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  const gameStore = useGameStore()
  if (gameStore.isGameActive) {
    event.preventDefault()
    event.returnValue = t('features.gameplay.confirmExit.browserMessage')
  }
}

const mediaQuery = window.matchMedia('(min-width: 769px) and (orientation: landscape)')
const updateLandscape = () => (isLandscape.value = mediaQuery.matches)

onMounted(() => {
  mediaQuery.addEventListener('change', updateLandscape)
  updateLandscape()
  window.addEventListener('beforeunload', beforeUnloadHandler)
})

onUnmounted(() => {
  mediaQuery.removeEventListener('change', updateLandscape)
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})
</script>

<template>
  <n-config-provider :theme="isDarkMode ? darkTheme : null" :theme-overrides="naiveThemeOverrides">
    <n-message-provider :duration="6000">
      <n-dialog-provider>
        <n-layout has-sider position="absolute" class="h-screen bg-canvas">
          <!-- Desktop Sidebar (Landscape) -->
          <n-layout-sider
            v-if="isLandscape"
            bordered
            collapse-mode="width"
            :collapsed-width="64"
            :width="260"
            :collapsed="isSidebarCollapsed"
            show-trigger
            class="z-1000 bg-surface border-r border-border"
            @collapse="isSidebarCollapsed = true"
            @expand="isSidebarCollapsed = false"
          >
            <!-- Top Action Bar (Settings + Dark/Light Mode Switcher) -->
            <div
              class="py-2 px-2 flex items-center justify-center border-b border-border"
              :class="isSidebarCollapsed ? 'flex-col gap-1' : 'flex-row gap-2'"
            >
              <SettingsMenu />
              <button
                type="button"
                class="p-2 rounded-md flex items-center justify-center bg-transparent border border-transparent text-text-secondary hover:text-text-primary hover:bg-elevated hover:border-border cursor-pointer transition-colors"
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

            <div class="py-2.5 px-4 flex items-center justify-center min-h-[50px] border-b border-border/60">
              <RouterLink to="/" class="flex items-center justify-center no-underline">
                <img
                  v-if="isSidebarCollapsed"
                  src="/webp/extra_pawn_black.webp"
                  alt="Logo"
                  width="28"
                  height="28"
                  class="w-7 h-7 object-contain"
                />
                <div v-else class="flex items-center gap-2.5 w-full">
                  <img
                    src="/webp/extra_pawn_black.webp"
                    alt="EXTRAPAWN"
                    width="32"
                    height="32"
                    class="h-8 w-auto object-contain"
                  />
                  <span class="brand-text text-xl m-0">EXTRAPAWN</span>
                </div>
              </RouterLink>
            </div>

            <NavMenu :collapsed="isSidebarCollapsed" />
          </n-layout-sider>

          <n-layout class="h-screen bg-canvas">
            <!-- Mobile Header (Portrait) -->
            <n-layout-header
              v-if="!isLandscape"
              bordered
              class="h-14 px-4 flex items-center justify-between bg-surface border-b border-border relative"
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
                class="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 no-underline"
              >
                <img
                  src="/webp/extra_pawn_black.webp"
                  alt="EXTRAPAWN"
                  width="24"
                  height="24"
                  class="h-6 w-auto object-contain"
                />
                <span class="brand-text text-base m-0 whitespace-nowrap">EXTRAPAWN</span>
              </RouterLink>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-2 rounded-md flex items-center justify-center bg-transparent border border-transparent text-text-secondary hover:text-text-primary hover:bg-elevated cursor-pointer transition-colors"
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
            </n-layout-header>

            <!-- Page Content -->
            <n-layout-content
              :content-style="{ height: '100%' }"
              class="bg-canvas"
              :class="isLandscape ? 'h-screen' : 'h-[calc(100vh-56px)]'"
            >
              <RouterView />
            </n-layout-content>
          </n-layout>

          <!-- Mobile Menu Drawer (Swipe-out) -->
          <n-drawer
            v-model:show="isDrawerOpen"
            placement="left"
            :width="280"
            class="bg-surface border-r border-border"
          >
            <n-drawer-content
              closable
              :body-content-style="{ padding: 0 }"
              class="bg-surface text-text-primary"
            >
              <template #header>
                <RouterLink
                  to="/"
                  class="flex items-center justify-center no-underline w-full"
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
              <NavMenu @select="isDrawerOpen = false" />
            </n-drawer-content>
          </n-drawer>

          <ConfirmationModal />
          <LanguageInitModal />
          <LegalConsentModal />
          <AppUpdateNotifier />
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
