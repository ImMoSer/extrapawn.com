<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { computed } from 'vue'

const gameStore = useGameStore()

const currentNode = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return pgnService.getCurrentNode()
})

const currentCandidates = computed(() => {
  // If the current node has children, those are the candidates
  return currentNode.value.children || []
})

const navigateTo = (node: PgnNode) => {
  gameStore.navigateToNode(node)
}

const getMoveNumber = (ply: number) => {
  const num = Math.ceil(ply / 2)
  return ply % 2 === 1 ? `${num}.` : `${num}...`
}
</script>

<template>
  <div v-if="currentCandidates.length > 1" class="candidate-moves-container">
    <div class="candidates-grid">
      <div
        v-for="(child, index) in currentCandidates"
        :key="child.id"
        class="candidate-item"
        :class="{ mainline: index === 0 }"
        @click="navigateTo(child)"
      >
        <span class="move-text">
          <span class="move-num">{{ getMoveNumber(child.ply) }}</span>
          <span class="move-san">{{ child.san }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.candidate-moves-container {
  background: #262421;
  /* Lichess dark bg */
  border-top: 1px solid #404040;
}

.candidates-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-collapse: collapse;
}

.candidate-item {
  padding: 8px 12px;
  cursor: pointer;
  border: 1px solid #363636;
  display: flex;
  align-items: center;
  font-family: 'Noto Sans', sans-serif;
  transition: background 0.1s;
  color: #bababa;
}

.candidate-item:hover {
  background: #3692e7 !important;
  /* Lichess blue hover */
  color: white !important;
}

.candidate-item.mainline {
  background: #2f485e;
  /* Lichess active variation blue */
  color: #fff;
  font-weight: bold;
}

.move-text {
  font-size: 14px;
}

.move-num {
  opacity: 0.6;
  margin-right: 5px;
}

.candidate-item.mainline .move-num {
  opacity: 0.8;
}

.move-san {
  font-weight: 600;
}
</style>
