<template>
  <div class="coach-sidebar">
    <div class="sidebar-header">
      <h3 class="sidebar-title">Chess Coach</h3>
      <div class="header-actions">
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

    <!-- Tab Bar -->
    <div class="tab-switcher-container">
      <n-tabs
        :value="activeTab"
        @update:value="emit('update:activeTab', $event)"
        type="segment"
        animated
        class="mode-tabs"
      >
        <n-tab name="coach">
          Coach
        </n-tab>
        <n-tab name="analyse">
          Analyse
        </n-tab>
      </n-tabs>
    </div>

    <!-- Content area -->
    <div class="sidebar-content-wrapper">
      <div v-show="activeTab === 'coach'" class="coach-content-scroll">
        <div v-if="coachStore.isAnalyzing && !coachStore.currentExplanation" class="coach-loading">
          <div class="spinner"></div>
          <p>Analyzing position...</p>
        </div>

        <div v-else class="coach-content">
          <CoachAvatar />
          <CoachLastMove />
          <CoachTopMoves />
          <CoachPositionSummary />
          <CoachBook />
        </div>
      </div>

      <div v-show="activeTab === 'analyse'" class="analyse-content-scroll">
        <slot name="analyse"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { EyeOffOutline, EyeOutline } from '@vicons/ionicons5'
import { NIcon, NTabs, NTab } from 'naive-ui'
import { useCoachStore } from '../model/coach.store'
import CoachAvatar from './CoachAvatar.vue'
import CoachBook from './CoachBook.vue'
import CoachLastMove from './CoachLastMove.vue'
import CoachPositionSummary from './CoachPositionSummary.vue'
import CoachSettings from './CoachSettings.vue'
import CoachTopMoves from './CoachTopMoves.vue'

withDefaults(
  defineProps<{
    activeTab?: string
  }>(),
  {
    activeTab: 'coach',
  }
)

const emit = defineEmits<{
  (e: 'update:activeTab', value: string): void
}>()

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

.tab-switcher-container {
  padding: 0 14px 8px;
}

.mode-tabs {
  --n-tab-font-size: 0.85rem;
}

.sidebar-content-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.coach-content-scroll,
.analyse-content-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.coach-content-scroll::-webkit-scrollbar,
.analyse-content-scroll::-webkit-scrollbar {
  width: 4px;
}
.coach-content-scroll::-webkit-scrollbar-track,
.analyse-content-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.coach-content-scroll::-webkit-scrollbar-thumb,
.analyse-content-scroll::-webkit-scrollbar-thumb {
  background-color: #27272a;
  border-radius: 4px;
}
.coach-content-scroll::-webkit-scrollbar-thumb:hover,
.analyse-content-scroll::-webkit-scrollbar-thumb:hover {
  background-color: #3f3f46;
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

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.coach-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 768px) {
  .sidebar-header {
    padding: 8px 10px 0;
  }
  .tab-switcher-container {
    padding: 0 10px 6px;
  }
}
</style>
