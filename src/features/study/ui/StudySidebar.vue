<script setup lang="ts">
import { AddOutline, CloudDownloadOutline, SettingsOutline, ArrowUpOutline, CloudUploadOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NList, NListItem, NScrollbar, NSpace, NText, NThing, useDialog, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
// eslint-disable-next-line boundaries/element-types
import { srsService, useReplyTrainingStore } from '../../study-reply-training'
import { LichessApiError } from '../api/LichessSyncService'
import { useBoardStore } from '@/entities/game'
import { useStudyStore, type StudyChapter, isChapterTrimmed } from '@/entities/study'
import ChapterSettingsModal from './ChapterSettingsModal.vue'
import LichessErrorModal from './LichessErrorModal.vue'
import { apiClient } from '@/shared/api/client'

const studyStore = useStudyStore()
const trainingStore = useReplyTrainingStore()
const boardStore = useBoardStore()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()

const isStartingReply = ref(false)

const startReplyTraining = async (chapter: StudyChapter) => {
  if (isStartingReply.value) return
  isStartingReply.value = true
  try {
    await apiClient('/opening/study-reply/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chapterId: chapter.id }),
    })
    selectChapter(chapter.id)
    trainingStore.trainingChapterId = chapter.id
    trainingStore.isReplyTrainingActive = true
    message.success(t('features.study.replyTraining.startedMessage'))
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }, message?: string }
    message.error(err.response?.data?.message || err.message || t('features.study.replyTraining.errorStarting'))
  } finally {
    isStartingReply.value = false
  }
}

const SYNC_COOLDOWN_MS = 60 * 1000 // 60 seconds
const PUSH_COOLDOWN_MS = 5 * 1000
const PUBLISH_COOLDOWN_MS = 5 * 1000

const lastSyncTime = ref<number>(0)
const cooldownRemaining = ref(0)
const chapterCooldowns = ref<Record<string, { push: number; pub: number }>>({})

let cooldownTimer: number | null = null

const activeStudyChapters = computed(() => {
  const study = studyStore.activeStudy
  if (!study) return []

  const chapters = studyStore.chapters.filter(c => c.studyId === study.id)
  const orderMap = new Map(study.chapterIds.map((id, index) => [id, index]))

  return chapters.sort((a, b) => {
    const aIndex = orderMap.get(a.id) ?? 9999
    const bIndex = orderMap.get(b.id) ?? 9999
    return aIndex - bIndex
  })
})

const isCommunity = computed(() => studyStore.activeStudy?.type === 'community')
const cooldownActive = computed(() => cooldownRemaining.value > 0)

const isSpeedrunReady = computed(() => {
  if (activeStudyChapters.value.length === 0) return false
  return activeStudyChapters.value.every(chapter =>
    chapter.chapter_type === 'speedrun' &&
    ['1-0', '0-1', '1/2-1/2'].includes(chapter.tags.Result || '')
  )
})



const getChapterProgress = (chapter: StudyChapter): number => {
  return srsService.getChapterCleanliness(chapter.root)
}

const getProgressBarColor = (progress: number): string => {
  if (progress < 0.3) return 'var(--neon-red)'
  if (progress < 0.7) return 'var(--neon-yellow)'
  return 'var(--neon-cyan)'
}

const showSettingsModal = ref(false)
const showErrorModal = ref(false)
const errorStatus = ref<number | undefined>(undefined)
const errorMessage = ref('')
const isCreating = ref(false)
const selectedChapter = ref<StudyChapter | null>(null)

function updateCooldowns() {
  const now = Date.now()

  // Sync Study Cooldown
  const elapsedSync = now - lastSyncTime.value
  cooldownRemaining.value = Math.max(0, Math.ceil((SYNC_COOLDOWN_MS - elapsedSync) / 1000))

  // Chapter Cooldowns
  let anyChapterCooldown = false
  studyStore.chapters.forEach(chapter => {
    const pushLast = parseInt(localStorage.getItem(`push_${chapter.id}`) || '0', 10)
    const pubLast = parseInt(localStorage.getItem(`pub_${chapter.id}`) || '0', 10)
    
    const pushVal = Math.max(0, Math.ceil((PUSH_COOLDOWN_MS - (now - pushLast)) / 1000))
    const pubVal = Math.max(0, Math.ceil((PUBLISH_COOLDOWN_MS - (now - pubLast)) / 1000))
    
    if (pushVal > 0 || pubVal > 0) anyChapterCooldown = true
    
    chapterCooldowns.value[chapter.id] = { push: pushVal, pub: pubVal }
  })

  if (cooldownRemaining.value === 0 && !anyChapterCooldown && cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startTimerIfNeeded() {
  updateCooldowns()
  if (!cooldownTimer) {
    cooldownTimer = window.setInterval(updateCooldowns, 1000)
  }
}

onMounted(() => {
  const stored = localStorage.getItem(`lastSync_${studyStore.activeStudy?.id}`)
  if (stored) {
    lastSyncTime.value = parseInt(stored, 10)
  }
  startTimerIfNeeded()
})

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

function selectChapter(id: string) {
  studyStore.setActiveChapter(id)
  // Ensure start position
  boardStore.navigatePgn('start')
  boardStore.syncBoardWithPgn()
}

function handleAddChapter() {
  if (studyStore.activeStudy && studyStore.activeStudy.chapterIds.length < 64) {
    selectedChapter.value = null
    isCreating.value = true
    showSettingsModal.value = true
  }
}

function openSettings(chapter: StudyChapter, e: Event) {
  e.stopPropagation()
  selectedChapter.value = chapter
  isCreating.value = false
  showSettingsModal.value = true
}

function handleStartSpeedrun() {
  console.log('[StudySidebar] START_SPEEDRUN clicked for study:', studyStore.activeStudy?.id)

  const speedrunChapters = activeStudyChapters.value.filter(chapter =>
    chapter.chapter_type === 'speedrun' &&
    ['1-0', '0-1', '1/2-1/2'].includes(chapter.tags.Result || '')
  )

  if (speedrunChapters.length > 0) {
    router.push({
      name: 'study-speedrun',
      query: { studyId: studyStore.activeStudy?.id }
    })
  } else {
    message.warning(t('features.speedrun.noValidChapters'))
  }
}

async function handleSyncFromLichess() {
  if (!studyStore.activeStudy?.lichessId) return

  if (cooldownActive.value) {
    message.warning(`Please wait ${cooldownRemaining.value}s before syncing again.`)
    return
  }

  dialog.warning({
    title: t('features.study.sidebar.syncConfirmTitle'),
    content: t('features.study.sidebar.syncConfirmContent'),
    positiveText: t('features.study.sidebar.syncConfirmPositive'),
    negativeText: t('features.study.sidebar.syncConfirmNegative'),
    onPositiveClick: async () => {
      const loadingMsg = message.loading(t('features.study.sidebar.syncing'), { duration: 0 })
      try {
        await studyStore.syncLichessToApp(studyStore.activeStudy!.lichessId!)

        // Set cooldown
        lastSyncTime.value = Date.now()
        localStorage.setItem(`lastSync_${studyStore.activeStudy?.id}`, lastSyncTime.value.toString())
        startTimerIfNeeded()

        loadingMsg.destroy()
        message.success(t('features.study.sidebar.syncSuccess'))
      } catch (e: unknown) {
        loadingMsg.destroy()
        if (e instanceof LichessApiError) {
          errorStatus.value = e.status
          errorMessage.value = e.message
          showErrorModal.value = true
        } else {
          const error = e instanceof Error ? e.message : t('features.study.sidebar.syncError')
          message.error(error)
        }
      }
    }
  })
}

async function handlePublish(chapter: StudyChapter, e: Event) {
  e.stopPropagation()
  const cooldown = chapterCooldowns.value[chapter.id]?.pub || 0
  if (cooldown > 0) {
    message.warning(`Please wait ${cooldown}s before publishing again.`)
    return
  }

  const loadingMsg = message.loading(t('features.study.sidebar.publishingChapter'), { duration: 0 })
  try {
    await studyStore.publishChapterToLichess(chapter.id)
    localStorage.setItem(`pub_${chapter.id}`, Date.now().toString())
    startTimerIfNeeded()
    loadingMsg.destroy()
    message.success(t('features.study.sidebar.publishSuccess'))
  } catch (e: unknown) {
    loadingMsg.destroy()
    const error = e instanceof Error ? e.message : t('features.study.sidebar.publishError')
    message.error(error)
  }
}

async function handlePush(chapter: StudyChapter, e: Event) {
  e.stopPropagation()
  const cooldown = chapterCooldowns.value[chapter.id]?.push || 0
  if (cooldown > 0) {
    message.warning(`Please wait ${cooldown}s before pushing again.`)
    return
  }

  const loadingMsg = message.loading(t('features.study.sidebar.pushing'), { duration: 0 })
  try {
    await studyStore.pushChapterToLichess(chapter.id)
    localStorage.setItem(`push_${chapter.id}`, Date.now().toString())
    startTimerIfNeeded()
    loadingMsg.destroy()
    message.success(t('features.study.sidebar.pushSuccess'))
  } catch (e: unknown) {
    loadingMsg.destroy()
    const error = e instanceof Error ? e.message : t('features.study.sidebar.pushError')
    message.error(error)
  }
}
</script>

<template>
  <div v-if="studyStore.activeStudy" class="study-sidebar">
    <div class="study-sidebar-header">
      <div class="header-main-row">
        <NText strong class="study-title">{{ studyStore.activeStudy.title }}</NText>

        <NSpace v-if="studyStore.activeStudy.lichessId" size="small">
          <NButton
            size="tiny"
            quaternary
            circle
            @click="handleSyncFromLichess"
            :disabled="cooldownActive"
            :title="cooldownActive ? t('features.study.sidebar.cooldownTooltip', { seconds: cooldownRemaining }) : t('features.study.sidebar.syncTooltip')"
          >
            <template #icon><NIcon class="sync-icon"><CloudDownloadOutline /></NIcon></template>
          </NButton>
        </NSpace>
      </div>

      <div v-if="isSpeedrunReady" class="speedrun-ready-badge" @click="handleStartSpeedrun">
        START SPEEDRUN
      </div>

      <div class="chapter-count-badge">{{ t('features.study.sidebar.chapterCount', { count: activeStudyChapters.length }) }}</div>

      <!-- Reply Training Action Header -->
      <div v-if="trainingStore.isReadyToReply" class="reply-training-toggle">
        <NText :depth="2" style="font-size: 0.8rem; font-weight: bold;">{{ t('features.study.replyTraining.title') }}</NText>
      </div>
    </div>

    <NScrollbar class="chapters-scroll">
      <NList hoverable clickable>
        <NListItem
          v-for="(chapter, index) in activeStudyChapters"
          :key="chapter.id"
          :class="{ active: studyStore.activeChapterId === chapter.id }"
          @click="selectChapter(chapter.id)"
        >
          <NThing>
            <template #avatar>
              <div class="chapter-index">{{ index + 1 }}</div>
            </template>
            <template #header>
              <div class="chapter-name">{{ chapter.name.replace(/->/g, '\n->') }}</div>
            </template>
            <template #header-extra>
              <NSpace size="small" align="center" :wrap="false">
                <template v-if="chapter.chapter_type === 'repertoire'">
                  <span v-if="isChapterTrimmed(chapter)" class="tag-reply" @click.stop="startReplyTraining(chapter)">REPLY</span>
                  <span v-else class="tag-trim" title="You have multiple choices defined. Trim the tree!">TRIM</span>
                </template>
                <template v-else-if="chapter.chapter_type === 'speedrun'">
                  <span
                    v-if="['1-0', '0-1', '1/2-1/2'].includes(chapter.tags.Result || '')"
                    class="tag-speed"
                    :class="{
                      'tag-win-white': chapter.tags.Result === '1-0',
                      'tag-win-black': chapter.tags.Result === '0-1',
                      'tag-draw': chapter.tags.Result === '1/2-1/2'
                    }"
                  >
                    {{ chapter.tags.Result }}
                  </span>
                  <span v-else class="tag-result">RESULT</span>
                </template>
                <!-- Publish to Lichess -->
                <NButton
                  v-if="studyStore.activeStudy?.lichessId && !chapter.lichessChapterId && !isCommunity"
                  size="tiny"
                  quaternary
                  circle
                  type="primary"
                  :disabled="(chapterCooldowns[chapter.id]?.pub || 0) > 0"
                  :title="(chapterCooldowns[chapter.id]?.pub || 0) > 0 ? t('features.study.sidebar.cooldownWait', { seconds: chapterCooldowns[chapter.id]?.pub }) : t('features.study.sidebar.publishChapterTooltip')"
                  @click="(e) => handlePublish(chapter, e)"
                >
                  <template #icon><NIcon><ArrowUpOutline /></NIcon></template>
                </NButton>

                <!-- Push Update to Lichess -->
                <NButton
                  v-if="studyStore.activeStudy?.lichessId && chapter.lichessChapterId && !isCommunity"
                  size="tiny"
                  quaternary
                  circle
                  :disabled="(chapterCooldowns[chapter.id]?.push || 0) > 0"
                  :title="(chapterCooldowns[chapter.id]?.push || 0) > 0 ? t('features.study.sidebar.cooldownWait', { seconds: chapterCooldowns[chapter.id]?.push }) : t('features.study.sidebar.pushChapterTooltip')"
                  @click="(e) => handlePush(chapter, e)"
                >
                  <template #icon><NIcon class="sync-icon"><CloudUploadOutline /></NIcon></template>
                </NButton>

                <NButton
                  v-if="!isCommunity"
                  size="tiny" quaternary circle @click="(e) => openSettings(chapter, e)"
                >
                  <template #icon><NIcon class="settings-icon"><SettingsOutline /></NIcon></template>
                </NButton>
              </NSpace>
            </template>
            <!-- Progress Bar -->
            <div class="chapter-progress-container">
               <div
                 class="chapter-progress-bar"
                 :style="{ 
                    width: `${getChapterProgress(chapter) * 100}%`,
                    background: getProgressBarColor(getChapterProgress(chapter)),
                    boxShadow: `0 0 5px ${getProgressBarColor(getChapterProgress(chapter))}`
                 }"
               ></div>
            </div>
          </NThing>
        </NListItem>
      </NList>

      <div class="sidebar-actions" v-if="!isCommunity">
        <NButton
          block
          dashed
          size="medium"
          :disabled="activeStudyChapters.length >= 64"
          @click="handleAddChapter"
        >
          <template #icon>
            <NIcon><AddOutline /></NIcon>
          </template>
          {{ t('features.study.sidebar.addChapter') }}
        </NButton>
      </div>
    </NScrollbar>

    <ChapterSettingsModal
      v-model:show="showSettingsModal"
      :chapter="selectedChapter"
      :is-creating="isCreating"
    />

    <LichessErrorModal
      v-model:show="showErrorModal"
      :status="errorStatus"
      :message="errorMessage"
    />
  </div>
</template>

<style scoped>
.study-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.study-sidebar-header {
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-training-toggle {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(var(--neon-cyan-rgb), 0.05);
  border: 1px solid rgba(var(--neon-cyan-rgb), 0.2);
  border-radius: 6px;
}

.header-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.study-title {
  font-size: 1.1rem;
  color: var(--color-accent-primary);
  word-break: break-word;
  line-height: 1.3;
}

.chapter-count-badge {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.speedrun-ready-badge {
  font-size: 0.85rem;
  font-weight: 900;
  color: white;
  background: var(--neon-bordeaux);
  border-radius: 8px;
  padding: 8px 20px;
  cursor: pointer;
  align-self: center;
  margin: 12px 0;
  letter-spacing: 2px;
  transition: all 0.3s ease;
  animation: pulse-speedrun 2s infinite ease-in-out;
  border: 1px solid rgba(255, 255, 255, 0.2);
  text-align: center;
  width: 90%;
}

.speedrun-ready-badge:hover {
  filter: brightness(1.2);
  animation-play-state: paused;
  transform: scale(1.1);
}

@keyframes pulse-speedrun {
  0% {
    box-shadow: 0 0 10px rgba(217, 0, 76, 0.6), 0 0 5px rgba(0, 242, 255, 0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 25px rgba(217, 0, 76, 0.9), 0 0 15px rgba(247, 213, 71, 0.6);
    transform: scale(1.05);
  }
  100% {
    box-shadow: 0 0 10px rgba(217, 0, 76, 0.6), 0 0 5px rgba(0, 242, 255, 0.3);
    transform: scale(1);
  }
}

.chapters-scroll {
  flex: 1;
}

.chapter-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.chapter-name {
  font-size: 0.9rem;
  font-weight: 500;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.3;
  min-width: 0;
  flex: 1;
}

.tag-reply {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--neon-cyan);
  border: 1px solid var(--neon-cyan);
  background-color: rgba(0, 255, 255, 0.1);
  border-radius: 4px;
  padding: 0 4px;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tag-reply:hover {
  background-color: var(--neon-cyan);
  color: #000;
}

.tag-trim {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--neon-pink);
  border: 1px solid var(--neon-pink);
  border-radius: 4px;
  padding: 0 4px;
  flex-shrink: 0;
}

.chapter-progress-container {
  height: 3px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.chapter-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--neon-cyan), var(--neon-blue));
  transition: width 0.5s ease;
  box-shadow: 0 0 5px var(--neon-cyan);
}

.tag-speed {
  font-size: 0.65rem;
  font-weight: 800;
  border-radius: 4px;
  padding: 0 4px;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.tag-win-white {
  color: var(--neon-cyan);
  border-color: var(--neon-cyan);
}

.tag-win-black {
  color: var(--neon-purple);
  border-color: var(--neon-purple);
}

.tag-draw {
  color: var(--neon-yellow);
  border-color: var(--neon-yellow);
}

.tag-result {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--neon-red);
  border: 1px solid var(--neon-red);
  border-radius: 4px;
  padding: 0 4px;
  flex-shrink: 0;
}


.active {
  background-color: rgba(var(--color-primary-rgb), 0.15) !important;
  border-left: 3px solid var(--color-accent-primary);
}

.active .chapter-index {
  background: var(--color-accent-primary);
  color: white;
}

.sidebar-actions {
  padding: 16px;
}

:deep(.n-list-item) {
  padding: 10px 16px !important;
  transition: all 0.2s ease;
}

:deep(.n-list-item:hover) {
  background: rgba(255, 255, 255, 0.05);
}
.sync-icon {
  color: var(--color-primary-hover);
}
.settings-icon {
  color: var(--neon-yellow);
}

.chapter-progress-container {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
  width: 100%;
}

.chapter-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}
</style>
