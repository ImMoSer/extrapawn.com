<script setup lang="ts">
import { useTablebaseStore } from '../model/tablebase.store'
import { computed } from 'vue'

const tablebaseStore = useTablebaseStore()

const buttonText = computed(() => {
  return tablebaseStore.isPlaybackInProgress ? 'Stop Mainline' : 'Play Mainline'
})

const handleToggle = () => {
  if (tablebaseStore.isPlaybackInProgress) {
    tablebaseStore.stopPlayback()
  } else {
    tablebaseStore.playMainline()
  }
}
</script>

<template>
  <button
    v-if="tablebaseStore.isTablebaseAvailable"
    class="tablebase-btn"
    :class="{ 'is-playing': tablebaseStore.isPlaybackInProgress }"
    @click="handleToggle"
  >
    <span class="pulse-dot" v-if="tablebaseStore.isPlaybackInProgress"></span>
    <span class="btn-text">{{ buttonText }}</span>
  </button>
</template>

<style scoped>
.tablebase-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(217, 0, 76, 0.15);
  border: 1px solid rgba(217, 0, 76, 0.4);
  color: #fff;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  height: 22px;
  box-sizing: border-box;
}

.tablebase-btn:hover {
  background: rgba(217, 0, 76, 0.3);
  border-color: var(--neon-bordeaux, #d9004c);
  box-shadow: 0 0 8px rgba(217, 0, 76, 0.4);
}

.tablebase-btn.is-playing {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.6);
}

.tablebase-btn.is-playing:hover {
  background: rgba(239, 68, 68, 0.35);
  border-color: rgb(239, 68, 68);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  background-color: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.btn-text {
  vertical-align: middle;
}
</style>
