<script setup lang="ts">
import { WebChessBoard } from '@/entities/game'
import { usePreferencesStore } from '@/entities/user'
import { useCoachStudyStore } from '@/features/ai-coach'
import {
  StudyBoardControls,
  StudyBoardTopBar,
  StudyChaptersPanel,
  StudyChatPanel,
  StudyImportModal,
  StudyPgnPanel,
} from '@/widgets/coach-studio'
import GameLayout from '@/widgets/game-layout/ui/GameLayout.vue'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { Role as ChessopsRole } from 'chessops/types'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const preferencesStore = usePreferencesStore()
const studyStore = useCoachStudyStore()

const chatPanelRef = ref<InstanceType<typeof StudyChatPanel> | null>(null)
const isImportModalOpen = ref(false)

const animationDuration = computed(() => preferencesStore.preferences.theme.animationDuration)
const isAnimationEnabled = computed(() => animationDuration.value > 0)

const loadCurrentRouteStudy = async () => {
  const rawId = route.params.studyId
  const studyId = typeof rawId === 'string' ? rawId : ''
  if (!studyId) {
    await router.replace('/study')
    return
  }
  try {
    await studyStore.openStudy(studyId)
  } catch {
    await router.replace('/study')
  }
}

const handleUserMove = async ({ orig, dest }: { orig: Key; dest: Key }) => {
  await studyStore.handleBoardUserMove(orig, dest)
}

const handleCompletePromotion = async (role: ChessopsRole) => {
  await studyStore.completePromotion(role)
}

const handleWheelNavigate = (direction: 'up' | 'down') => {
  studyStore.navigateStep(direction === 'up' ? 'backward' : 'forward')
}

const handleShapesChange = (shapes: DrawShape[]) => {
  studyStore.setUserShapes(shapes)
}

const handleRequestNewChapter = () => {
  chatPanelRef.value?.focusInput()
}

const handleKeydown = (ev: KeyboardEvent) => {
  if (isImportModalOpen.value) return
  const target = ev.target as HTMLElement | null
  if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)) {
    return
  }
  if (ev.key === 'ArrowLeft') {
    ev.preventDefault()
    studyStore.navigateStep('backward')
  } else if (ev.key === 'ArrowRight') {
    ev.preventDefault()
    studyStore.navigateStep('forward')
  } else if (ev.key === 'Home') {
    ev.preventDefault()
    studyStore.navigateStep('start')
  } else if (ev.key === 'End') {
    ev.preventDefault()
    studyStore.navigateStep('end')
  }
}

watch(
  () => route.params.studyId,
  () => {
    void loadCurrentRouteStudy()
  },
)

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void loadCurrentRouteStudy()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  studyStore.resetWorkspace()
})
</script>

<template>
  <GameLayout>
    <!-- Left Panel: Chapters (top ~30%) + Live Coach Chat (bottom ~70%) -->
    <template #left-panel>
      <div class="flex h-full min-h-0 flex-col gap-2">
        <div class="flex min-h-[140px] max-h-[34%] flex-col">
          <StudyChaptersPanel
            @request-new-chapter="handleRequestNewChapter"
            @request-import="isImportModalOpen = true"
          />
        </div>
        <StudyChatPanel ref="chatPanelRef" />
      </div>
    </template>

    <!-- Center Top Bar -->
    <template #top-info>
      <StudyBoardTopBar />
    </template>

    <!-- Isolated 1:1 Chessboard (decoupled from TrainingCenter gameStore) -->
    <template #board>
      <WebChessBoard
        :fen="studyStore.currentFen"
        :orientation="studyStore.orientation"
        :turn-color="studyStore.boardState.turn"
        :dests="studyStore.boardState.dests"
        :last-move="studyStore.lastMove"
        :check="studyStore.boardState.isCheck"
        :promotion-state="studyStore.promotionState"
        :drawable-shapes="studyStore.drawableShapes"
        :is-analysis-mode="true"
        :animation-enabled="isAnimationEnabled"
        :animation-duration="animationDuration"
        :can-edit="true"
        @user-move="handleUserMove"
        @complete-promotion="handleCompletePromotion"
        @shapes-change="handleShapesChange"
        @wheel-navigate="handleWheelNavigate"
      />
    </template>

    <!-- Center Bottom Controls -->
    <template #bottom-controls>
      <StudyBoardControls />
    </template>

    <!-- Right Panel: Annotated Lichess-style Chapter PGN -->
    <template #right-panel>
      <StudyPgnPanel />
    </template>
  </GameLayout>

  <StudyImportModal v-model:show="isImportModalOpen" />
</template>
