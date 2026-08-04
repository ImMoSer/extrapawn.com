<!-- src/App.vue -->
<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { SettingsMenu, LanguageInitModal } from '@/features/settings'
import ConfirmationModal from '@/shared/ui/ConfirmationModal.vue'
import GalaxyBackground from '@/shared/ui/visuals/GalaxyBackground.vue'
import GlobalAssetLoader from './GlobalAssetLoader.vue'
import { NavMenu } from '@/widgets/nav-menu'
import AppUpdateNotifier from './ui/AppUpdateNotifier.vue'
import TelegramPromptNotifier from './ui/TelegramPromptNotifier.vue'
import MessageBridge from './ui/MessageBridge.vue'
import { naiveThemeOverrides } from '@/shared/theme/naive-overrides'
import { MenuOutline } from '@vicons/ionicons5'
import { darkTheme } from 'naive-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute } from 'vue-router'
import { updateSeoWithRoute, type RouteMetaWithSeo } from '@/shared/lib/seo'
import { useCrashtestStore } from '@/features/crashtest'
import { useDemoplayStore, DemoplayCompleteModal, DemoplayIntroModal } from '@/features/demoplay'

const gameStore = useGameStore()
const crashtestStore = useCrashtestStore()
const demoplayStore = useDemoplayStore()
const route = useRoute()
const { t, locale } = useI18n()

// Update SEO when locale changes
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

// Обработчик для перезагрузки/закрытия страницы
const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  if (gameStore.isGameActive) {
    event.preventDefault()
    event.returnValue = t('features.gameplay.confirmExit.browserMessage')
  }
}

const mediaQuery = window.matchMedia('(min-width: 769px) and (orientation: landscape)')
const updateLandscape = () => (isLandscape.value = mediaQuery.matches)

onMounted(() => {
  mediaQuery.addEventListener('change', updateLandscape)
  updateLandscape() // Initial check
  window.addEventListener('beforeunload', beforeUnloadHandler)
  crashtestStore.init()
  demoplayStore.init()
})

onUnmounted(() => {
  mediaQuery.removeEventListener('change', updateLandscape)
  window.removeEventListener('beforeunload', beforeUnloadHandler)
})
</script>

<template>
  <GlobalAssetLoader>
    <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
      <n-message-provider :duration="6000">
        <MessageBridge />
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
              <div class="sider-top-bar">
                <SettingsMenu />
              </div>

              <div class="sider-header">
                <RouterLink to="/" class="logo-link">
                  <img
                    v-if="isSidebarCollapsed"
                    src="/webp/extra_pawn_black.webp"
                    alt="Logo"
                    class="logo-collapsed"
                  />
                  <div v-else class="brand-wrapper-sidebar">
                    <img
                      src="/webp/extra_pawn_black.webp"
                      alt="EXTRAPAWN"
                      class="sidebar-logo-icon"
                    />
                    <span class="brand-text sidebar-brand-name">EXTRAPAWN</span>
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

                <RouterLink v-if="route.path !== '/'" to="/" class="mobile-logo">
                  <img src="/webp/extra_pawn_black.webp" alt="EXTRAPAWN" class="mobile-logo-icon" />
                  <span class="brand-text mobile-brand-name">EXTRAPAWN</span>
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
              style="
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border-right: 1px solid var(--glass-border);
              "
            >
              <n-drawer-content closable class="mobile-drawer-content">
                <template #header>
                  <RouterLink
                    to="/"
                    class="logo-link"
                    style="text-decoration: none"
                    @click="isDrawerOpen = false"
                  >
                    <n-space align="center" :wrap="false">
                      <img src="/webp/extra_pawn_black.webp" alt="Logo" class="sidebar-logo-icon" />
                      <n-text
                        strong
                        class="brand-text sidebar-brand-name"
                        style="font-size: 1.2rem !important"
                        >EXTRAPAWN</n-text
                      >
                    </n-space>
                  </RouterLink>
                </template>
                <NavMenu @select="isDrawerOpen = false" />
              </n-drawer-content>
            </n-drawer>

            <ConfirmationModal />
            <LanguageInitModal />
            <DemoplayCompleteModal />
            <DemoplayIntroModal />
            <AppUpdateNotifier />
            <TelegramPromptNotifier />
          </n-layout>
          <GalaxyBackground />
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </GlobalAssetLoader>
</template>

<style>
/* Global Layout Fixes */
.root-layout {
  height: 100vh;
  background-color: transparent !important;
}

.main-layout-container {
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

.mobile-drawer-content :deep(.n-drawer-body-content-wrapper) {
  padding: 0;
}

.sider-top-bar {
  padding: 8px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid var(--glass-border);
}

.sider-header {
  padding: 8px 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50px;
}

.logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-full {
  max-width: 150px;
  height: auto;
}

.logo-collapsed {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.brand-wrapper-sidebar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.sidebar-logo-icon {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.sidebar-brand-name {
  font-size: 1.5rem;
  letter-spacing: 0.05em;
  margin: 0;
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

.mobile-logo {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.mobile-logo-icon {
  height: 26px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 6px rgba(0, 242, 255, 0.3));
}

.mobile-brand-name {
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  margin: 0;
  white-space: nowrap;
}

.mobile-drawer-content :deep(.n-drawer-header__main) {
  width: 100%;
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
