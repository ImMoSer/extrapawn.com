<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { changeLang } from '@/shared/config/i18n'

const { t, locale } = useI18n({ useScope: 'global' })
const appUrl = window.location.href
const copied = ref(false)
const showTutorial = ref(false)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(appUrl)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const handleChangeLang = (lang: 'en' | 'ru' | 'de') => {
  changeLang(lang)
}

onMounted(() => {
  setTimeout(() => {
    showTutorial.value = true
  }, 2000)
})
</script>

<template>
  <div class="global-loader-wrapper">
    <div class="loader-content webview-blocker">
      <!-- Info Button Right Top -->
      <button class="info-btn" :title="t('common.actions.help')" @click="showTutorial = true">
        <div class="pulse-ring"></div>
        <span class="info-icon">i</span>
      </button>

      <img src="/png/extra_pawn_black.png" alt="Logo" class="loader-logo static" />
      <h2 class="loader-title error-text">OOPS!</h2>
      <p class="loader-text">
        {{ t('app.globalLoader.webviewWarning') }}
      </p>

      <div class="copy-section">
        <input type="text" readonly :value="appUrl" class="copy-input" />
        <button @click="copyLink" class="copy-button" :class="{ 'is-copied': copied }">
          {{ copied ? t('common.actions.copied') : t('common.actions.copyLink') }}
        </button>
      </div>

      <p class="loader-hint" style="margin-top: 20px">
        {{ t('app.globalLoader.webviewAction') }}
      </p>

      <div class="loader-lang-switcher">
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

    <!-- Video Modal Overlay -->
    <Transition name="fade">
      <div v-if="showTutorial" class="tutorial-overlay" @click.self="showTutorial = false">
        <div class="tutorial-modal">
          <button class="close-tutorial" @click="showTutorial = false">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="video-container">
            <video autoplay loop muted playsinline class="tutorial-video">
              <source src="/mp4/howto_FallbackApp.mp4" type="video/mp4" />
            </video>
          </div>
          <p class="tutorial-caption">{{ t('app.globalLoader.webviewAction') }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.global-loader-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #0b0d17;
  z-index: 99999;
  color: #fff;
  font-family: 'Ubuntu', sans-serif;
}

.loader-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  width: 90%;
  text-align: center;
  padding: 40px;
  background: rgba(15, 17, 26, 0.45);
  border: 1px solid rgba(0, 242, 255, 0.15);
  border-radius: 24px;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

/* Info Button Styles */
.info-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 242, 255, 0.1);
  border: 1px solid rgba(0, 242, 255, 0.3);
  color: #00f2ff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.3s ease;
}

.info-btn:hover {
  background: rgba(0, 242, 255, 0.2);
  transform: scale(1.1);
}

.info-icon {
  font-family: 'serif';
  font-style: italic;
  font-weight: bold;
  font-size: 1.1rem;
}

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #00f2ff;
  animation: pulse-animation 2s infinite;
}

@keyframes pulse-animation {
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

/* Tutorial Overlay & Modal */
.tutorial-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(8px);
}

.tutorial-modal {
  position: relative;
  width: 90%;
  max-width: 320px;
  background: #0b0d17;
  border: 1px solid rgba(0, 242, 255, 0.3);
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 0 40px rgba(0, 242, 255, 0.2);
}

.close-tutorial {
  position: absolute;
  top: -15px;
  right: -15px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ff4d4f;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.4);
  z-index: 11;
  transition: transform 0.2s;
}

.close-tutorial:hover {
  transform: scale(1.1);
}

.video-container {
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #000;
}

.tutorial-video {
  width: 100%;
  display: block;
}

.tutorial-caption {
  margin-top: 16px;
  font-size: 0.85rem;
  color: #a0aec0;
  text-align: center;
  line-height: 1.4;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.loader-logo.static {
  width: 80px;
  height: 80px;
  object-fit: contain;
  margin-bottom: 20px;
  opacity: 1;
}

.loader-title {
  font-size: 1.5rem;
  letter-spacing: 0.1em;
  margin: 0 0 16px 0;
  color: #00f2ff;
  text-shadow: 0 0 10px rgba(0, 242, 255, 0.4);
}

.error-text {
  color: #ff4d4f;
  text-shadow: 0 0 10px rgba(255, 77, 79, 0.4);
}

.loader-text {
  font-size: 1rem;
  color: #a0aec0;
  margin-bottom: 30px;
  line-height: 1.5;
}

.webview-blocker {
  border-color: rgba(255, 60, 60, 0.4);
  box-shadow: 0 8px 32px rgba(255, 60, 60, 0.2);
}

.copy-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.copy-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
  outline: none;
  cursor: default;
}

.copy-button {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 24px;
  background: #00f2ff;
  border: none;
  border-radius: 12px;
  color: #0b0d17;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Ubuntu', sans-serif;
}

.copy-button:hover {
  background: #0088ff;
  box-shadow: 0 0 15px rgba(0, 242, 255, 0.4);
}

.copy-button.is-copied {
  background: #27ae60;
  color: #fff;
}

.loader-hint {
  font-size: 0.8rem;
  color: #718096;
  margin: 0;
}

.loader-lang-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  width: 100%;
}

.lang-btn {
  background: none;
  border: none;
  color: #718096;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  transition: all 0.2s ease;
  font-family: 'Ubuntu', sans-serif;
}

.lang-btn:hover {
  color: #fff;
}

.lang-btn.active {
  color: #00f2ff;
}

.lang-divider {
  color: rgba(255, 255, 255, 0.1);
  font-size: 0.8rem;
}
</style>
