<script setup lang="ts">
import { authService } from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n({ useScope: 'global' })

const handleLogin = async () => {
  // Lichess redirect
  await authService.login(['email:read', 'preference:read'])
}

const handleChangeLang = (lang: 'en' | 'ru' | 'de') => {
  changeLang(lang)
}
</script>

<template>
  <div class="login-app-wrapper">
    <div class="login-content">
      <div class="brand-header">
        <img src="/png/extra_pawn_black.png" alt="Logo" class="login-logo" />
        <h1 class="login-title">EXTRAPAWN</h1>
      </div>

      <div class="welcome-section">
        <h2 class="welcome-title">{{ t('app.login.welcomeTitle') }}</h2>
        <p class="welcome-text">
          {{ t('app.login.welcomeText') }}
        </p>
      </div>

      <button @click="handleLogin" class="login-button">
        {{ t('nav.loginWithLichess') }}
      </button>

      <div class="lang-switcher">
        <button
          class="lang-btn"
          :class="{ active: locale === 'en' }"
          @click="handleChangeLang('en')"
        >
          EN
        </button>
        <span class="lang-divider">|</span>
        <button
          class="lang-btn"
          :class="{ active: locale === 'ru' }"
          @click="handleChangeLang('ru')"
        >
          RU
        </button>
        <span class="lang-divider">|</span>
        <button
          class="lang-btn"
          :class="{ active: locale === 'de' }"
          @click="handleChangeLang('de')"
        >
          DE
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-app-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0b0d17;
  color: #fff;
  font-family: 'Ubuntu', sans-serif;
  z-index: 9999;
}

.login-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
  width: 90%;
  text-align: center;
  padding: 20px;
  background: rgba(15, 17, 26, 0.45);
  border: 1px solid rgba(0, 242, 255, 0.15);
  border-radius: 24px;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.brand-header {
  margin-bottom: 32px;
}

.login-logo {
  width: 200px; /* Bigger logo as requested */
  height: auto;
  margin-bottom: 20px;
  filter: drop-shadow(0 0 15px rgba(0, 242, 255, 0.3));
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  margin: 0;
  color: #00f2ff;
  text-shadow: 0 0 10px rgba(0, 242, 255, 0.4);
}

.welcome-section {
  margin-bottom: 20px;
}

.welcome-title {
  font-size: 1.4rem;
  margin-bottom: 12px;
  color: #fff;
}

.welcome-text {
  font-size: 1rem;
  color: #a0aec0;
  line-height: 1.6;
}

.login-button {
  width: 100%;
  padding: 16px 32px;
  background: linear-gradient(90deg, #00f2ff, #b000ff);
  border: none;
  border-radius: 14px;
  color: #0b0d17;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Ubuntu', sans-serif;
  margin-bottom: 32px;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(0, 242, 255, 0.5);
}

.lang-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  width: 80%;
  justify-content: center;
}

.lang-btn {
  background: none;
  border: none;
  color: #718096;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.2s ease;
}

.lang-btn:hover {
  color: #fff;
}

.lang-btn.active {
  color: #00f2ff;
}

.lang-divider {
  color: rgba(255, 255, 255, 0.1);
}
</style>
