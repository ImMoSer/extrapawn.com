<!-- src/pages/AboutView.vue -->
<script setup lang="ts">
import { NButton, NCard, NDivider, NGi, NGrid, NSpace, NTag, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appVersion = import.meta.env.VITE_APP_VERSION || '2.0.0'

const modules = [
  'puzzlePlay',
  'taskToday',
  'sparring',
  'userCabinet',
] as const

const moduleVisuals: Record<typeof modules[number], { icon: string; color: string; glow: string }> = {
  puzzlePlay: {
    icon: '🎯',
    color: 'var(--color-primary)',
    glow: 'rgba(0, 229, 255, 0.15)',
  },
  taskToday: {
    icon: '📅',
    color: 'var(--color-success)',
    glow: 'rgba(0, 255, 85, 0.15)',
  },
  sparring: {
    icon: '⚔️',
    color: 'var(--color-warning)',
    glow: 'rgba(255, 85, 0, 0.15)',
  },
  userCabinet: {
    icon: '🧬',
    color: 'var(--neon-pink)',
    glow: 'rgba(255, 0, 122, 0.15)',
  },
}

const conceptKeys = ['what', 'forWho', 'uniqueness']

const techStackItems = [
  { labelKey: 'frontend', stackKey: 'frontendStack', color: 'var(--color-primary)' },
  { labelKey: 'backend', stackKey: 'backendStack', color: 'var(--color-secondary)' },
  { labelKey: 'chessLogic', stackKey: 'chessLogicStack', color: 'var(--color-accent)' },
  { labelKey: 'boardRendering', stackKey: 'boardRenderingStack', color: 'var(--color-success)' },
  { labelKey: 'chessEngine', stackKey: 'chessEngineStack', color: 'var(--color-warning)' },
  { labelKey: 'api', stackKey: 'apiStack', color: 'var(--color-error)' },
]
</script>

<template>
  <div class="about-page-wrapper">
    <!-- Hero Section -->
    <header class="hero-section">
      <div class="hero-content">
        <h1 class="glow-text">{{ t('about.hero.title') }}</h1>
        <p class="hero-subtitle">
          {{ t('about.hero.subtitle') }} <span class="version-badge">v{{ appVersion }}</span>
        </p>
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
                <span
                  v-html="
                    t(`about.concept.${key}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  "
                ></span>
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="section-divider" />

      <!-- Modules Section -->
      <section class="modules-section">
        <h2 class="section-title">{{ t('about.hero.title').split(' — ')[0] }} Pillars</h2>
        <n-grid cols="1 s:1 m:2 l:2" responsive="screen" :x-gap="24" :y-gap="24">
          <n-gi v-for="mod in modules" :key="mod">
            <n-card
              class="module-card glass-card h-full"
              :style="{
                '--hover-glow-color': moduleVisuals[mod].glow,
                '--hover-border-color': moduleVisuals[mod].color
              }"
            >
              <template #header>
                <div class="module-card-header">
                  <div
                    class="module-icon-wrapper"
                    :style="{
                      color: moduleVisuals[mod].color,
                      boxShadow: 'inset 0 0 10px ' + moduleVisuals[mod].glow,
                      border: '1px solid ' + moduleVisuals[mod].color
                    }"
                  >
                    <span class="module-icon">{{ moduleVisuals[mod].icon }}</span>
                  </div>
                  <span class="module-title">{{ t(`about.modules.${mod}.title`) }}</span>
                </div>
              </template>
              <div class="module-description-wrapper">
                <n-text depth="3" class="module-description">
                  <span
                    v-html="
                      t(`about.modules.${mod}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    "
                  ></span>
                </n-text>
              </div>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="section-divider" />

      <!-- Tech Stack -->
      <section class="tech-section glass-card">
        <h2 class="section-title">{{ t('about.techStack.title') }}</h2>
        <n-grid cols="1 s:2 m:3" responsive="screen" :x-gap="40" :y-gap="24">
          <n-gi v-for="item in techStackItems" :key="item.labelKey">
            <div class="tech-item-card">
              <div class="tech-icon-container">
                <span class="tech-dot" :style="{ backgroundColor: item.color, boxShadow: '0 0 8px ' + item.color }"></span>
              </div>
              <div class="tech-details">
                <span class="tech-label">{{ t('about.techStack.' + item.labelKey) }}</span>
                <span class="tech-stack-value">{{ t('about.techStack.' + item.stackKey) }}</span>
              </div>
            </div>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="section-divider" />

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
                {{ t('about.licenseAndAcknowledgements.stockfish.text1') }}
                <strong>Stockfish</strong>
                {{ t('about.licenseAndAcknowledgements.stockfish.text2') }}
              </n-text>
              <div class="mt-2">
                <n-tag type="warning" size="small" :bordered="false">{{
                  t('about.licenseAndAcknowledgements.stockfish.gplNoteTitle')
                }}</n-tag>
                <n-text depth="3" class="text-xs block mt-1">{{
                  t('about.licenseAndAcknowledgements.stockfish.gplNote')
                }}</n-text>
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
                <span
                  v-html="
                    t('about.licenseAndAcknowledgements.maia.text').replace(
                      /\*\*(.*?)\*\*/g,
                      '<strong>$1</strong>',
                    )
                  "
                ></span>
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
                <span
                  v-html="
                    t('about.licenseAndAcknowledgements.lcZero.text').replace(
                      /\*\*(.*?)\*\*/g,
                      '<strong>$1</strong>',
                    )
                  "
                ></span>
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
                {{ t('about.licenseAndAcknowledgements.chessground.text1') }}
                <strong>Chessground</strong> & <strong>Chessops</strong>.
                {{ t('about.licenseAndAcknowledgements.chessground.gratitude') }}
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
                <a
                  href="https://github.com/ImMoSer/extrapawn.com"
                  target="_blank"
                  class="social-icon"
                  >GH</a
                >
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
  background: linear-gradient(135deg, rgba(5, 5, 8, 1) 0%, rgba(10, 11, 20, 1) 100%);
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.hero-content {
  position: relative;
  z-index: 10;
}

.glow-text {
  font-size: clamp(2rem, 5vw, 4.5rem);
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
  font-size: 1.25rem;
  color: var(--color-text-muted);
  margin-top: 15px;
  letter-spacing: 1px;
}

.version-badge {
  background: rgba(var(--color-accent-primary-rgb), 0.2);
  color: var(--color-accent-primary);
  padding: 2px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: bold;
  vertical-align: middle;
  border: 1px solid rgba(var(--color-accent-primary-rgb), 0.3);
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
  width: 350px;
  height: 350px;
  background: var(--color-accent-primary);
  filter: blur(100px);
  opacity: 0.12;
  border-radius: 50%;
  animation: move 20s infinite alternate;
}

.blob:nth-child(2) {
  background: var(--color-accent-secondary);
  animation-delay: -5s;
  left: 50%;
}

.blob:nth-child(3) {
  background: var(--color-accent-warning);
  animation-delay: -10s;
  right: 0;
}

@keyframes move {
  from {
    transform: translate(-20%, -20%) rotate(0deg);
  }
  to {
    transform: translate(20%, 20%) rotate(360deg);
  }
}

@keyframes shine {
  to {
    background-position: 200% center;
  }
}

/* Content Container */
.content-container {
  max-width: 1200px;
  margin: -60px auto 0;
  padding: 0 20px;
  position: relative;
  z-index: 20;
}

/* Cards & Glassmorphism */
.glass-card {
  background: rgba(18, 20, 31, 0.75) !important;
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.concept-card {
  height: 100%;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.concept-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
}

.concept-card:hover {
  transform: translateY(-5px);
  border-color: rgba(0, 229, 255, 0.3) !important;
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
  font-size: 2.25rem;
  font-weight: 900;
  background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 32px;
  text-align: center;
  letter-spacing: 1px;
}

/* Modules Section */
.module-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.module-card:hover {
  transform: translateY(-5px);
  border-color: var(--hover-border-color) !important;
  box-shadow: 0 12px 40px var(--hover-glow-color) !important;
}

.module-card-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.module-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.module-card:hover .module-icon-wrapper {
  transform: scale(1.1) rotate(5deg);
}

.module-icon {
  font-size: 1.5rem;
}

.module-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.module-description-wrapper {
  padding-top: 12px;
}

.module-description {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

/* Tech Stack */
.tech-section {
  padding: 40px;
}

.tech-item-card {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  transition: all 0.3s ease;
}

.tech-item-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.tech-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 4px;
}

.tech-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.tech-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tech-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.tech-stack-value {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* License Section */
.license-section {
  margin-top: 60px;
}

.license-intro {
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 30px;
  font-size: 1.05rem;
}

.license-card {
  background: rgba(255, 255, 255, 0.01) !important;
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-radius: 12px !important;
  transition: all 0.3s ease;
}

.license-card:hover {
  background: rgba(255, 255, 255, 0.03) !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* Author Section */
.author-section {
  margin-top: 80px;
  padding: 40px;
  background: linear-gradient(135deg, rgba(18, 20, 31, 0.8), rgba(10, 11, 20, 0.8)) !important;
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
  width: 180px;
  height: 180px;
  border-radius: 50%;
  object-fit: cover;
  position: relative;
  z-index: 2;
  border: 3px solid rgba(0, 229, 255, 0.3);
  box-shadow: 0 0 25px rgba(0, 229, 255, 0.2);
}

.photo-glow {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  filter: blur(15px);
  opacity: 0.4;
  z-index: 1;
  border-radius: 50%;
}

.author-info {
  flex-grow: 1;
}

.author-name {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 16px;
  color: var(--color-primary);
}

.author-bio p {
  margin-bottom: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
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
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.social-icon:hover {
  background: var(--color-primary);
  color: var(--bg-0);
  transform: translateY(-2px);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
}

.about-footer {
  text-align: center;
  margin-top: 60px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Responsiveness check */
@media (max-width: 900px) {
  .hero-section {
    height: 320px;
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

.mt-2 {
  margin-top: 8px;
}
.mt-1 {
  margin-top: 4px;
}
.text-xs {
  font-size: 0.75rem;
}
.block {
  display: block;
}
.h-full {
  height: 100%;
}
</style>
