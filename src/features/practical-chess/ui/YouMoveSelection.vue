<!-- src/features/practical-chess/ui/YouMoveSelection.vue -->
<script setup lang="ts">
import { usePracticalChessStore } from '../index'

const practicalStore = usePracticalChessStore()

const handleSelection = (color: 'white' | 'black') => {
  practicalStore.startYouMoveGame(color)
}
</script>

<template>
  <div class="you-move-bar">
    <button class="side-btn black" @click="handleSelection('black')">BLACK</button>

    <div class="center-text">CHOOSE SIDE</div>

    <button class="side-btn white" @click="handleSelection('white')">WHITE</button>
  </div>
</template>

<style scoped>
.you-move-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 20px;
  box-sizing: border-box;
  gap: 15px;
}

.center-text {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: 2px;
  color: var(--color-accent-primary);
  text-transform: uppercase;
  white-space: nowrap;
  animation: pulse-text 2s infinite ease-in-out;
}

@keyframes pulse-text {
  0% {
    transform: scale(1);
    text-shadow: 0 0 10px rgba(0, 242, 255, 0.4);
  }
  50% {
    transform: scale(1.05);
    text-shadow:
      0 0 20px rgba(0, 242, 255, 0.8),
      0 0 30px rgba(0, 242, 255, 0.4);
  }
  100% {
    transform: scale(1);
    text-shadow: 0 0 10px rgba(0, 242, 255, 0.4);
  }
}

.side-btn {
  flex: 1;
  max-width: 180px;
  height: 42px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  font-weight: 800;
  text-transform: uppercase;
  transition: all 0.3s ease;
  font-size: 0.9rem;
  letter-spacing: 1px;
  animation: pulse-shadow 2s infinite ease-in-out;
}

.side-btn.black {
  background: rgba(0, 0, 0, 0.8);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, 0.5);
  animation-name: pulse-shadow-black;
}

.side-btn.black:hover {
  background: rgba(251, 191, 36, 0.2);
  border-color: #fbbf24;
  box-shadow: 0 0 25px rgba(251, 191, 36, 0.8);
  transform: translateY(-2px);
}

.side-btn.white {
  background: rgba(255, 255, 255, 0.95);
  color: #000;
  border-color: #fff;
  animation-name: pulse-shadow-white;
}

.side-btn.white:hover {
  background: #fff;
  box-shadow: 0 0 25px rgba(255, 255, 255, 0.8);
  transform: translateY(-2px);
}

@keyframes pulse-shadow-black {
  0% {
    box-shadow: 0 0 10px rgba(251, 191, 36, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.6);
  }
  100% {
    box-shadow: 0 0 10px rgba(251, 191, 36, 0.2);
  }
}

@keyframes pulse-shadow-white {
  0% {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }
}

@media (max-width: 600px) {
  .center-text {
    font-size: 1rem;
    letter-spacing: 1px;
  }
  .side-btn {
    font-size: 0.75rem;
    padding: 0 10px;
  }
}
</style>
