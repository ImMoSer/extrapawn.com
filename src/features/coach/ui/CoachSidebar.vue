<template>
  <div class="coach-sidebar">
    <div class="sidebar-header">
      <h3 class="sidebar-title">Chess Coach</h3>
      <div class="header-actions">
        <CoachSettings @change="onSettingsChange" />
        <button
          class="toggle-btn"
          :class="{ active: coachStore.isCoachEnabled }"
          @click="coachStore.toggleCoach"
        >
          <n-icon size="16"><PowerOutline /></n-icon>
        </button>
      </div>
    </div>

    <div v-if="!coachStore.isCoachEnabled" class="coach-disabled">
      <p>The coach is sleeping. Turn it on to get real-time feedback and analysis.</p>
    </div>

    <div v-else-if="coachStore.isAnalyzing && !coachStore.currentExplanation" class="coach-loading">
      <div class="spinner"></div>
      <p>Analyzing position...</p>
    </div>

    <div v-else class="coach-content">
      <CoachLastMove />
      <CoachPositionSummary />
      <CoachTopMoves />
    </div>
  </div>
</template>

<script setup lang="ts">
import { PowerOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useCoachStore } from '../model/coach.store'
import CoachSettings from './CoachSettings.vue'
import CoachLastMove from './CoachLastMove.vue'
import CoachPositionSummary from './CoachPositionSummary.vue'
import CoachTopMoves from './CoachTopMoves.vue'

const coachStore = useCoachStore()

const onSettingsChange = () => {
  if (coachStore.isCoachEnabled) {
    coachStore.setCoachEnabled(false)
    setTimeout(() => coachStore.setCoachEnabled(true), 50)
  }
}
</script>

<style scoped>
.coach-sidebar {
  background-color: var(--glass-bg, #0b0d17);
  border-radius: 8px;
  color: #d4d4d8;
  font-family: 'Ubuntu', sans-serif;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px 14px 0;
}

.sidebar-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: #fff;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  padding: 7px;
  border-radius: 6px;
  background-color: #1f1f23;
  color: #a1a1aa;
  border: 1px solid #27272a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background-color: rgba(0, 242, 255, 0.15);
  color: #00f2ff;
  border-color: rgba(0, 242, 255, 0.4);
}

.coach-disabled,
.coach-loading {
  font-size: 12px;
  color: #a1a1aa;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 242, 255, 0.2);
  border-top: 2px solid #00f2ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.coach-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
</style>
