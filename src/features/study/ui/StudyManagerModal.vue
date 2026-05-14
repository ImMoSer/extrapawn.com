<script setup lang="ts">
import { useStudyStore, type Study } from '../index'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { lichessSyncService, LichessApiError } from '../api/LichessSyncService'
import LichessErrorModal from './LichessErrorModal.vue'
import {
  NButton,
  NIcon,
  NList,
  NListItem,
  NModal,
  NSpace,
  NTabPane,
  NTabs,
  NThing,
  NSpin,
  NAlert,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { PencilOutline, TrashOutline, CloudDownloadOutline } from '@vicons/ionicons5'

import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const { t } = useI18n()
const studyStore = useStudyStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const message = useMessage()

// State
const activeTab = ref('my')
const editingId = ref<string | null>(null)
const editName = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)

// Lichess Studies State
interface LichessStudyPreview {
  id: string
  name: string
  updatedAt: number
}
const lichessStudies = ref<LichessStudyPreview[]>([])
const isLoadingLichessStudies = ref(false)

// Error Modal State
const showErrorModal = ref(false)
const errorStatus = ref<number | undefined>(undefined)
const errorMessage = ref('')

// Community Tab State
const communityStudies = ref<LichessStudyPreview[]>([])
const isLoadingCommunityStudies = ref(false)
const communityToken = ref('')
const isImportingCommunity = ref(false)

// --- COMPUTED ---
const myStudies = computed(() => studyStore.studies)
const communityId = ref('')

// --- WATCHERS ---
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      if (activeTab.value === 'import_external') {
        fetchLichessStudies()
      } else if (activeTab.value === 'community') {
        fetchCommunityStudies()
      }
    }
  },
)

watch(activeTab, (newTab) => {
  if (newTab === 'import_external') {
    fetchLichessStudies()
  } else if (newTab === 'community') {
    fetchCommunityStudies()
  }
})

// --- ACTIONS ---

async function fetchLichessStudies() {
  const username = authStore.userProfile?.username
  if (!username) return

  if (!(await studyStore.requireLichessAccess())) return

  isLoadingLichessStudies.value = true
  try {
    const studies = await lichessSyncService.fetchUserStudies(username)
    // Sort by most recently updated
    lichessStudies.value = studies.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (error) {
    console.error('Failed to fetch user studies', error)
    message.error(t('features.study.manager.messages.importFailed'))
  } finally {
    isLoadingLichessStudies.value = false
  }
}

async function fetchCommunityStudies() {
  isLoadingCommunityStudies.value = true
  try {
    const info = await lichessSyncService.fetchCommunityStudyInfo()
    communityToken.value = info.token
    communityId.value = info.lichessId

    if (communityId.value) {
      const studies = await lichessSyncService.fetchUserStudies(
        communityId.value,
        communityToken.value,
      )
      communityStudies.value = studies.sort((a, b) => b.updatedAt - a.updatedAt)
    }
  } catch (error) {
    console.error('Failed to fetch community studies', error)
    message.error(t('features.study.manager.messages.communityFailed'))
  } finally {
    isLoadingCommunityStudies.value = false
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString()
}

// Select Study
function selectStudy(study: Study) {
  const firstId = study.chapterIds[0]
  if (firstId) {
    studyStore.setActiveChapter(firstId)
    emit('update:show', false)
  }
}

// Lichess Import
async function handleLichessImport(id: string) {
  const loadingMsg = message.loading(t('features.study.manager.messages.importing'), {
    duration: 0,
  })
  try {
    await studyStore.importFromLichess(id, 'owned')
    loadingMsg.destroy()
    message.success(t('features.study.manager.messages.importSuccess'))
    activeTab.value = 'my'
  } catch (e: unknown) {
    loadingMsg.destroy()
    if (e instanceof LichessApiError) {
      errorStatus.value = e.status
      errorMessage.value = e.message
      showErrorModal.value = true
    } else {
      const error =
        e instanceof Error ? e.message : t('features.study.manager.messages.importFailed')
      message.error(error)
    }
  }
}

async function handleCommunityImport(id: string) {
  isImportingCommunity.value = true
  const loadingMsg = message.loading(t('features.study.manager.messages.importingCommunity'), {
    duration: 0,
  })
  try {
    await studyStore.importFromLichess(id, 'community', communityToken.value)
    loadingMsg.destroy()
    message.success(t('features.study.manager.messages.communitySuccess'))
    activeTab.value = 'my'
  } catch (e: unknown) {
    loadingMsg.destroy()
    if (e instanceof LichessApiError) {
      errorStatus.value = e.status
      errorMessage.value = e.message
      showErrorModal.value = true
    } else {
      const error =
        e instanceof Error ? e.message : t('features.study.manager.messages.communityFailed')
      message.error(error)
    }
  } finally {
    isImportingCommunity.value = false
  }
}

// Delete Study
async function confirmDeleteStudy(study: Study, e: Event) {
  e.stopPropagation()
  const result = await uiStore.showConfirmation(
    t('common.actions.delete'),
    t('common.actions.confirm') + ` "${study.title}"?`,
  )
  if (result === 'confirm') {
    await studyStore.deleteStudy(study.id)
    message.success(t('features.study.manager.messages.deleted'))
  }
}

// Edit Study Title
async function startEditStudy(study: Study, e: Event) {
  e.stopPropagation()
  editingId.value = study.id
  editName.value = study.title
  await nextTick()
  editInputRef.value?.focus()
}

function finishEditStudy() {
  if (editingId.value && editName.value.trim()) {
    const study = studyStore.studies.find((s) => s.id === editingId.value)
    if (study) {
      study.title = editName.value.trim()
      studyStore.saveStudy(study)
    }
  }
  editingId.value = null
}

function handleModalUpdate(value: boolean) {
  if (!value && (studyStore.cloudLoading || isImportingCommunity.value)) {
    message.warning(t('features.study.manager.messages.syncInProgress'))
    return
  }
  emit('update:show', value)
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="handleModalUpdate"
    preset="card"
    :title="t('features.study.manager.title')"
    style="
      width: 600px;
      max-width: 95vw;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    "
    :bordered="false"
    size="huge"
    :auto-focus="false"
    :trap-focus="false"
    :mask-closable="!(studyStore.cloudLoading || isImportingCommunity)"
    :close-on-esc="!(studyStore.cloudLoading || isImportingCommunity)"
    :closable="!(studyStore.cloudLoading || isImportingCommunity)"
  >
    <NTabs v-model:value="activeTab" type="segment" animated>
      <NTabPane name="my" :tab="t('features.study.manager.tabs.imported')">
        <NSpace vertical style="max-height: 60vh; overflow-y: auto; padding-right: 10px">
          <!-- Studies List -->
          <div v-if="myStudies.length > 0">
            <h3 class="section-title">{{ t('features.study.manager.stats.local') }}</h3>
            <NList hoverable clickable>
              <NListItem
                v-for="study in myStudies"
                :key="study.id"
                :class="{ active: studyStore.activeStudy?.id === study.id }"
                @click="selectStudy(study)"
              >
                <NThing>
                  <template #header>
                    <div v-if="editingId === study.id" class="edit-input-wrapper">
                      <input
                        ref="editInputRef"
                        v-model="editName"
                        @click.stop
                        @blur="finishEditStudy"
                        @keyup.enter="finishEditStudy"
                        class="native-edit-input"
                      />
                    </div>
                    <span v-else>
                      {{ study.title }}
                      <span v-if="study.type === 'community'" class="community-badge">{{
                        t('features.study.manager.badges.community')
                      }}</span>
                    </span>
                  </template>
                  <template #description>
                    <span style="color: #888">{{
                      t('features.study.manager.stats.chapters', { count: study.chapterIds.length })
                    }}</span>
                  </template>
                  <template #header-extra>
                    <NSpace size="small">
                      <NButton
                        v-if="editingId !== study.id"
                        size="tiny"
                        secondary
                        circle
                        @click="(e) => startEditStudy(study, e)"
                      >
                        <template #icon
                          ><NIcon><PencilOutline /></NIcon
                        ></template>
                      </NButton>
                      <NButton
                        size="tiny"
                        secondary
                        circle
                        type="error"
                        @click="(e) => confirmDeleteStudy(study, e)"
                      >
                        <template #icon
                          ><NIcon><TrashOutline /></NIcon
                        ></template>
                      </NButton>
                    </NSpace>
                  </template>
                </NThing>
              </NListItem>
            </NList>
          </div>

          <div v-if="myStudies.length === 0" class="empty-state">
            {{ t('features.study.manager.messages.empty') }}
          </div>
        </NSpace>
      </NTabPane>

      <NTabPane name="import_external" :tab="t('features.study.manager.tabs.myStudies')">
        <NSpace
          vertical
          size="large"
          style="max-height: 60vh; overflow-y: auto; padding-right: 10px"
        >
          <div class="create-form">
            <h3>{{ t('features.study.manager.stats.lichess') }}</h3>

            <NAlert type="info" :show-icon="false" style="margin-bottom: 15px">
              {{ t('features.study.manager.alerts.selectLichess') }}
            </NAlert>

            <div v-if="isLoadingLichessStudies" class="loading-state">
              <NSpin size="medium" />
              <div style="margin-top: 10px; color: #888">{{ t('common.actions.loading') }}</div>
            </div>

            <div v-else-if="lichessStudies.length === 0" class="empty-state">
              {{ t('features.study.manager.messages.noLichessStudies') }}
              <br /><br />
              <a
                href="https://lichess.org/study"
                target="_blank"
                style="color: var(--color-accent-primary)"
              >
                {{ t('features.study.manager.messages.createOne') }}
              </a>
            </div>

            <NList v-else hoverable>
              <NListItem v-for="study in lichessStudies" :key="study.id">
                <NThing>
                  <template #header>
                    {{ study.name }}
                  </template>
                  <template #description>
                    <span style="color: #888"
                      >{{ t('features.study.manager.stats.updated') }}:
                      {{ formatDate(study.updatedAt) }}</span
                    >
                  </template>
                  <template #header-extra>
                    <NButton
                      size="small"
                      type="primary"
                      secondary
                      :disabled="myStudies.some((s) => s.lichessId === study.id)"
                      :loading="studyStore.cloudLoading"
                      @click="handleLichessImport(study.id)"
                    >
                      <template #icon
                        ><NIcon><CloudDownloadOutline /></NIcon
                      ></template>
                      {{
                        myStudies.some((s) => s.lichessId === study.id)
                          ? t('features.study.manager.buttons.imported')
                          : t('features.study.manager.buttons.import')
                      }}
                    </NButton>
                  </template>
                </NThing>
              </NListItem>
            </NList>
          </div>
        </NSpace>
      </NTabPane>

      <NTabPane name="community" :tab="t('features.study.manager.tabs.community')">
        <NSpace
          vertical
          size="large"
          style="max-height: 60vh; overflow-y: auto; padding-right: 10px"
        >
          <div class="create-form">
            <h3>{{ t('features.study.manager.stats.importCommunity') }}</h3>
            <NAlert type="info" :show-icon="false" style="margin-bottom: 15px">
              <i18n-t keypath="features.study.manager.alerts.communityInfo">
                <template #link>
                  <a
                    href="https://lichess.org/@/ExtraPawnCOM"
                    target="_blank"
                    style="color: var(--color-accent-primary); font-weight: bold"
                    >https://lichess.org/@/ExtraPawnCOM</a
                  >
                </template>
              </i18n-t>
            </NAlert>

            <div v-if="isLoadingCommunityStudies" class="loading-state">
              <NSpin size="medium" />
              <div style="margin-top: 10px; color: #888">{{ t('common.actions.loading') }}</div>
            </div>

            <div v-else-if="communityStudies.length === 0" class="empty-state">
              {{ t('features.study.manager.messages.noCommunityStudies') }}
            </div>

            <NList v-else hoverable>
              <NListItem v-for="study in communityStudies" :key="study.id">
                <NThing>
                  <template #header>
                    {{ study.name }}
                  </template>
                  <template #description>
                    <span style="color: #888"
                      >{{ t('features.study.manager.stats.updated') }}:
                      {{ formatDate(study.updatedAt) }}</span
                    >
                  </template>
                  <template #header-extra>
                    <NButton
                      size="small"
                      type="primary"
                      secondary
                      :disabled="myStudies.some((s) => s.lichessId === study.id)"
                      :loading="isImportingCommunity"
                      @click="handleCommunityImport(study.id)"
                    >
                      <template #icon
                        ><NIcon><CloudDownloadOutline /></NIcon
                      ></template>
                      {{
                        myStudies.some((s) => s.lichessId === study.id)
                          ? t('features.study.manager.buttons.imported')
                          : t('features.study.manager.buttons.importReadonly')
                      }}
                    </NButton>
                  </template>
                </NThing>
              </NListItem>
            </NList>
          </div>
        </NSpace>
      </NTabPane>
    </NTabs>

    <LichessErrorModal
      v-model:show="showErrorModal"
      :status="errorStatus"
      :message="errorMessage"
    />
  </NModal>
</template>

<style scoped>
.create-form {
  background: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 10px;
  border: 1px solid var(--color-border);
}

.active {
  background-color: rgba(var(--color-primary-rgb), 0.1);
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-secondary);
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
}

.section-title {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 4px;
}

.native-edit-input {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-primary);
  color: var(--color-text-primary);
  padding: 2px 5px;
  border-radius: 4px;
  width: 100%;
}

.community-badge {
  font-size: 0.75rem;
  color: var(--neon-pink);
  margin-left: 8px;
  font-weight: bold;
}
</style>
