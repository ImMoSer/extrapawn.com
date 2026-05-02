<!-- src/pages/AboutView.vue -->
<script setup lang="ts">
import {
    NButton,
    NCard,
    NDivider,
    NGi,
    NGrid,
    NSpace,
    NTag,
    NText
} from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appVersion = import.meta.env.VITE_APP_VERSION || '2.0.0'

const modules = [
  'study',
  'openingSparring',
  'diamondHunter',
  'tornado',
  'finishHim',
  'practicalChess',
  'theoreticalEndings',
  'userCabinet'
]

const conceptKeys = ['what', 'forWho', 'uniqueness']
</script>

<template>
  <div class="about-page-wrapper">
    <!-- Hero Section -->
    <header class="hero-section">
      <div class="hero-content">
        <h1 class="glow-text">{{ t('about.hero.title') }}</h1>
        <p class="hero-subtitle">{{ t('about.hero.subtitle') }} <span class="version-badge">v{{ appVersion }}</span></p>
      </div>
      <div class="bg-animation">
        <div class="blob"></div>
        <div class="blob"></div>
        <div class="blob"></div>
      </div>
    </header>

    <div class="content-container">
      <!-- Concept Section -->
      <section class="concept-section">
        <n-grid cols="1 s:1 m:3" responsive="screen" :x-gap="24" :y-gap="24">
          <n-gi v-for="key in conceptKeys" :key="key">
            <n-card class="concept-card glass-card" :title="t(`about.concept.${key}.title`)">
              <n-text class="concept-text">
                <span v-html="t(`about.concept.${key}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')"></span>
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="section-divider" />

      <!-- Modules Section -->
      <section class="modules-section">
        <h2 class="section-title">{{ t('about.hero.title').split(' — ')[0] }} Modules</h2>
        <n-grid cols="1 s:1 m:2 l:2" responsive="screen" :x-gap="24" :y-gap="24">
          <n-gi v-for="mod in modules" :key="mod">
            <n-card class="module-card glass-card h-full" :title="t(`about.modules.${mod}.title`)">
              <template #header-extra>
                <div class="module-icon-placeholder">{{ mod.charAt(0).toUpperCase() }}</div>
              </template>
              <n-text depth="3" class="module-description">
                <span v-html="t(`about.modules.${mod}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')"></span>
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="section-divider" />

      <!-- Tech Stack -->
      <section class="tech-section glass-card">
        <h2 class="section-title">{{ t('about.techStack.title') }}</h2>
        <n-grid cols="1 s:2 m:3" responsive="screen" :x-gap="40" :y-gap="20">
          <n-gi>
            <div class="tech-item">
              <n-text strong>{{ t('about.techStack.frontend') }}</n-text>
              <n-text depth="3">{{ t('about.techStack.frontendStack') }}</n-text>
            </div>
          </n-gi>
          <n-gi>
            <div class="tech-item">
              <n-text strong>{{ t('about.techStack.backend') }}</n-text>
              <n-text depth="3">{{ t('about.techStack.backendStack') }}</n-text>
            </div>
          </n-gi>
          <n-gi>
            <div class="tech-item">
              <n-text strong>{{ t('about.techStack.chessLogic') }}</n-text>
              <n-text depth="3">{{ t('about.techStack.chessLogicStack') }}</n-text>
            </div>
          </n-gi>
          <n-gi>
            <div class="tech-item">
              <n-text strong>{{ t('about.techStack.boardRendering') }}</n-text>
              <n-text depth="3">{{ t('about.techStack.boardRenderingStack') }}</n-text>
            </div>
          </n-gi>
          <n-gi>
            <div class="tech-item">
              <n-text strong>{{ t('about.techStack.chessEngine') }}</n-text>
              <n-text depth="3">{{ t('about.techStack.chessEngineStack') }}</n-text>
            </div>
          </n-gi>
          <n-gi>
            <div class="tech-item">
              <n-text strong>{{ t('about.techStack.api') }}</n-text>
              <n-text depth="3">{{ t('about.techStack.apiStack') }}</n-text>
            </div>
          </n-gi>
        </n-grid>
      </section>

      <!-- Licensing & Acknowledgements -->
      <section class="license-section">
        <h2 class="section-title">{{ t('about.licenseAndAcknowledgements.title') }}</h2>
        <p class="license-intro">{{ t('about.licenseAndAcknowledgements.gplIntro') }}</p>

        <n-grid cols="1 s:1 m:2" responsive="screen" :x-gap="24" :y-gap="24">
          <!-- Stockfish -->
          <n-gi>
            <n-card size="small" class="license-card">
              <template #header>
                <n-text strong>{{ t('about.licenseAndAcknowledgements.stockfish.title') }}</n-text>
              </template>
              <n-text depth="3">
                {{ t('about.licenseAndAcknowledgements.stockfish.text1') }} <strong>Stockfish</strong> {{ t('about.licenseAndAcknowledgements.stockfish.text2') }}
              </n-text>
              <div class="mt-2">
                <n-tag type="warning" size="small" :bordered="false">{{ t('about.licenseAndAcknowledgements.stockfish.gplNoteTitle') }}</n-tag>
                <n-text depth="3" class="text-xs block mt-1">{{ t('about.licenseAndAcknowledgements.stockfish.gplNote') }}</n-text>
              </div>
            </n-card>
          </n-gi>

          <!-- Maia -->
          <n-gi>
            <n-card size="small" class="license-card">
              <template #header>
                <n-text strong>{{ t('about.licenseAndAcknowledgements.maia.title') }}</n-text>
              </template>
              <n-text depth="3">
                <span v-html="t('about.licenseAndAcknowledgements.maia.text').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')"></span>
              </n-text>
            </n-card>
          </n-gi>

          <!-- LCZero -->
          <n-gi>
            <n-card size="small" class="license-card">
              <template #header>
                <n-text strong>{{ t('about.licenseAndAcknowledgements.lcZero.title') }}</n-text>
              </template>
              <n-text depth="3">
                <span v-html="t('about.licenseAndAcknowledgements.lcZero.text').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')"></span>
              </n-text>
            </n-card>
          </n-gi>

          <!-- Chessground & Chessops -->
          <n-gi>
            <n-card size="small" class="license-card">
              <template #header>
                <n-text strong>Chessground & Chessops</n-text>
              </template>
              <n-text depth="3">
                {{ t('about.licenseAndAcknowledgements.chessground.text1') }} <strong>Chessground</strong> & <strong>Chessops</strong>. {{ t('about.licenseAndAcknowledgements.chessground.gratitude') }}
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <!-- Author Section -->
      <section class="author-section glass-card">
        <div class="author-layout">
          <div class="author-photo-wrapper">
            <img class="author-photo" src="/jpg/me.jpg" :alt="t('about.author.photoAlt')" />
            <div class="photo-glow"></div>
          </div>
          <div class="author-info">
            <h2 class="author-name">{{ t('about.author.title') }}</h2>
            <div class="author-bio">
              <p>{{ t('about.author.bioPart1') }}</p>
              <p>{{ t('about.author.bioPart2') }}</p>
              <p>{{ t('about.author.bioPart3') }}</p>
            </div>

            <div class="author-actions">
              <n-button
                type="warning"
                secondary
                round
                tag="a"
                href="https://coff.ee/chessboard.fun"
                target="_blank"
              >
                {{ t('about.author.supportButtonText') }}
              </n-button>

              <n-space class="social-links">
                <a href="https://t.me/extrapawn_chat" target="_blank" class="social-icon">TG</a>
                <a href="https://github.com/ImMoSer/extrapawn.com" target="_blank" class="social-icon">GH</a>
                <a href="mailto:immozerai@gmail.com" class="social-icon">@</a>
              </n-space>
            </div>
          </div>
        </div>
      </section>

      <footer class="about-footer">
        <n-text depth="3" italic>{{ t('about.footerNote') }}</n-text>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.about-page-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  color: var(--color-text-default);
  padding-bottom: 60px;
  overflow-x: hidden;
}

/* Hero Section */
.hero-section {
  position: relative;
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 20px;
  background: linear-gradient(135deg, rgba(10, 10, 15, 1) 0%, rgba(20, 20, 30, 1) 100%);
  overflow: hidden;
}

.hero-content {
  position: relative;
  z-index: 10;
}

.glow-text {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 900;
  margin: 0;
  background: linear-gradient(to right, #fff 20%, var(--color-accent-primary) 50%, #fff 80%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% auto;
  animation: shine 4s linear infinite;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.hero-subtitle {
  font-size: 1.2rem;
  color: var(--color-text-muted);
  margin-top: 10px;
}

.version-badge {
  background: rgba(var(--color-accent-primary-rgb), 0.2);
  color: var(--color-accent-primary);
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  vertical-align: middle;
}

/* Background Animation */
.bg-animation {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.blob {
  position: absolute;
  width: 300px;
  height: 300px;
  background: var(--color-accent-primary);
  filter: blur(80px);
  opacity: 0.15;
  border-radius: 50%;
  animation: move 20s infinite alternate;
}

.blob:nth-child(2) {
  background: var(--color-accent-success);
  animation-delay: -5s;
  left: 50%;
}

.blob:nth-child(3) {
  background: var(--color-accent-warning);
  animation-delay: -10s;
  right: 0;
}

@keyframes move {
  from { transform: translate(-20%, -20%) rotate(0deg); }
  to { transform: translate(20%, 20%) rotate(360deg); }
}

@keyframes shine {
  to { background-position: 200% center; }
}

/* Content Container */
.content-container {
  max-width: 1200px;
  margin: -60px auto 0;
  padding: 0 20px;
  position: relative;
  z-index: 20;
}

/* Cards */
.glass-card {
  background: rgba(30, 30, 40, 0.7) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-5px);
  border-color: rgba(var(--color-accent-primary-rgb), 0.3) !important;
}

.concept-card {
  height: 100%;
}

.concept-text {
  font-size: 1.05rem;
  line-height: 1.6;
}

.section-divider {
  margin: 60px 0 !important;
  border-color: rgba(255, 255, 255, 0.05) !important;
}

.section-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-accent-primary);
  margin-bottom: 32px;
  text-align: center;
}

.module-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.module-icon-placeholder {
  width: 40px;
  height: 40px;
  background: rgba(var(--color-accent-primary-rgb), 0.1);
  color: var(--color-accent-primary);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.module-description {
  font-size: 0.95rem;
  line-height: 1.6;
}

/* Tech Stack */
.tech-section {
  padding: 40px;
}

.tech-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* License Section */
.license-section {
  margin-top: 60px;
}

.license-intro {
  color: var(--color-text-muted);
  text-align: center;
  margin-bottom: 30px;
}

.license-card {
  background: rgba(255, 255, 255, 0.02) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
}

/* Author Section */
.author-section {
  margin-top: 80px;
  padding: 40px;
}

.author-layout {
  display: flex;
  gap: 40px;
  align-items: center;
}

.author-photo-wrapper {
  position: relative;
  flex-shrink: 0;
}

.author-photo {
  width: 200px;
  height: 200px;
  border-radius: 20px;
  object-fit: cover;
  position: relative;
  z-index: 2;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.photo-glow {
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  background: var(--color-accent-primary);
  filter: blur(20px);
  opacity: 0.3;
  z-index: 1;
  border-radius: 30px;
}

.author-info {
  flex-grow: 1;
}

.author-name {
  font-size: 2rem;
  margin: 0 0 16px;
  color: var(--color-accent-primary);
}

.author-bio p {
  margin-bottom: 12px;
  line-height: 1.6;
  color: var(--color-text-muted);
}

.author-actions {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 24px;
}

.social-links {
  display: flex;
  gap: 12px;
}

.social-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #fff;
  font-size: 0.8rem;
  font-weight: bold;
  transition: background 0.2s;
}

.social-icon:hover {
  background: var(--color-accent-primary);
}

.about-footer {
  text-align: center;
  margin-top: 60px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

@media (max-width: 768px) {
  .hero-section {
    height: 300px;
  }

  .author-layout {
    flex-direction: column;
    text-align: center;
    gap: 30px;
  }

  .author-actions {
    flex-direction: column;
    gap: 20px;
  }

  .tech-section {
    padding: 20px;
  }
}

.mt-2 { margin-top: 8px; }
.mt-1 { margin-top: 4px; }
.text-xs { font-size: 0.75rem; }
.block { display: block; }
.h-full { height: 100%; }
</style>
