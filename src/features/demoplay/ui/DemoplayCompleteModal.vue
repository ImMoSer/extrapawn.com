<script setup lang="ts">
import { useDemoplayStore } from '../model/demoplay.store'
import { useRouter } from 'vue-router'

const demoplayStore = useDemoplayStore()
const router = useRouter()

function handleClose() {
  demoplayStore.hideCompleteModal()
}

function handleJoin() {
  demoplayStore.hideCompleteModal()
  router.push('/pricing')
}

function handleRestart() {
  demoplayStore.restartDemoplay()
}
</script>

<template>
  <Transition name="fade">
    <div v-if="demoplayStore.isCompleteModalVisible" class="demoplay-modal-overlay" @click.self="handleClose">
      <div class="demoplay-modal-container">
        
        <!-- Close Button -->
        <button class="close-btn" @click="handleClose" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="close-icon">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="demoplay-grid">
          <!-- Left Column: Report & CTA -->
          <div class="report-side">
            <div class="badge-wrapper">
              <span class="demo-badge">
                <span class="pulse-dot"></span>
                LIVE DEMO PLAY
              </span>
            </div>
            
            <h1 class="main-title">
              DEMO PLAY<br />
              <span class="highlight-cyan">COMPLETE</span>
            </h1>
            
            <p class="congrats-text">
              100 puzzles solved with Grandmaster-level precision. The demonstration is complete, but your training is just beginning.
            </p>

            <!-- Stats Dashboard Style -->
            <div class="stats-summary-grid">
              <div class="stat-box">
                <span class="stat-val text-cyan">100</span>
                <span class="stat-lbl">Puzzles Solved</span>
              </div>
              <div class="stat-box">
                <span class="stat-val text-bordeaux">100%</span>
                <span class="stat-lbl">Accuracy</span>
              </div>
              <div class="stat-box">
                <span class="stat-val text-yellow">0</span>
                <span class="stat-lbl">Blunders</span>
              </div>
            </div>

            <!-- Motivational Banner -->
            <div class="motivational-banner">
              <div class="quote-text">
                "Bridge the gap between amateur play and Grandmaster-level preparation with a professional-grade training ecosystem."
              </div>
              <div class="author-text">— extrapawn.com</div>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons-group">
              <button class="promo-btn primary-glow" @click="handleJoin">
                JOIN THE CHESS GYM
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="arrow-right">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
              <button class="promo-btn secondary-btn" @click="handleRestart">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="refresh-icon">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
                </svg>
                RESTART DEMO LOOP
              </button>
            </div>
          </div>

          <!-- Right Column: Marketing & Product Pillars -->
          <div class="advertising-side">
            <div class="logo-container">
              <img src="/png/extra_pawn_glass.png" alt="ExtraPawn" class="promo-logo" />
              <span class="logo-sub">THE CHESS GYM FOR SERIOUS PLAYERS</span>
            </div>

            <div class="features-list">
              <!-- Pillar I -->
              <div class="feat-card">
                <div class="feat-icon-box cyan-glow">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feat-icon">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                    <line x1="15" y1="3" x2="15" y2="21"></line>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                  </svg>
                </div>
                <div class="feat-content">
                  <h3>Pillar I: Active Recall Puzzle Play</h3>
                  <p>Theoretical Endgames, Practical Chess, FinishHim, and Tactics. Solve under Maia 2200 and Stockfish guidance with an intelligent Coach Sidebar that prevents blunders.</p>
                </div>
              </div>

              <!-- Pillar II -->
              <div class="feat-card">
                <div class="feat-icon-box bordeaux-glow">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feat-icon">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div class="feat-content">
                  <h3>Pillar II: Task Today (Daily Training Routine)</h3>
                  <p>Receive tailored puzzle sets daily using three specific strategies: Discovery to learn, Hardcore to attack weaknesses, and Warmup to sharpen your strongest themes.</p>
                </div>
              </div>

              <!-- Pillar III -->
              <div class="feat-card">
                <div class="feat-icon-box yellow-glow">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feat-icon">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div class="feat-content">
                  <h3>Pillar III: Interactive Sparring & Analysis</h3>
                  <p>Play full games from custom positions against Maia Chess (human-like AI) or Stockfish 18. Includes an integrated Opening Explorer and theory references.</p>
                </div>
              </div>

              <!-- Chess DNA -->
              <div class="feat-card">
                <div class="feat-icon-box purple-glow">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feat-icon">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div class="feat-content">
                  <h3>Chess DNA & Weakness Detection</h3>
                  <p>Spot knowledge gaps instantly with interactive Rose Charts mapping your tactical performance across opening, middle-game, and endgame themes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="promo-footer">
          <span>extrapawn.com — Built for tournament players seeking chess mastery.</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.demoplay-modal-overlay {
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

.demoplay-modal-container {
  background: linear-gradient(135deg, rgba(16, 18, 30, 0.75) 0%, rgba(9, 10, 18, 0.95) 100%);
  border: 1px solid rgba(0, 229, 255, 0.18);
  box-shadow: 
    0 25px 60px rgba(0, 0, 0, 0.8),
    0 0 50px rgba(0, 229, 255, 0.05),
    inset 0 0 20px rgba(255, 255, 255, 0.02);
  border-radius: 24px;
  width: 80%;
  max-width: 1350px;
  min-height: 620px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  padding: 3rem;
  overflow-y: auto;
  position: relative;
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

/* Grid Layout */
.demoplay-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 4rem;
  flex-grow: 1;
  align-items: center;
}

/* Left Side: Report & Action */
.report-side {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.badge-wrapper {
  margin-bottom: 1rem;
}

.demo-badge {
  background: rgba(0, 229, 255, 0.08);
  border: 1px solid rgba(0, 229, 255, 0.25);
  color: var(--neon-cyan);
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
  background-color: var(--neon-cyan);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--neon-cyan);
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(0, 229, 255, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(0, 229, 255, 0);
  }
}

.main-title {
  font-size: 3.2rem;
  font-weight: 900;
  line-height: 1.1;
  margin: 0 0 1.5rem 0;
  letter-spacing: -0.5px;
  text-transform: uppercase;
  color: #fff;
}

.highlight-cyan {
  color: var(--neon-cyan);
  text-shadow: 0 0 20px rgba(0, 229, 255, 0.3);
}

.congrats-text {
  font-size: 1.15rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 2rem 0;
}

/* Stats dashboard */
.stats-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-box {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s ease;
}

.stat-box:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.stat-val {
  font-size: 2.2rem;
  font-weight: 900;
  font-family: 'Fira Code', monospace;
  margin-bottom: 6px;
  line-height: 1;
}

.text-cyan {
  color: var(--neon-cyan);
  text-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
}

.text-bordeaux {
  color: var(--neon-bordeaux);
  text-shadow: 0 0 15px rgba(217, 0, 76, 0.3);
}

.text-yellow {
  color: var(--neon-yellow);
  text-shadow: 0 0 15px rgba(255, 230, 0, 0.3);
}

.stat-lbl {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Motivational Quote */
.motivational-banner {
  background: rgba(217, 0, 76, 0.03);
  border-left: 3px solid var(--neon-bordeaux);
  padding: 1.25rem 1.5rem;
  border-radius: 0 12px 12px 0;
  margin-bottom: 2.5rem;
  text-align: left;
}

.quote-text {
  font-size: 0.95rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.85);
  font-style: italic;
  margin-bottom: 6px;
}

.author-text {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--neon-bordeaux);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* CTA buttons */
.action-buttons-group {
  display: flex;
  gap: 1.25rem;
}

.promo-btn {
  border: none;
  border-radius: 12px;
  height: 54px;
  padding: 0 2rem;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-transform: uppercase;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.promo-btn.primary-glow {
  background: linear-gradient(135deg, var(--neon-bordeaux) 0%, var(--neon-pink) 100%);
  color: #fff;
  box-shadow: 0 0 15px rgba(217, 0, 76, 0.3);
  flex-grow: 1.5;
}

.promo-btn.primary-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(217, 0, 76, 0.5);
}

.arrow-right {
  transition: transform 0.25s ease;
}

.promo-btn.primary-glow:hover .arrow-right {
  transform: translateX(4px);
}

.promo-btn.secondary-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  flex-grow: 1;
}

.promo-btn.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.refresh-icon {
  transition: transform 0.5s ease;
}

.promo-btn.secondary-btn:hover .refresh-icon {
  transform: rotate(180deg);
}

/* Right Side: Advertising */
.advertising-side {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 20px;
  padding: 2.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 2rem;
}

.promo-logo {
  height: 52px;
  width: auto;
  object-fit: contain;
  margin-bottom: 6px;
  filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.1));
}

.logo-sub {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--text-secondary);
  letter-spacing: 3px;
  text-transform: uppercase;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.feat-card {
  display: flex;
  gap: 1.25rem;
  text-align: left;
}

.feat-icon-box {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.feat-icon {
  width: 20px;
  height: 20px;
}

.cyan-glow {
  border-color: rgba(0, 229, 255, 0.2);
  background: rgba(0, 229, 255, 0.03);
  color: var(--neon-cyan);
}

.bordeaux-glow {
  border-color: rgba(217, 0, 76, 0.2);
  background: rgba(217, 0, 76, 0.03);
  color: var(--neon-bordeaux);
}

.yellow-glow {
  border-color: rgba(255, 230, 0, 0.2);
  background: rgba(255, 230, 0, 0.03);
  color: var(--neon-yellow);
}

.purple-glow {
  border-color: rgba(176, 0, 255, 0.2);
  background: rgba(176, 0, 255, 0.03);
  color: var(--neon-purple);
}

.feat-content h3 {
  font-size: 0.95rem;
  font-weight: 800;
  margin: 0 0 4px 0;
  color: #fff;
}

.feat-content p {
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--text-secondary);
  margin: 0;
}

/* Footer info */
.promo-footer {
  margin-top: 2.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 1.5rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* Vue Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active .demoplay-modal-container {
  animation: scaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-leave-active .demoplay-modal-container {
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

/* Responsive constraints */
@media (max-width: 1200px) {
  .demoplay-modal-container {
    width: 90%;
    padding: 2rem;
  }
  .demoplay-grid {
    gap: 2rem;
  }
}

@media (max-width: 992px) {
  .demoplay-modal-container {
    max-height: 90vh;
  }
  .demoplay-grid {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  .advertising-side {
    padding: 1.5rem;
  }
}

@media (max-width: 600px) {
  .demoplay-modal-container {
    width: 95%;
    padding: 1.5rem 1rem;
  }
  .main-title {
    font-size: 2.2rem;
  }
  .stats-summary-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .action-buttons-group {
    flex-direction: column;
  }
}
</style>
