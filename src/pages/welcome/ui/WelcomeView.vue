<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import {
  BookOutline,
  BuildOutline,
  DiamondOutline,
  FlashOutline,
  HammerOutline,
  LogInOutline,
  PersonOutline,
  SchoolOutline,
  ThunderstormOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// Инициализируем хранилище, роутер и i18n
const authStore = useAuthStore()
const { t, locale } = useI18n()

// Получаем реактивные свойства из хранилища
const { isAuthenticated, isLoading, error } = storeToRefs(authStore)

// Метод для обработки входа
const handleLogin = async () => {
  if (isLoading.value) {
    return
  }
  await authStore.login()
}

// Метод для смены языка
const handleChangeLang = (lang: 'en' | 'ru' | 'de') => {
  changeLang(lang)
}

// Конфигурация карточек меню для чистоты кода в шаблоне
const menuItems = [
  {
    path: '/finish-him',
    icon: HammerOutline,
    labelKey: 'welcome.buttons.finishHim',
    color: 'var(--neon-pink)',
  },
  {
    path: '/tornado',
    icon: ThunderstormOutline,
    labelKey: 'welcome.buttons.tornado',
    color: 'var(--neon-cyan)',
  },
  {
    path: '/theory-endings',
    icon: BookOutline,
    labelKey: 'welcome.buttons.theoryEndgames',
    color: 'var(--neon-purple)',
  },
  {
    path: '/practical-chess',
    icon: BuildOutline,
    labelKey: 'welcome.buttons.practicalChess',
    color: 'var(--neon-orange)',
  },
  {
    path: '/diamond-hunter',
    icon: DiamondOutline,
    labelKey: 'welcome.buttons.diamondHunter',
    color: 'var(--neon-lime)',
  },
  {
    path: '/opening-sparring',
    icon: FlashOutline,
    labelKey: 'welcome.buttons.openingSparring',
    color: 'var(--neon-pink)',
  },
  {
    path: '/study',
    icon: SchoolOutline,
    labelKey: 'welcome.buttons.repertoire',
    color: 'var(--neon-lime)',
  },
  {
    path: '/user-cabinet',
    icon: PersonOutline,
    labelKey: 'nav.userCabinet',
    color: 'var(--neon-orange)',
  },
  {
    path: '/records',
    icon: TrophyOutline,
    labelKey: 'welcome.buttons.leaderboards',
    color: 'var(--neon-yellow)',
  },
]

// Mobile detection logic
const isMobile = ref(false)
const updateMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  updateMobile()
  window.addEventListener('resize', updateMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobile)
})

// Filter items for mobile (hide 'study')
const filteredMenuItems = computed(() => {
  if (isMobile.value) {
    return menuItems.filter((item) => item.path !== '/study')
  }
  return menuItems
})
</script>

<template>
  <div class="welcome-container">
    <div class="content-wrapper">
      <!-- Hero Section -->
      <div class="hero-section">
        <div class="brand-group">
          <img src="/png/extra_pawn_black.png" alt="EXTRAPAWN" class="hero-logo" />
          <div class="brand-text-content">
            <h1 class="brand-name brand-text">EXTRAPAWN</h1>
            <p class="brand-slogan">{{ t('welcome.slogan') }}</p>
          </div>
        </div>

        <!-- Login Button (Visible only if not authenticated) -->
        <div v-if="!isAuthenticated" class="auth-section">
          <n-button
            type="primary"
            size="large"
            :loading="isLoading"
            class="login-btn"
            @click="handleLogin"
          >
            <template #icon>
              <n-icon><LogInOutline /></n-icon>
            </template>
            {{ t('nav.loginWithLichess') }}
          </n-button>
        </div>

        <n-text v-if="error" type="error" class="error-text">
          {{ `Error: ${error}` }}
        </n-text>
      </div>

      <!-- Mode Selection Grid -->
      <n-grid x-gap="20" y-gap="20" cols="2 s:3 m:3 l:3" responsive="screen" class="menu-grid">
        <n-grid-item v-for="item in filteredMenuItems" :key="item.path">
          <router-link :to="item.path" custom v-slot="{ navigate }">
            <n-card
              hoverable
              class="menu-card glass-card"
              @click="navigate"
              :bordered="false"
              :style="{ '--card-glow-color': item.color }"
            >
              <div class="card-content">
                <n-icon size="34" :color="item.color" class="card-icon">
                  <component :is="item.icon" />
                </n-icon>
                <n-text class="card-title">
                  {{ t(item.labelKey) }}
                </n-text>
              </div>
            </n-card>
          </router-link>
        </n-grid-item>
      </n-grid>

      <!-- Language Switcher -->
      <div class="footer-section">
        <n-space justify="center" size="small">
          <button
            class="lang-text-btn"
            :class="{ active: locale === 'en' }"
            @click="handleChangeLang('en')"
          >
            EN
          </button>
          <span class="lang-divider">|</span>
          <button
            class="lang-text-btn"
            :class="{ active: locale === 'ru' }"
            @click="handleChangeLang('ru')"
          >
            RU
          </button>
          <span class="lang-divider">|</span>
          <button
            class="lang-text-btn"
            :class="{ active: locale === 'de' }"
            @click="handleChangeLang('de')"
          >
            DE
          </button>
        </n-space>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-container {
  height: 100%;
  width: 100%;
  background: none;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 10px;
  box-sizing: border-box;
  overflow: hidden; /* Prevent scrolling */
}

.content-wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1000px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2vh; /* Use vh for dynamic vertical spacing */
}

.hero-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  flex-shrink: 0;
}

.hero-logo {
  height: clamp(100px, 25vh, 500px);
  width: auto;
  filter: drop-shadow(0 0 15px rgba(0, 242, 255, 0.2));
}

.brand-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  animation: float 6s ease-in-out infinite;
}

.brand-text-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.brand-name {
  margin: 0;
  font-size: clamp(2rem, 6vw, 4.5rem);
  line-height: 1;
}

.brand-slogan {
  margin: 0;
  font-size: clamp(0.7rem, 1.5vw, 1.2rem);
  font-weight: 400;
  color: var(--color-text-muted);
  letter-spacing: 0.25rem;
  text-transform: uppercase;
  opacity: 0.7;
  text-align: center;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.auth-section {
  margin-top: 5px;
}

.menu-grid {
  width: 100%;
  flex-grow: 1; /* Allow grid to take available space */
  display: flex; /* Fix for centering content if needed, though grid handles cols */
  align-content: center; /* Center rows vertically if they don't fill */
  justify-content: center;
  max-height: 60vh;
}

/* Glassmorphism Card Style */
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--panel-border-radius, 16px);
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: pointer;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* Subtle underlying colored gradient that fades in on hover */
.glass-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, var(--card-glow-color) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
  mix-blend-mode: screen;
}

.glass-card:hover {
  transform: translateY(-5px) scale(1.02);
  border-color: var(--card-glow-color);
  background: rgba(255, 255, 255, 0.06);
  box-shadow:
    0 10px 40px -10px rgba(0, 0, 0, 0.7),
    0 0 25px -5px var(--card-glow-color);
  z-index: 2;
}

.glass-card:hover::before {
  opacity: 0.15;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 10px;
  text-align: center;
  width: 100%;
  position: relative;
  z-index: 1;
}

.card-icon {
  color: var(--card-glow-color) !important;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.1));
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.glass-card:hover .card-icon {
  transform: scale(1.15);
  filter: drop-shadow(0 0 12px var(--card-glow-color));
}

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #e0e0e0;
  text-transform: uppercase;
  transition: all 0.3s ease;
}

.glass-card:hover .card-title {
  color: #fff;
  text-shadow: 0 0 10px var(--card-glow-color);
}

.footer-section {
  margin-top: auto;
  padding: 10px 0;
  flex-shrink: 0;
}

/* Custom Text Buttons for Language to match App style */
.lang-text-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  padding: 0 5px;
  transition: color 0.2s;
}

.lang-text-btn:hover {
  color: var(--color-text-default);
}

.lang-text-btn.active {
  color: var(--color-accent-primary);
  font-weight: bold;
}

.lang-divider {
  color: var(--color-text-muted);
  opacity: 0.5;
}

/* Mobile Adaptation */
@media (max-width: 768px) {
  .content-wrapper {
    gap: 1.4vh;
  }

  .hero-section {
    gap: 10px;
  }

  .brand-group {
    gap: 10px;
  }

  .brand-text-content {
    gap: 5px;
  }

  .hero-logo {
    height: 15vh;
  }

  .brand-name {
    font-size: 2.2rem;
  }

  .menu-grid {
    gap: 6px !important;
  }

  .glass-card {
    border-radius: 6px;
  }

  .card-content {
    padding: 6px;
    gap: 4px;
  }

  .card-icon {
    font-size: 20px !important;
  }

  .card-title {
    font-size: 0.75rem;
  }
}
</style>
