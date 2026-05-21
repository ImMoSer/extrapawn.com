<template>
  <div class="coach-sidebar">
    <div class="sidebar-header">
      <h3 class="sidebar-title">Chess Coach</h3>
      <div class="header-actions">
        <button
          v-if="coachStore.currentExplanation && isKing"
          class="mentor-btn"
          :class="{ 'is-speaking': coachStore.isMentorSpeaking }"
          @click="coachStore.isMentorSpeaking ? coachStore.stopMentor() : coachStore.askMentor()"
          :disabled="coachStore.isMentorLoading"
          :title="coachStore.isMentorSpeaking ? 'Stop mentor' : coachStore.hasCachedMentorResponse ? 'Repeat mentor insight' : 'Ask the Lead Chess Mentor for a deep insight'"
        >
          <span v-if="coachStore.isMentorLoading" class="btn-spinner"></span>
          <template v-else-if="coachStore.isMentorSpeaking">
            <n-icon size="14"><StopOutline /></n-icon>
            <span>Stop</span>
          </template>
          <template v-else-if="coachStore.hasCachedMentorResponse">
            <n-icon size="14"><PlayOutline /></n-icon>
            <span>Repeat</span>
          </template>
          <template v-else>
            <n-icon size="14"><SparklesOutline /></n-icon>
            <span>Mentor</span>
          </template>
        </button>
        <CoachSettings @change="onSettingsChange" />
        <button
          class="toggle-btn"
          :class="{ active: coachStore.showVisuals }"
          @click="coachStore.toggleVisuals"
          title="Toggle visual highlights"
        >
          <n-icon size="16">
            <EyeOutline v-if="coachStore.showVisuals" />
            <EyeOffOutline v-else />
          </n-icon>
        </button>
      </div>
    </div>

    <!-- Tab Switcher -->
    <div class="tab-switcher">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'ANALYSIS' }"
        @click="activeTab = 'ANALYSIS'"
      >
        Analysis
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'CHAT_COACH' }"
        @click="activeTab = 'CHAT_COACH'"
      >
        Chat Coach
      </button>
    </div>

    <div v-if="activeTab === 'ANALYSIS'">
      <div v-if="coachStore.isAnalyzing && !coachStore.currentExplanation" class="coach-loading">
        <div class="spinner"></div>
        <p>Analyzing position...</p>
      </div>

      <div v-else class="coach-content">
        <CoachLastMove />
        <CoachTopMoves />
        <CoachPositionSummary />
        <CoachBook />
      </div>
    </div>

    <div v-else-if="activeTab === 'CHAT_COACH'" class="coach-chat-wrapper">
      <CoachChat />
    </div>

    <!-- Modals -->
    <CoachTakebackModal />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { SparklesOutline, StopOutline, PlayOutline, EyeOutline, EyeOffOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useCoachStore } from '../model/coach.store'
import { useAuthStore } from '@/entities/user'
import CoachSettings from './CoachSettings.vue'
import CoachLastMove from './CoachLastMove.vue'
import CoachPositionSummary from './CoachPositionSummary.vue'
import CoachBook from './CoachBook.vue'
import CoachTopMoves from './CoachTopMoves.vue'
import CoachTakebackModal from './CoachTakebackModal.vue'
import CoachChat from './CoachChat.vue'

const coachStore = useCoachStore()
const authStore = useAuthStore()

const activeTab = ref<'ANALYSIS' | 'CHAT_COACH'>('ANALYSIS')

const isKing = computed(() => authStore.userProfile?.subscriptionTier === 'King' || authStore.userProfile?.activeTier === 'King')

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
  margin-bottom: 8px;
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

.tab-switcher {
  display: flex;
  gap: 4px;
  padding: 0 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  background: none;
  border: none;
  padding: 6px 12px;
  color: #a1a1aa;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;
  border-bottom: 2px solid transparent;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  color: #00f2ff;
  border-bottom-color: #00f2ff;
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

.mentor-btn {
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 700;
  background-color: rgba(0, 242, 255, 0.1);
  color: #00f2ff;
  border: 1px solid rgba(0, 242, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.mentor-btn:hover:not(:disabled) {
  background-color: rgba(0, 242, 255, 0.2);
  border-color: rgba(0, 242, 255, 0.5);
}

.mentor-btn.is-speaking {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

.mentor-btn.is-speaking:hover {
  background-color: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.6);
}

.mentor-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 12px;
  height: 12px;
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

.coach-content,
.coach-chat-wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.coach-chat-wrapper {
  padding: 0 14px 14px;
}

.coach-content::-webkit-scrollbar {
  width: 4px;
}
.coach-content::-webkit-scrollbar-track {
  background: transparent;
}
.coach-content::-webkit-scrollbar-thumb {
  background-color: #27272a;
  border-radius: 4px;
}
.coach-content::-webkit-scrollbar-thumb:hover {
  background-color: #3f3f46;
}
</style>
