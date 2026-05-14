<!-- src/pages/DiamondHunterView.vue -->
<script setup lang="ts">
import { useBoardStore, useGameStore } from '@/entities/game'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import {
  DiamondHunterSettingsModal,
  GravityBook,
  useDiamondHunterStore,
  useDiamondHunterUi,
} from '@/features/diamond-hunter'
import { ArrowBack, DiamondOutline, FlashOutline, TelescopeOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NModal, NNumberAnimation, NSpace, NSpin, NStatistic } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { GameLayout, TopInfoPanel } from '@/widgets/game-layout'

const diamondHunterStore = useDiamondHunterStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const route = useRoute()

// Initialize UI interactions
useDiamondHunterUi()

const isSettingsModalOpen = ref(false)
const isAnalysisView = ref(false)
const isInitializing = ref(false)

onMounted(async () => {
  diamondHunterStore.reset()

  const colorParam = (route.params.color || route.params.openingSlug) as string | undefined
  const isAutoStart = colorParam?.startsWith('for_')

  if (isAutoStart) {
    isInitializing.value = true
    await handleRouteParams(colorParam)
    isInitializing.value = false
  } else {
    isSettingsModalOpen.value = true
  }
})

async function handleRouteParams(param?: string) {
  const colorParam = param || (route.params.color as string | undefined)
  let color: 'white' | 'black' = 'white'

  if (colorParam) {
    const normalized = colorParam.replace('for_', '')
    if (normalized === 'white' || normalized === 'black') {
      color = normalized
    }
  }

  await startSession(color)
}

onUnmounted(() => {
  diamondHunterStore.stopHunt()
  analysisStore.hidePanel()
  analysisStore.setPlayerColor(null)
  gameStore.resetGame()
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

async function startSession(color: 'white' | 'black') {
  isSettingsModalOpen.value = false
  isAnalysisView.value = false

  // 1. Setup Analysis and Strategy EARLY to avoid race conditions
  // Setting player color must happen BEFORE starting the hunt because
  // startHunt() triggers updateArrows() which requires playerColor.
  analysisStore.setPlayerColor(color)
  analysisStore.hidePanel()

  // 2. Start the hunt (Authorization & State Setup)
  const success = await diamondHunterStore.startHunt()
  if (!success) return

  router.replace({
    name: 'diamond-hunter',
    params: { color: `for_${color}` },
  })

  // 3. Create strategy and start the game engine
  const strategy = diamondHunterStore.createStrategy()
  const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  gameStore.startWithStrategy(
    STARTING_FEN,
    strategy,
    color,
    true, // keepPgn: true
  )

  // 4. Initialize board visual state
  boardStore.setupPosition(STARTING_FEN, color)
}

async function handleRestart() {
  diamondHunterStore.stopHunt()
  isAnalysisView.value = false
  await gameStore.resetGame()
  isSettingsModalOpen.value = true
}

function startAnalysis() {
  diamondHunterStore.stopHunt()
  isAnalysisView.value = true
  analysisStore.showPanel(true)
}

function goBack() {
  router.push({ name: 'welcome' })
}
</script>

<template>
  <GameLayout>
    <template #top-info>
      <TopInfoPanel />
    </template>

    <div v-if="isInitializing" class="loading-overlay">
      <n-spin size="large" />
    </div>

    <template #left-panel>
      <!-- Minimal Header (Hunt Mode) -->
      <div v-if="!isAnalysisView" class="diamond-header">
        <div class="header-top">
          <n-button circle secondary @click="goBack">
            <template #icon
              ><n-icon><ArrowBack /></n-icon
            ></template>
          </n-button>
          <div class="title">Diamond Hunter</div>
        </div>

        <div class="status">
          <div v-if="diamondHunterStore.state === 'HUNTING'">Hunting...</div>
          <div v-else-if="diamondHunterStore.state === 'SOLVING'" style="color: #ff5252">
            PUNISH THE BLUNDER!
          </div>
          <div v-else-if="diamondHunterStore.state === 'SAVING'" style="color: #448aff">
            Secure Diamond: Replay from memory!
          </div>
        </div>

        <!-- Session Stats -->
        <div class="stats-row">
          <n-statistic label="Total Diamonds">
            <template #prefix>
              <n-icon color="#9C27B0"><DiamondOutline /></n-icon>
            </template>
            <n-number-animation :from="0" :to="diamondHunterStore.totalDiamonds" />
          </n-statistic>

          <n-statistic label="Total Brilliants">
            <template #prefix>
              <n-icon color="#00C853"><FlashOutline /></n-icon>
            </template>
            <n-number-animation :from="0" :to="diamondHunterStore.totalBrilliants" />
          </n-statistic>
        </div>

        <n-button
          type="primary"
          secondary
          @click="handleRestart"
          style="margin-top: 20px; width: 100%"
        >
          Restart Session
        </n-button>
      </div>

      <DiamondHunterSettingsModal
        :show="isSettingsModalOpen"
        @start="startSession"
        @close="goBack"
      />
    </template>

    <template #center-column>
      <!-- Theory Ended Modal -->
      <n-modal
        :show="diamondHunterStore.showTheoryEndModal"
        @close="goBack"
        :closable="true"
        :preset="'dialog'"
        style="width: 400px; text-align: center"
      >
        <template #header>
          <div style="font-size: 1.2rem; font-weight: bold; color: #ffa000">
            {{ 'Theory Ended' }}
          </div>
        </template>
        <div style="font-size: 3rem; margin: 20px 0">🤷‍♂️</div>
        <div style="font-size: 1.1rem; margin-bottom: 20px">We are out of book moves.</div>

        <n-space justify="center" :size="20">
          <n-button
            type="primary"
            @click="
              diamondHunterStore.closeTheoryModal()
              handleRestart()
            "
            >Restart</n-button
          >
          <n-button
            secondary
            @click="
              diamondHunterStore.closeTheoryModal()
              startAnalysis()
            "
          >
            <template #icon
              ><n-icon><TelescopeOutline /></n-icon
            ></template>
            Analyze
          </n-button>
        </n-space>
      </n-modal>

      <!-- Reward Modal -->
      <n-modal
        :show="diamondHunterStore.state === 'REWARD' && !!diamondHunterStore.message"
        @close="goBack"
        :closable="true"
        :preset="'dialog'"
        style="width: 400px; text-align: center"
      >
        <template #header>
          <div style="font-size: 1.2rem; font-weight: bold; color: #00c853">
            {{ 'Diamond Found!' }}
          </div>
        </template>
        <div style="font-size: 3rem; margin: 20px 0">💎</div>
        <div style="font-size: 1.1rem; margin-bottom: 20px">{{ diamondHunterStore.message }}</div>

        <n-space justify="center" :size="12" vertical style="width: 100%">
          <!-- If we have moves to replay (meaning we just found it initially), offer Secure option -->
          <n-button
            v-if="diamondHunterStore.savingMoves.length > 0"
            type="primary"
            block
            @click="diamondHunterStore.startSaveRun()"
          >
            Secure Diamond (Replay)
          </n-button>

          <n-button
            :type="diamondHunterStore.savingMoves.length > 0 ? 'default' : 'primary'"
            secondary
            block
            @click="
              diamondHunterStore.stopHunt()
              handleRestart()
            "
          >
            Next Hunt
          </n-button>

          <n-button secondary block @click="startAnalysis">
            <template #icon
              ><n-icon><TelescopeOutline /></n-icon
            ></template>
            Analyze
          </n-button>
        </n-space>
      </n-modal>

      <!-- Fail Modal -->
      <n-modal
        :show="diamondHunterStore.state === 'FAILED' && !!diamondHunterStore.message"
        @close="goBack"
        :closable="true"
        :preset="'dialog'"
        style="width: 400px; text-align: center"
      >
        <template #header>
          <div style="font-size: 1.2rem; font-weight: bold; color: #d32f2f">
            {{ 'Diamond Lost!' }}
          </div>
        </template>
        <div style="font-size: 3rem; margin: 20px 0">❌</div>
        <div style="font-size: 1.1rem; margin-bottom: 20px">{{ diamondHunterStore.message }}</div>

        <n-space justify="center" :size="20">
          <n-button
            type="primary"
            @click="
              diamondHunterStore.stopHunt()
              handleRestart()
            "
            >Try Again</n-button
          >
          <n-button secondary @click="startAnalysis">
            <template #icon
              ><n-icon><TelescopeOutline /></n-icon
            ></template>
            Analyze
          </n-button>
        </n-space>
      </n-modal>
    </template>

    <template #right-panel>
      <!-- Analysis Mode in Right Panel for better portrait layout -->
      <div v-if="isAnalysisView" class="analysis-container">
        <n-button
          secondary
          type="primary"
          @click="handleRestart"
          style="margin-bottom: 10px; width: 100%"
        >
          <template #icon
            ><n-icon><ArrowBack /></n-icon
          ></template>
          Back to Hunt
        </n-button>
        <AnalysisPanel style="margin-bottom: 20px" />
      </div>

      <GravityBook />
    </template>
  </GameLayout>
</template>

<style scoped lang="scss">
.diamond-header {
  background: var(--color-bg-secondary);
  padding: 20px;
  border-radius: 12px;
  color: var(--color-text-primary);
}

.header-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.title {
  font-size: 1.2rem;
  font-weight: bold;
  color: #00c853;
}

.status {
  font-size: 1rem;
  font-weight: 500;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  text-align: center;
  margin-bottom: 15px;
}

.stats-row {
  display: flex;
  justify-content: space-around;
  background: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 8px;
}

.right-panel-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
}
</style>
