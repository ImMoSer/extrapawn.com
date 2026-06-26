<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLichessGamesDbStore } from '../model/lichess-games-db.store'
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
  useDialog,
  NAlert,
} from 'naive-ui'
import {
  ArrowBackOutline,
  CloudDownloadOutline,
  TrashOutline,
  DownloadOutline,
  CloudUploadOutline,
  StatsChartOutline,
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

import LichessProfileStatsTable from './LichessProfileStatsTable.vue'
import LichessActivityStatsTabs from './LichessActivityStatsTabs.vue'

const store = useLichessGamesDbStore()
const authStore = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()
const router = useRouter()

function goToEndgameAnalysis() {
  router.push('/endgame-analysis')
}

const fileInput = ref<HTMLInputElement | null>(null)

// Bind username from authStore so they are in sync
const username = computed(() => authStore.effectiveLichessUsername)

const isDeveloper = computed(() => authStore.userProfile?.id?.toLowerCase() === 'mo3ep')
const editableUsername = ref(username.value)

watch(username, (newVal) => {
  editableUsername.value = newVal
})

function saveUsername() {
  const clean = editableUsername.value.trim().toLowerCase()
  if (clean) {
    authStore.targetLichessUsername = clean
  } else {
    resetToSelf()
  }
}

function resetToSelf() {
  if (authStore.userProfile?.id) {
    authStore.targetLichessUsername = authStore.userProfile.id
    editableUsername.value = authStore.userProfile.id
  }
}

async function refreshStats() {
  if (username.value) {
    await store.loadStats(username.value)
    await store.loadLichessProfile(username.value)
    await new Promise(resolve => setTimeout(resolve, 100))
    await store.loadLichessActivity(username.value)
  }
}

const newGamesCount = computed(() => {
  if (!store.latestLocalGameTimestamp || !store.lichessActivity) return 0

  let count = 0
  for (const item of store.lichessActivity) {
    if (item.interval && item.interval.start > store.latestLocalGameTimestamp && item.games) {
      const perfKeys = ['bullet', 'blitz', 'rapid', 'classical'] as const
      for (const key of perfKeys) {
        const gamesData = item.games[key]
        if (gamesData) {
          const nb = (gamesData.win || 0) + (gamesData.loss || 0) + (gamesData.draw || 0)
          count += nb
        }
      }
    }
  }
  return count
})

const formattedLatestGameDate = computed(() => {
  if (!store.latestLocalGameTimestamp) return ''
  const date = new Date(store.latestLocalGameTimestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

const isSyncButtonDisabled = computed(() => {
  if (store.isSyncing) return false
  if (!store.lichessProfile) return false

  // Wenn weniger als 1000 Spiele auf Lichess: Button deaktiviert (und zeigt beim Klick das Dialog-Modal)
  if (store.lichessProfile.count.all < 1000) return true

  // Wenn wir lokale Daten haben und keine neuen Spiele online vorhanden sind: Deaktiviert
  if (store.stats && store.stats.total > 0 && newGamesCount.value === 0) {
    return true
  }

  return false
})

function handleSyncWrapper() {
  if (store.lichessProfile && store.lichessProfile.count.all < 1000) {
    dialog.warning({
      title: t('features.lichessGamesDb.cacheSettings.minGamesWarningTitle'),
      content: t('features.lichessGamesDb.cacheSettings.minGamesWarningText', { count: store.lichessProfile.count.all }),
      positiveText: t('shared.buttons.close')
    })
    return
  }

  if (store.stats && store.stats.total > 0 && newGamesCount.value === 0) {
    // Datenbank ist bereits aktuell - kein Klick nötig
    return
  }

  handleSync()
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
    const keySeed = authStore.userProfile?.createdAt || 0
    await store.exportBackup(username.value, keySeed)
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
    const keySeed = authStore.userProfile?.createdAt || 0
    await store.importBackup(username.value, file, keySeed)
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

      <!-- Lichess Online Stats -->
      <NCard v-if="store.lichessProfile" class="panel-card online-stats-card" :title="$t('features.lichessGamesDb.cacheSettings.onlineStatsTitle')" size="small">
        <LichessProfileStatsTable :profile="store.lichessProfile" />
      </NCard>

      <!-- Lichess Online Activity -->
      <NCard v-if="store.lichessActivity && store.lichessActivity.length > 0" class="panel-card online-activity-card" :title="$t('features.lichessGamesDb.cacheSettings.onlineActivityTitle')" size="small">
        <LichessActivityStatsTabs :activity="store.lichessActivity" />
      </NCard>

      <!-- Alert if local DB is outdated -->
      <NAlert
        v-if="newGamesCount > 0"
        type="warning"
        :title="$t('features.lichessGamesDb.cacheSettings.dbNotUpToDate')"
        closable
      >
        {{ $t('features.lichessGamesDb.cacheSettings.dbNotUpToDateDesc', { date: formattedLatestGameDate, count: newGamesCount }) }}
      </NAlert>


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
          <div @click="handleSyncWrapper">
            <NButton
              :type="newGamesCount > 0 ? 'warning' : 'primary'"
              block
              :loading="store.isSyncing"
              :disabled="isSyncButtonDisabled"
              :style="{ pointerEvents: isSyncButtonDisabled ? 'none' : 'auto' }"
            >
              <template #icon>
                <CloudDownloadOutline />
              </template>
              {{ newGamesCount > 0 ? t('features.lichessGamesDb.cacheSettings.syncBtnUpdate', { count: newGamesCount }) : t('features.lichessGamesDb.cacheSettings.syncBtn') }}
            </NButton>
          </div>

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

          <!-- Endgame Analysis -->
          <NButton
            type="info"
            secondary
            block
            @click="goToEndgameAnalysis"
          >
            <template #icon>
              <StatsChartOutline />
            </template>
            Endspiel-Analyse
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
            accept=".epb"
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
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  border: 1px solid var(--color-border-hover);
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
