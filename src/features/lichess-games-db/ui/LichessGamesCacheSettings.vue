<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useLichessGamesDbStore } from '../model/lichess-games-db.store'
import { useOpenCheckStore } from '@/features/open-check'
import { useAuthStore } from '@/entities/user'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NCard,
  NText,
  NProgress,
  NSpace,
  NInput,
  useMessage,
} from 'naive-ui'
import {
  ArrowBackOutline,
  CloudDownloadOutline,
  TrashOutline,
  DownloadOutline,
  CloudUploadOutline,
} from '@vicons/ionicons5'

withDefaults(
  defineProps<{
    showBack?: boolean
  }>(),
  {
    showBack: true
  }
)

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useLichessGamesDbStore()
const openCheckStore = useOpenCheckStore()
const authStore = useAuthStore()
const message = useMessage()
const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)

// Bind username from openCheckStore so they are in sync
const username = computed(() => openCheckStore.targetUsername)

const isDeveloper = computed(() => authStore.userProfile?.id?.toLowerCase() === 'mo3ep')
const editableUsername = ref(username.value)

watch(username, (newVal) => {
  editableUsername.value = newVal
})

function saveUsername() {
  const clean = editableUsername.value.trim().toLowerCase()
  if (clean) {
    openCheckStore.targetUsername = clean
  } else {
    resetToSelf()
  }
}

function resetToSelf() {
  if (authStore.userProfile?.id) {
    openCheckStore.targetUsername = authStore.userProfile.id
    editableUsername.value = authStore.userProfile.id
  }
}

async function refreshStats() {
  if (username.value) {
    await store.loadStats(username.value)
  }
}

onMounted(() => {
  refreshStats()
})

watch(username, () => {
  refreshStats()
})

async function handleSync() {
  if (!username.value.trim()) {
    message.error(t('features.lichessGamesDb.cacheSettings.enterUsernameError'))
    return
  }
  try {
    message.loading(t('features.lichessGamesDb.cacheSettings.syncLoading'), { duration: 0 })
    // Sync bullet, blitz, rapid, classical, standard modes
    await store.syncGames(username.value, ['bullet', 'blitz', 'rapid', 'classical', 'standard'])
    message.destroyAll()
    message.success(t('features.lichessGamesDb.cacheSettings.syncSuccess'))
  } catch (err: unknown) {
    message.destroyAll()
    const errMsg = err instanceof Error ? err.message : t('features.lichessGamesDb.cacheSettings.syncError')
    message.error(errMsg)
  }
}

async function handleClear() {
  if (!username.value.trim()) return
  try {
    await store.wipeCache(username.value)
    message.success(t('features.lichessGamesDb.cacheSettings.clearSuccess'))
  } catch {
    message.error(t('features.lichessGamesDb.cacheSettings.clearError'))
  }
}

async function handleExport() {
  if (!username.value.trim()) return
  try {
    await store.exportBackup(username.value)
    message.success(t('features.lichessGamesDb.cacheSettings.exportSuccess'))
  } catch {
    message.error(t('features.lichessGamesDb.cacheSettings.exportError'))
  }
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  try {
    message.loading(t('features.lichessGamesDb.cacheSettings.importLoading'), { duration: 0 })
    await store.importBackup(username.value, file)
    message.destroyAll()
    message.success(t('features.lichessGamesDb.cacheSettings.importSuccess'))
  } catch (err: unknown) {
    message.destroyAll()
    const errMsg = err instanceof Error ? err.message : t('features.lichessGamesDb.cacheSettings.importError')
    message.error(errMsg)
  } finally {
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

const syncProgressPercentage = computed(() => {
  if (!store.syncProgress.total) return 0
  return Math.round((store.syncProgress.current / store.syncProgress.total) * 100)
})
</script>

<template>
  <div class="lichess-games-cache-settings">
    <!-- Header panel with back button -->
    <div v-if="showBack" class="sidebar-header-banner">
      <div class="header-action-row">
        <NButton v-if="showBack" quaternary circle size="small" @click="emit('back')">
          <template #icon>
            <ArrowBackOutline />
          </template>
        </NButton>
        <span class="wizard-title">{{ $t('features.lichessGamesDb.cacheSettings.title') }}</span>
      </div>
    </div>

    <div class="content-container">
      <!-- Active User Profile Display -->
      <NCard class="panel-card user-status-card" size="small">
        <div class="username-display" style="display: flex; align-items: center; justify-content: space-between; width: 100%">
          <span class="username-label">{{ $t('features.lichessGamesDb.cacheSettings.username') }}</span>
          <div v-if="isDeveloper" style="display: flex; gap: 8px; align-items: center; flex-grow: 1; margin-left: 12px; max-width: 250px">
            <NInput
              v-model:value="editableUsername"
              size="small"
              placeholder="Username..."
              @blur="saveUsername"
              @keyup.enter="saveUsername"
            />
            <NButton size="small" secondary @click="resetToSelf">Reset</NButton>
          </div>
          <span v-else class="username-value">{{ username || $t('features.lichessGamesDb.cacheSettings.noUserSelected') }}</span>
        </div>
      </NCard>


      <!-- Sync Progress Section -->
      <NCard v-if="store.isSyncing" class="panel-card progress-card" size="small">
        <div class="progress-info">
          <NText class="progress-label">{{ $t('features.lichessGamesDb.cacheSettings.syncing') }}</NText>
          <NText class="progress-details" depth="3">
            {{ $t('features.lichessGamesDb.cacheSettings.gamesDownloaded', { current: store.syncProgress.current, total: store.syncProgress.total || '?' }) }}
          </NText>
        </div>
        <NProgress
          type="line"
          :percentage="syncProgressPercentage"
          :show-indicator="true"
          processing
          status="success"
        />
      </NCard>

      <!-- Action Panel -->
      <NCard class="panel-card actions-card" :title="$t('features.lichessGamesDb.cacheSettings.actions')" size="small">
        <NSpace vertical size="medium">
          <!-- Synchronize Button -->
          <NButton
            type="primary"
            block
            :loading="store.isSyncing"
            @click="handleSync"
          >
            <template #icon>
              <CloudDownloadOutline />
            </template>
            {{ $t('features.lichessGamesDb.cacheSettings.syncBtn') }}
          </NButton>

          <!-- Export Backup -->
          <NButton
            secondary
            block
            :disabled="!store.stats || store.stats.total === 0 || store.isSyncing"
            @click="handleExport"
          >
            <template #icon>
              <DownloadOutline />
            </template>
            {{ $t('features.lichessGamesDb.cacheSettings.exportBtn') }}
          </NButton>

          <!-- Import Backup -->
          <NButton
            secondary
            block
            :disabled="store.isSyncing"
            @click="triggerImport"
          >
            <template #icon>
              <CloudUploadOutline />
            </template>
            {{ $t('features.lichessGamesDb.cacheSettings.importBtn') }}
          </NButton>
          <input
            type="file"
            ref="fileInput"
            accept=".json"
            style="display: none"
            @change="handleImport"
          />

          <!-- Wipe Cache Button -->
          <NButton
            type="error"
            secondary
            block
            :disabled="!store.stats || store.stats.total === 0 || store.isSyncing"
            @click="handleClear"
          >
            <template #icon>
              <TrashOutline />
            </template>
            {{ $t('features.lichessGamesDb.cacheSettings.wipeBtn') }}
          </NButton>
        </NSpace>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.lichess-games-cache-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-header-banner {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wizard-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.content-container {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex: 1;
}

.panel-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.user-status-card {
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.1) 0%, rgba(24, 160, 88, 0.02) 100%);
  border-color: rgba(24, 160, 88, 0.2);
}

.username-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.username-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.username-value {
  font-size: 15px;
  font-weight: 700;
  color: #18a058;
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.stat-label {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.stat-count {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.stat-sub-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.sub-stat-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  font-size: 12px;
}

.sub-label {
  color: rgba(255, 255, 255, 0.5);
}

.sub-val {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.empty-stats {
  padding: 16px 0;
  text-align: center;
}

.progress-card {
  border-color: rgba(24, 160, 88, 0.3);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
}

.progress-label {
  font-weight: 600;
}
</style>
