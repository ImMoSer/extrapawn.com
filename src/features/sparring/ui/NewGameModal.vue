<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NModal,
  NRadioGroup,
  NRadioButton,
  NSelect,
  NInput,
  NText,
  NButton,
  NIcon
} from 'naive-ui'
import { PlayCircleOutline } from '@vicons/ionicons5'
import { useSparringStore } from '../model/sparring.store'
import type { OpeningPreset } from '../model/types'

const sparringStore = useSparringStore()
const router = useRouter()

const selectedColor = ref<'white' | 'black'>('white')
const selectedPositionType = ref<'standard' | 'preset' | 'custom'>('standard')

const OPENING_PRESETS: OpeningPreset[] = [
  {
    id: 'sicilian',
    name: 'Sizilianische Verteidigung (1.e4 c5)',
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
    eco: 'B20'
  },
  {
    id: 'ruy_lopez',
    name: 'Spanische Partie / Ruy Lopez (1.e4 e5 2.Nf3 Nc6 3.Bb5)',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    eco: 'C60'
  },
  {
    id: 'french',
    name: 'Französische Verteidigung (1.e4 e6)',
    fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    eco: 'C00'
  },
  {
    id: 'caro_kann',
    name: 'Caro-Kann Verteidigung (1.e4 c6)',
    fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    eco: 'B10'
  },
  {
    id: 'queens_gambit',
    name: 'Damen-Gambit (1.d4 d5 2.c4)',
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2',
    eco: 'D06'
  },
  {
    id: 'italian',
    name: 'Italienische Partie (1.e4 e5 2.Nf3 Nc6 3.Bc4)',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    eco: 'C50'
  }
]

const selectedPresetId = ref<string>('sicilian')
const customFen = ref<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')

const presetOptions = OPENING_PRESETS.map((p) => ({
  label: `${p.name} (${p.eco})`,
  value: p.id
}))

function handleStartGame() {
  let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  if (selectedPositionType.value === 'preset') {
    const preset = OPENING_PRESETS.find((p) => p.id === selectedPresetId.value)
    if (preset) fen = preset.fen
  } else if (selectedPositionType.value === 'custom') {
    fen = customFen.value.trim() || fen
  }

  sparringStore.startNewGame(
    {
      color: selectedColor.value,
      fen
    },
    router
  )
}
</script>

<template>
  <n-modal
    :show="sparringStore.isNewGameModalOpen"
    :mask-closable="false"
    preset="card"
    class="new-game-modal glass-modal"
    style="width: 520px; max-width: 90vw;"
    :title="$t('features.sparring.newGameModal.title')"
    @close="sparringStore.closeNewGameModal"
  >
    <div class="modal-body">
      <!-- Section 1: Color Selection -->
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

      <!-- Section 2: Position Selection -->
      <div class="section-block">
        <n-text class="section-title">{{ $t('features.sparring.newGameModal.startPosition') }}</n-text>
        <n-radio-group v-model:value="selectedPositionType" class="position-type-group">
          <n-radio-button value="standard">{{ $t('features.sparring.newGameModal.typeStandard') }}</n-radio-button>
          <n-radio-button value="preset">{{ $t('features.sparring.newGameModal.typePreset') }}</n-radio-button>
          <n-radio-button value="custom">{{ $t('features.sparring.newGameModal.typeCustom') }}</n-radio-button>
        </n-radio-group>

        <!-- Preset Selector -->
        <div v-if="selectedPositionType === 'preset'" class="preset-selector-wrapper">
          <n-select
            v-model:value="selectedPresetId"
            :options="presetOptions"
            :placeholder="$t('features.sparring.newGameModal.selectPresetPlaceholder')"
            size="medium"
          />
        </div>

        <!-- Custom FEN Input -->
        <div v-if="selectedPositionType === 'custom'" class="custom-fen-wrapper">
          <n-input
            v-model:value="customFen"
            :placeholder="$t('features.sparring.newGameModal.customFenPlaceholder')"
            size="medium"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-button
          v-if="sparringStore.gameId"
          secondary
          size="medium"
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

.position-type-group {
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.preset-selector-wrapper,
.custom-fen-wrapper {
  margin-top: 10px;
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
