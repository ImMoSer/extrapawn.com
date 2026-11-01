<!-- src/app/App.vue -->
<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { LanguageInitModal, SettingsMenu } from '@/features/settings'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'
import { naiveThemeOverrides } from '@/shared/theme/naive-overrides'
import ConfirmationModal from '@/shared/ui/ConfirmationModal.vue'
import GalaxyBackground from '@/shared/ui/visuals/GalaxyBackground.vue'
import { NavMenu } from '@/widgets/nav-menu'
import { MenuOutline } from '@vicons/ionicons5'
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

const themeOverrides = naiveThemeOverrides

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
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider :duration="6000">
      <n-dialog-provider>
        <n-layout has-sider position="absolute" class="root-layout">
          <!-- Desktop Sidebar (Landscape) -->
          <n-layout-sider
            v-if="isLandscape"
            bordered
            collapse-mode="width"
            :collapsed-width="64"
            :width="260"
            :collapsed="isSidebarCollapsed"
            show-trigger
            class="app-sider"
            @collapse="isSidebarCollapsed = true"
            @expand="isSidebarCollapsed = false"
          >
            <!-- Top Action Bar (Settings) -->
            <div class="py-2 flex items-center justify-center border-b border-border">
              <SettingsMenu />
            </div>

            <div class="py-2 px-4 flex items-center justify-center min-h-[50px]">
              <RouterLink to="/" class="flex items-center justify-center no-underline">
                <img
                  v-if="isSidebarCollapsed"
                  src="/webp/extra_pawn_black.webp"
                  alt="Logo"
                  class="w-8 h-8 object-contain"
                />
                <div v-else class="flex items-center gap-2 w-full">
                  <img
                    src="/webp/extra_pawn_black.webp"
                    alt="EXTRAPAWN"
                    class="h-9 w-auto object-contain"
                  />
                  <span class="brand-text text-2xl tracking-wider m-0">EXTRAPAWN</span>
                </div>
              </RouterLink>
            </div>

            <NavMenu :collapsed="isSidebarCollapsed" />
          </n-layout-sider>

          <n-layout class="main-layout-container">
            <!-- Mobile Header (Portrait) -->
            <n-layout-header v-if="!isLandscape" bordered class="mobile-header">
              <n-button quaternary circle @click="openDrawer">
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
                  class="h-[26px] w-auto object-contain"
                />
                <span class="brand-text text-lg tracking-wider m-0 whitespace-nowrap">EXTRAPAWN</span>
              </RouterLink>

              <SettingsMenu />
            </n-layout-header>

            <!-- Page Content -->
            <n-layout-content :content-style="{ height: '100%' }" class="page-content">
              <RouterView />
            </n-layout-content>
          </n-layout>

          <!-- Mobile Menu Drawer (Swipe-out) -->
          <n-drawer
            v-model:show="isDrawerOpen"
            placement="left"
            :width="280"
            class="app-drawer"
          >
            <n-drawer-content closable class="mobile-drawer-content">
              <template #header>
                <RouterLink
                  to="/"
                  class="flex items-center justify-center no-underline"
                  @click="isDrawerOpen = false"
                >
                  <n-space align="center" :wrap="false">
                    <img
                      src="/webp/extra_pawn_black.webp"
                      alt="Logo"
                      class="h-9 w-auto object-contain"
                    />
                    <n-text strong class="brand-text text-xl tracking-wider">EXTRAPAWN</n-text>
                  </n-space>
                </RouterLink>
              </template>
              <NavMenu @select="isDrawerOpen = false" />
            </n-drawer-content>
          </n-drawer>

          <ConfirmationModal />
          <LanguageInitModal />
          <AppUpdateNotifier />
        </n-layout>
        <GalaxyBackground />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
.root-layout,
.main-layout-container {
  height: 100vh;
  background-color: transparent !important;
}

.app-sider,
.app-drawer {
  background-color: var(--glass-bg) !important;
  backdrop-filter: var(--glass-blur);
  z-index: 1000;
  border-right: 1px solid var(--glass-border) !important;
}

.mobile-drawer-content {
  background-color: transparent !important;
}

.mobile-drawer-content .n-drawer-body-content-wrapper {
  padding: 0;
}

.mobile-drawer-content .n-drawer-header__main {
  width: 100%;
}

.mobile-header {
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--glass-bg) !important;
  backdrop-filter: var(--glass-blur);
  border-bottom: 1px solid var(--glass-border) !important;
  position: relative;
}

.page-content {
  background-color: transparent !important;
  height: calc(100vh - 56px);
}

@media (min-width: 769px) and (orientation: landscape) {
  .page-content {
    height: 100vh;
  }
}
</style>
