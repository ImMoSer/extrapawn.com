<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  NModal,
  NText,
  NButton,
  NIcon
} from 'naive-ui'
import { ExitOutline, PlayCircleOutline } from '@vicons/ionicons5'
import { useSparringStore } from '../model/sparring.store'
import { ENGINE_NAMES, AVAILABLE_ENGINES } from '@/features/engine'
import { usePreferencesStore } from '@/features/settings'
import type { EngineId } from '@/shared/types/api.types'

const sparringStore = useSparringStore()
const preferencesStore = usePreferencesStore()
const router = useRouter()

const selectedColor = ref<'white' | 'black'>('white')
const selectedEngine = ref<EngineId>(preferencesStore.selectedBotEngine as EngineId)

const availableEngines = AVAILABLE_ENGINES
const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

watch(() => sparringStore.isNewGameModalOpen, (isOpen) => {
  if (isOpen) {
    selectedEngine.value = preferencesStore.selectedBotEngine as EngineId
  }
})

function handleStartGame() {
  preferencesStore.setBotEngine(selectedEngine.value)
  sparringStore.startNewGame(
    {
      color: selectedColor.value,
      fen: DEFAULT_FEN
    },
    router
  )
}

function handleExit() {
  sparringStore.closeNewGameModal()
  router.push('/')
}
</script>

<template>
  <n-modal
    :show="sparringStore.isNewGameModalOpen"
    :mask-closable="false"
    preset="card"
    class="new-game-modal glass-modal"
    style="width: 520px; max-width: 92vw;"
    :title="$t('features.sparring.newGameModal.title')"
    @close="sparringStore.closeNewGameModal"
  >
    <div class="modal-body">
      <!-- Section: Color Selection -->
      <div class="section-block">
        <n-text class="section-title">{{ $t('features.sparring.newGameModal.chooseColor') }}</n-text>
        <div class="color-options">
          <button
            type="button"
            :class="['color-card', 'white-card', { active: selectedColor === 'white' }]"
            @click="selectedColor = 'white'"
          >
            <div class="piece-icon white-piece">♔</div>
            <div class="card-label">{{ $t('features.sparring.newGameModal.white') }}</div>
            <div class="card-sub">{{ $t('features.sparring.newGameModal.whiteSub') }}</div>
          </button>

          <button
            type="button"
            :class="['color-card', 'black-card', { active: selectedColor === 'black' }]"
            @click="selectedColor = 'black'"
          >
            <div class="piece-icon black-piece">♚</div>
            <div class="card-label">{{ $t('features.sparring.newGameModal.black') }}</div>
            <div class="card-sub">{{ $t('features.sparring.newGameModal.blackSub') }}</div>
          </button>
        </div>
      </div>

      <!-- Section: Opponent Strength (Engine Selection) -->
      <div class="section-block">
        <n-text class="section-title">{{ $t('features.sparring.newGameModal.chooseEngine') }}</n-text>
        <div class="engine-options-grid">
          <button
            v-for="engineId in availableEngines"
            :key="engineId"
            type="button"
            :class="['engine-card', { active: selectedEngine === engineId }]"
            @click="selectedEngine = engineId"
          >
            <div class="engine-name">{{ ENGINE_NAMES[engineId] }}</div>
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button
          secondary
          size="large"
          class="exit-btn"
          @click="handleExit"
        >
          <template #icon>
            <n-icon><ExitOutline /></n-icon>
          </template>
          {{ $t('features.sparring.newGameModal.exit') }}
        </n-button>

        <n-button
          v-if="sparringStore.gameId"
          secondary
          size="large"
          @click="sparringStore.closeNewGameModal"
        >
          {{ $t('shared.buttons.cancel') }}
        </n-button>

        <n-button
          type="primary"
          size="large"
          class="start-game-btn pulse-glow"
          @click="handleStartGame"
        >
          <template #icon>
            <n-icon><PlayCircleOutline /></n-icon>
          </template>
          {{ $t('features.sparring.newGameModal.startGame') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped lang="scss">
.glass-modal {
  background: var(--glass-bg, rgba(15, 18, 30, 0.95)) !important;
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.12)) !important;
  backdrop-filter: blur(16px);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 0;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted, #a1a1aa);
}

.color-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.color-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  &.active {
    border-color: #9d4edd;
    background: rgba(157, 78, 221, 0.12);
    box-shadow: 0 0 16px rgba(157, 78, 221, 0.25);
  }
}

.piece-icon {
  font-size: 2.2rem;
  line-height: 1;
  margin-bottom: 6px;
}

.white-piece {
  color: #fff;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.black-piece {
  color: #a1a1aa;
}

.card-label {
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
}

.card-sub {
  font-size: 0.78rem;
  color: var(--color-text-muted, #71717a);
  margin-top: 2px;
}

.engine-options-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.engine-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--neon-cyan, #00e5ff);
    background: rgba(0, 229, 255, 0.12);
    box-shadow: 0 0 14px rgba(0, 229, 255, 0.3);
  }
}

.engine-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: #fff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.start-game-btn {
  font-weight: 700;
  background: linear-gradient(135deg, #7b2cbf 0%, #9d4edd 100%) !important;
  border: none !important;
}

.pulse-glow {
  box-shadow: 0 0 14px rgba(157, 78, 221, 0.4);
}
</style>
