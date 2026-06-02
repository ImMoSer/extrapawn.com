<script setup lang="ts">
import { MozerBook } from '@/features/mozer-book';
import { NText } from 'naive-ui';
</script>

<template>
  <div class="sparring-sidebar">
    <div class="sidebar-header">
      <n-text class="sidebar-title">Sparring</n-text>
    </div>

    <div class="sidebar-content">
      <div class="active-game-section">
        <div class="coach-stats-section">
          <MozerBook />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sparring-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  background: var(--color-surface-2);
}

.sidebar-header {
  margin-bottom: 20px;
}

.sidebar-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.active-game-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.coach-stats-section {
  flex: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}
</style>
