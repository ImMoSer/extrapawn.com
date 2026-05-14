<script setup lang="ts">
import { theoryGraphService } from '@/entities/opening'
import { CloseOutline } from '@vicons/ionicons5'
import type { SelectOption } from 'naive-ui'
import {
  NButton,
  NCard,
  NH1,
  NIcon,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSpace,
  NTag,
  NText,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpeningSparringStore } from '../index'

const emit = defineEmits(['start', 'close'])
const { t } = useI18n()
const openingStore = useOpeningSparringStore()

const selectedColor = ref<'white' | 'black'>('white')
const selectedOpening = ref<string | null>('start')
const majorOpenings = ref<{ name: string; eco?: string; moves: string[]; slug: string }[]>([])

const openingOptions = computed<SelectOption[]>(() => {
  const options: SelectOption[] = [
    { label: t('features.diamondHunter.settings.startPosition'), value: 'start' },
  ]
  majorOpenings.value.forEach((op) => {
    options.push({
      label: `${op.eco ? `[${op.eco}] ` : ''}${op.name}`,
      value: op.slug,
    })
  })
  return options
})

onMounted(async () => {
  await theoryGraphService.loadBook()
  majorOpenings.value = theoryGraphService.getMajorOpenings()
  selectedColor.value = openingStore.playerColor
})

function startSession() {
  const op = majorOpenings.value.find((o) => o.slug === selectedOpening.value)
  const moves = op ? op.moves : []
  const slug = selectedOpening.value === 'start' ? undefined : selectedOpening.value
  emit('start', selectedColor.value, moves, slug || undefined)
}
</script>

<template>
  <n-modal :show="true" @close="$emit('close')">
    <n-card class="glass selection-card" :bordered="false" content-style="padding: 20px">
      <!-- Close Button Top Right -->
      <n-button quaternary circle class="close-btn" @click="$emit('close')">
        <template #icon
          ><n-icon><CloseOutline /></n-icon
        ></template>
      </n-button>

      <n-space vertical :size="24" style="width: 100%">
        <div class="header">
          <n-h1 class="title">
            {{ t('nav.openingSparring') }}
          </n-h1>
          <n-text depth="3" class="subtitle">
            {{ t('features.diamondHunter.settings.subtitle') }}
          </n-text>
        </div>

        <div class="selection-sections">
          <!-- 1. Color Selection -->
          <div class="section">
            <n-text class="section-label">{{ t('features.diamondHunter.settings.color') }}</n-text>
            <n-radio-group v-model:value="selectedColor" size="large" expand>
              <n-radio-button value="white" style="text-align: center">
                {{ t('features.diamondHunter.settings.white') }}
              </n-radio-button>
              <n-radio-button value="black" style="text-align: center">
                {{ t('features.diamondHunter.settings.black') }}
              </n-radio-button>
            </n-radio-group>
          </div>

          <!-- 2. Opening Selection -->
          <div class="section">
            <n-text class="section-label">{{
              t('features.diamondHunter.settings.selectOpening')
            }}</n-text>
            <n-select v-model:value="selectedOpening" :options="openingOptions" size="large" />
          </div>

          <!-- 3. Opponent Source -->
          <div class="section">
            <n-text class="section-label">{{
              t('features.diamondHunter.settings.opponentSource', 'Opponent Base')
            }}</n-text>
            <n-radio-group v-model:value="openingStore.opponentSource" size="large" expand>
              <n-radio-button value="master" style="text-align: center">
                {{ t('features.diamondHunter.settings.masters') }} (2200+)
              </n-radio-button>
              <n-radio-button value="lichess" style="text-align: center">
                {{ t('features.diamondHunter.settings.lichessPlayers') }}
              </n-radio-button>
            </n-radio-group>

            <n-text depth="3" class="hint-text">
              {{
                openingStore.opponentSource === 'master'
                  ? t(
                      'features.diamondHunter.settings.masterHint',
                      'Bot plays optimal moves from Master games.',
                    )
                  : t(
                      'features.diamondHunter.settings.lichessHint',
                      'Bot simulates human play styles based on selected ratings.',
                    )
              }}
            </n-text>
          </div>

          <!-- 3.5 Opponent Character (Only shown if Master Database is selected) -->
          <div v-if="openingStore.opponentSource === 'master'" class="section fade-in">
            <n-text class="section-label">{{
              t('features.diamondHunter.settings.selectCharacter', 'Master Character Style')
            }}</n-text>
            <n-radio-group v-model:value="openingStore.opponentCharacter" size="large" expand>
              <n-radio-button value="none" style="text-align: center">{{
                t('features.diamondHunter.settings.random', 'Random')
              }}</n-radio-button>
              <n-radio-button value="grossmaster" style="text-align: center; color: #4caf50">
                {{ t('features.study.repertoireGenerator.styles.grossmaster.name') }}
              </n-radio-button>
              <n-radio-button value="hustler" style="text-align: center; color: #2196f3">
                {{ t('features.study.repertoireGenerator.styles.hustler.name') }}
              </n-radio-button>
              <n-radio-button value="schuler" style="text-align: center; color: #f44336">
                {{ t('features.study.repertoireGenerator.styles.schuler.name') }}
              </n-radio-button>
            </n-radio-group>

            <n-text depth="3" class="hint-text">
              <template v-if="openingStore.opponentCharacter === 'none'">
                {{
                  t(
                    'features.diamondHunter.settings.characterDefaultHint',
                    'Bot plays random top moves based on variability.',
                  )
                }}
              </template>
              <template v-else>
                {{
                  t(
                    `features.study.repertoireGenerator.styles.${openingStore.opponentCharacter}.description`,
                  )
                }}
              </template>
            </n-text>
          </div>

          <!-- 4. Opponent Rating (Only shown if Lichess is selected) -->
          <div v-if="openingStore.opponentSource === 'lichess'" class="section fade-in">
            <n-text class="section-label">{{
              t('features.diamondHunter.settings.selectRatings', 'Lichess Rating Level')
            }}</n-text>
            <n-radio-group v-model:value="openingStore.opponentRatingRange" size="large" expand>
              <n-radio-button value="1000-1499" style="text-align: center"
                >1000-1499</n-radio-button
              >
              <n-radio-button value="1500-1799" style="text-align: center"
                >1500-1799</n-radio-button
              >
              <n-radio-button value="1800-2200" style="text-align: center"
                >1800-2200</n-radio-button
              >
            </n-radio-group>
          </div>

          <!-- 5. Variability -->
          <div
            class="section fade-in"
            v-if="
              openingStore.opponentSource === 'lichess' || openingStore.opponentCharacter === 'none'
            "
          >
            <n-space align="center" justify="space-between">
              <n-text class="section-label">{{
                t('features.diamondHunter.settings.variability', {
                  value: openingStore.variability,
                })
              }}</n-text>
              <n-tag :bordered="false" type="info" size="small"
                >{{ openingStore.variability }} / 7</n-tag
              >
            </n-space>
            <n-slider v-model:value="openingStore.variability" :min="3" :max="7" :step="1" />
            <n-text depth="3" class="hint-text">
              {{ t('features.diamondHunter.settings.variabilityHint') }}
            </n-text>
          </div>
        </div>

        <div class="actions">
          <n-button type="primary" size="large" block class="start-btn" @click="startSession">
            {{ t('features.diamondHunter.settings.startSession') }}
          </n-button>
        </div>
      </n-space>
    </n-card>
  </n-modal>
</template>

<style scoped>
.selection-card {
  width: min(650px, calc(100vw - 12px));
  border-radius: 20px;
  background: var(--bg-0, rgba(16, 16, 20, 0.7));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}

.header {
  text-align: center;
  margin-bottom: 5px;
}

.title {
  color: var(--color-primary);
  margin: 0;
  font-size: 2.1rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.subtitle {
  font-size: 1.1rem;
}

.selection-sections {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 5px; /* For scrollbar breathing room */
}

/* Custom Webkit Scrollbar for section scrolling */
.selection-sections::-webkit-scrollbar {
  width: 6px;
}
.selection-sections::-webkit-scrollbar-track {
  background: transparent;
}
.selection-sections::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.section-label {
  margin: 0;
  font-weight: 600;
  color: var(--text-secondary, #999);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.hint-text {
  font-size: 0.8rem;
  margin-top: -6px;
  padding-left: 4px;
}

.actions {
  width: 100%;
  margin-top: 16px;
}

.start-btn {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  height: 52px;
  border-radius: 12px;
  font-size: 1.1rem;
}

@media (max-width: 600px) {
  :deep(.n-card__content) {
    padding: 20px !important;
  }
  .title {
    font-size: 1.5rem;
  }
  .selection-sections {
    gap: 20px;
  }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
