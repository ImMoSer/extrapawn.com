<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDemoplayStore } from '../model/demoplay.store'

const demoplayStore = useDemoplayStore()
const { t, te } = useI18n()

function handleClose() {
  demoplayStore.hideIntroModal()
}

function handleStart() {
  demoplayStore.startIntroDemoplay()
}

const config = computed(() => demoplayStore.introConfig)

const submodeLabel = computed(() => {
  const submode = config.value.submode
  if (!submode) return ''
  if (submode === 'tactics') return t('features.coach.tabs.tactic')
  const key = `pages.welcome.submodes.${submode}`
  if (te(key)) return t(key)
  return submode.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
})

const categoryLabel = computed(() => {
  const category = config.value.category
  const submode = config.value.submode
  if (!category) return 'All Themes'
  
  if (submode === 'tactics') {
    const key = `puzzleCategories.tactics.${category}`
    if (te(key)) return t(key)
  } else {
    const keyTheme = `puzzleCategories.themes.${category}`
    if (te(keyTheme)) return t(keyTheme)
    const keySubTheme = `puzzleCategories.subThemes.${category}`
    if (te(keySubTheme)) return t(keySubTheme)
  }
  return category.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
})

const difficultyLabel = computed(() => {
  const diff = config.value.difficulty
  if (!diff) return ''
  const key = `puzzleCategories.difficulties.level_${diff.toLowerCase()}`
  if (te(key)) return t(key)
  return diff
})
</script>

<template>
  <Transition name="fade">
    <div v-if="demoplayStore.isIntroModalVisible" class="demoplay-intro-overlay" @click.self="handleClose">
      <div class="demoplay-intro-container">
        
        <!-- Close Button -->
        <button class="close-btn" @click="handleClose" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="intro-content">
          <!-- Pulse Badge -->
          <div class="badge-wrapper">
            <span class="demo-badge">
              <span class="pulse-dot"></span>
              DEMO PLAY INITIATED
            </span>
          </div>

          <!-- Headline -->
          <h1 class="intro-title-small">
            DEMO {{ submodeLabel }}
          </h1>

          <!-- Topic Banner (Eye Catcher) -->
          <div class="eye-catcher-banner">
            <span class="highlight-pink">100x</span> {{ categoryLabel }}
          </div>

          <!-- Quick Config Cards -->
          <div class="intro-cards-grid">
            <!-- Card 1 -->
            <div class="intro-card">
              <div class="card-icon cyan-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div class="card-body">
                <span class="card-title">Difficulty</span>
                <h4 class="card-val">{{ difficultyLabel }}</h4>
              </div>
            </div>

            <!-- Card 2 -->
            <div class="intro-card">
              <div class="card-icon bordeaux-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              </div>
              <div class="card-body">
                <span class="card-title">Resistance</span>
                <h4 class="card-val">Maia & Stockfish 18</h4>
              </div>
            </div>

            <!-- Card 3 -->
            <div class="intro-card">
              <div class="card-icon yellow-text">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div class="card-body">
                <span class="card-title">Goal</span>
                <h4 class="card-val">100 Puzzles</h4>
              </div>
            </div>
          </div>

          <!-- Buttons -->
          <div class="intro-actions">
            <button class="action-btn start-glow" @click="handleStart">
              START DEMO LOOP
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="arrow-right">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button class="action-btn cancel-btn" @click="handleClose">
              CANCEL
            </button>
          </div>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.demoplay-intro-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(6, 7, 13, 0.88);
  backdrop-filter: blur(20px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

.demoplay-intro-container {
  background: linear-gradient(135deg, rgba(16, 18, 30, 0.75) 0%, rgba(9, 10, 18, 0.95) 100%);
  border: 1px solid rgba(255, 0, 122, 0.18);
  box-shadow: 
    0 25px 60px rgba(0, 0, 0, 0.8),
    0 0 50px rgba(255, 0, 122, 0.05),
    inset 0 0 20px rgba(255, 255, 255, 0.02);
  border-radius: 24px;
  width: 90%;
  max-width: 720px;
  padding: 3rem;
  overflow-y: auto;
  position: relative;
  text-align: center;
}

/* Close Button */
.close-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
}

.close-btn:hover {
  background: rgba(255, 7, 58, 0.1);
  border-color: rgba(255, 7, 58, 0.3);
  color: var(--neon-red);
  transform: rotate(90deg);
}

.close-icon {
  width: 18px;
  height: 18px;
}

.intro-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.badge-wrapper {
  margin-bottom: 1.25rem;
}

.demo-badge {
  background: rgba(255, 0, 122, 0.08);
  border: 1px solid rgba(255, 0, 122, 0.25);
  color: var(--neon-pink);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: var(--neon-pink);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--neon-pink);
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 0, 122, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(255, 0, 122, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(255, 0, 122, 0);
  }
}

.intro-title-small {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: 0 0 1.25rem 0;
}

.eye-catcher-banner {
  font-size: 3.5rem;
  font-weight: 900;
  line-height: 1.1;
  margin: 0 0 2.5rem 0;
  letter-spacing: -1px;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.1);
}

.highlight-pink {
  color: var(--neon-pink);
  text-shadow: 0 0 20px rgba(255, 0, 122, 0.3);
}

/* Info Cards */
.intro-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  width: 100%;
  margin-bottom: 2.5rem;
}

.intro-card {
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 1.25rem 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card-icon {
  margin-bottom: 8px;
}

.icon-svg {
  width: 22px;
  height: 22px;
}

.cyan-text {
  color: var(--neon-cyan);
}

.bordeaux-text {
  color: var(--neon-bordeaux);
}

.yellow-text {
  color: var(--neon-yellow);
}

.card-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  display: block;
  margin-bottom: 6px;
}

.card-val {
  font-size: 1.25rem;
  font-weight: 900;
  color: #fff;
  margin: 0;
  line-height: 1.2;
}

/* Actions */
.intro-actions {
  display: flex;
  gap: 1rem;
  width: 100%;
}

.action-btn {
  border: none;
  border-radius: 12px;
  height: 52px;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 1px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-transform: uppercase;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.action-btn.start-glow {
  background: linear-gradient(135deg, var(--neon-pink) 0%, var(--neon-purple) 100%);
  color: #fff;
  box-shadow: 0 0 15px rgba(255, 0, 122, 0.3);
  flex-grow: 1.5;
}

.action-btn.start-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(255, 0, 122, 0.5);
}

.arrow-right {
  transition: transform 0.25s ease;
}

.action-btn.start-glow:hover .arrow-right {
  transform: translateX(4px);
}

.action-btn.cancel-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  flex-grow: 1;
}

.action-btn.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
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

.fade-enter-active .demoplay-intro-container {
  animation: scaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-leave-active .demoplay-intro-container {
  animation: scaleOut 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(15px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes scaleOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
}

@media (max-width: 600px) {
  .demoplay-intro-container {
    padding: 2rem 1.5rem;
  }
  .intro-title {
    font-size: 2.2rem;
  }
  .intro-cards-grid {
    grid-template-columns: 1fr;
  }
  .intro-actions {
    flex-direction: column;
  }
}
</style>
