<script setup lang="ts">
import { useOpenCheckStore } from '@/features/open-check'
import { useAuthStore } from '@/entities/user'
import { NButton, NCard, NTag } from 'naive-ui'
import { TrashOutline, AddOutline, ShieldCheckmarkOutline, SettingsOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

const emit = defineEmits<{
  (e: 'new-analysis'): void
  (e: 'manage-cache'): void
}>()

const openCheckStore = useOpenCheckStore()
const authStore = useAuthStore()

const subscriptionTier = computed(() => {
  return authStore.userProfile?.subscriptionTier || 'Pawn'
})

const isPremium = computed(() => openCheckStore.isPremium)
</script>

<template>
  <div class="history-list-panel">
    <!-- Header banner -->
    <div class="sidebar-header-banner">
      <div class="title-meta">
        <h2 class="sidebar-title">Repertoire Explorer</h2>
        <NTag :type="isPremium ? 'success' : 'warning'" size="small" round class="tier-tag">
          <template #icon>
            <ShieldCheckmarkOutline style="width: 12px; vertical-align: middle;" />
          </template>
          {{ subscriptionTier }}
        </NTag>
      </div>
      <div class="action-buttons-row">
        <NButton
          type="primary"
          class="new-analysis-btn glow-btn-teal"
          style="flex: 1;"
          @click="emit('new-analysis')"
        >
          <template #icon>
            <AddOutline />
          </template>
          New Analysis
        </NButton>
        <NButton
          secondary
          circle
          title="Database Cache Settings"
          @click="emit('manage-cache')"
        >
          <template #icon>
            <SettingsOutline />
          </template>
        </NButton>
      </div>
    </div>

    <!-- Cached analyses list -->
    <NCard class="panel-card history-card" title="Cached Analyses" size="small">
      <div v-if="openCheckStore.analysesHistory.length === 0" class="empty-history">
        No analyses found. Create a new one to get started.
      </div>
      <div v-else class="history-list">
        <div
          v-for="item in openCheckStore.analysesHistory"
          :key="item.id"
          class="history-item"
          :class="{ 'is-selected': openCheckStore.currentAnalysis?.id === item.id }"
          @click="openCheckStore.selectAnalysis(item)"
        >
          <div class="item-meta">
            <div class="item-user">
              {{ item.username }} ({{ item.color === 'white' ? 'White' : 'Black' }})
            </div>
            <div class="item-specs">
              Opening: <span class="spec-highlight">{{ item.rootMove }}</span>
            </div>
            <div class="item-specs-sub">
              Games: {{ item.gamesCount }} | Depth: {{ item.maxDepth }} ply
            </div>
            <div class="item-date">
              {{ new Date(item.timestamp).toLocaleString() }}
            </div>
          </div>
          <NButton
            quaternary
            circle
            size="small"
            type="error"
            class="delete-btn"
            @click.stop="openCheckStore.deleteAnalysis(item.id)"
          >
            <template #icon>
              <TrashOutline />
            </template>
          </NButton>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.history-list-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.sidebar-header-banner {
  background: rgba(25, 25, 35, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.title-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.tier-tag {
  font-weight: 700;
  font-size: 0.75rem;
}

.new-analysis-btn {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
}

.glow-btn-teal {
  background-color: transparent !important;
  border: 1px solid #00f5d4 !important;
  color: #00f5d4 !important;
  transition: all 0.3s ease;
}

.glow-btn-teal:hover {
  background-color: rgba(0, 245, 212, 0.1) !important;
  box-shadow: 0 0 15px rgba(0, 245, 212, 0.4);
}

.panel-card {
  background: rgba(25, 25, 35, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important;
  backdrop-filter: blur(8px) !important;
  border-radius: 12px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.n-card-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 16px !important;
}

:deep(.n-card-header__title) {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  color: #00f5d4 !important;
  font-size: 1rem;
}

:deep(.n-card__content) {
  padding: 16px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.empty-history {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
  padding: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;
  flex: 1;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.history-item.is-selected {
  border-color: #00f5d4;
  background: rgba(0, 245, 212, 0.04);
  box-shadow: 0 0 8px rgba(0, 245, 212, 0.1);
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.item-user {
  font-weight: bold;
  font-size: 0.9rem;
  color: #ffffff;
}

.item-specs {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.spec-highlight {
  color: #00f5d4;
  font-weight: bold;
}

.item-specs-sub {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.item-date {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 2px;
}

.delete-btn {
  opacity: 0.3;
  transition: opacity 0.2s ease;
}

.history-item:hover .delete-btn {
  opacity: 1;
}

.action-buttons-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.history-list::-webkit-scrollbar {
  width: 4px;
}

.history-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
</style>
