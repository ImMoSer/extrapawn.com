<script setup lang="ts">
import {
  CheckmarkDoneOutline,
  CloseOutline,
  PlayOutline,
  PulseOutline,
  RefreshOutline,
  SearchOutline,
  TrendingUpOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NGrid,
  NGridItem,
  NIcon,
  NModal,
  NProgress,
  NSpace,
  NStatistic,
  NTag,
  NText,
  NH1,
  NCard,
} from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpeningSparringStore } from '../index'

const openingStore = useOpeningSparringStore()
const { t } = useI18n()

defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'playout', 'analyze', 'restart'])

const evalText = computed(() => {
  if (!openingStore.finalEval) return ''
  const val = openingStore.finalEval.value
  if (openingStore.finalEval.type === 'mate') {
    return `Mate in ${Math.abs(val)}`
  }
  const score = (val / 100).toFixed(2)
  return score.startsWith('-') ? score : `+${score}`
})

const evalStatus = computed(() => {
  if (!openingStore.finalEval) return 'default'
  const val = openingStore.finalEval.value
  const isWhite = openingStore.playerColor === 'white'

  if (val === 0) return 'default'

  // Positive score is good for white
  const isGood = isWhite ? val > 0 : val < 0
  const isVeryGood = isWhite ? val > 150 : val < -150
  const isBad = isWhite ? val < -100 : val > 100

  if (isVeryGood) return 'success'
  if (isGood) return 'info'
  if (isBad) return 'error'
  return 'warning'
})

const progressPercent = computed(() => {
  return Math.min(100, (openingStore.finalEvalDepth / 20) * 100)
})
</script>

<template>
  <n-modal :show="show" :style="{ width: 'min(550px, calc(100vw - 32px))' }" :mask-closable="false">
    <n-card
      class="glass selection-card summary-card"
      :bordered="false"
      content-style="padding: 32px"
    >
      <n-space vertical :size="24" style="width: 100%">
        <div class="header">
          <n-h1 class="title" style="color: var(--color-success, #63e2b7); margin: 0">
            {{ t('features.diamondHunter.header.bookEnded') }}
          </n-h1>
          <n-text depth="3" class="subtitle"> Session Summary </n-text>
        </div>

        <div class="selection-sections">
          <!-- Stats Grid -->
          <div class="section">
            <n-grid :cols="2" :x-gap="12">
              <n-grid-item>
                <div class="stat-box">
                  <n-statistic
                    :label="t('features.diamondHunter.header.popularity')"
                    :value="openingStore.averagePopularity"
                  >
                    <template #prefix
                      ><n-icon class="stat-icon"><PulseOutline /></n-icon
                    ></template>
                    <template #suffix>%</template>
                  </n-statistic>
                </div>
              </n-grid-item>
              <n-grid-item>
                <div class="stat-box">
                  <n-statistic
                    :label="t('features.diamondHunter.header.winRate')"
                    :value="openingStore.averageWinRate"
                  >
                    <template #prefix
                      ><n-icon class="stat-icon"><TrendingUpOutline /></n-icon
                    ></template>
                    <template #suffix>%</template>
                  </n-statistic>
                </div>
              </n-grid-item>
            </n-grid>
          </div>

          <!-- Engine Evaluation Section -->
          <div class="section eval-section" :class="{ loading: openingStore.isFinalEvaluating }">
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
              "
            >
              <n-text class="section-label" style="margin: 0"
                >{{ t('features.analysis.engine') }} Assessment</n-text
              >
              <n-tag
                v-if="!openingStore.isFinalEvaluating"
                :type="evalStatus"
                round
                size="small"
                strong
              >
                {{ evalText }}
              </n-tag>
            </div>

            <div v-if="openingStore.isFinalEvaluating" class="eval-loading">
              <n-progress
                type="line"
                :percentage="progressPercent"
                :show-indicator="false"
                processing
                status="success"
                :height="6"
                border-radius="4px"
              />
              <n-text
                depth="3"
                class="depth-text"
                style="font-size: 0.8rem; margin-top: 6px; display: block"
              >
                Analyzing depth: {{ openingStore.finalEvalDepth }} / 20
              </n-text>
            </div>

            <div v-else class="eval-result" :class="evalStatus">
              <n-space align="center" :wrap="false">
                <n-icon size="28" :color="`var(--color-${evalStatus})`">
                  <CheckmarkDoneOutline v-if="evalStatus === 'success' || evalStatus === 'info'" />
                  <CloseOutline v-else-if="evalStatus === 'error'" />
                  <SearchOutline v-else />
                </n-icon>
                <n-text v-if="evalStatus === 'success'" strong
                  >Exited opening with a great advantage!</n-text
                >
                <n-text v-else-if="evalStatus === 'info'" strong
                  >Solid position out of the opening.</n-text
                >
                <n-text v-else-if="evalStatus === 'error'" strong
                  >Slightly worse position. Don't worry!</n-text
                >
                <n-text v-else strong>Equality has been maintained.</n-text>
              </n-space>
            </div>
          </div>

          <!-- Engine Selection for Playout -->
          <div class="section">
            <n-text class="section-label">{{
              t('features.diamondHunter.settings.engineHint', 'Playout Engine')
            }}</n-text>
            <div class="engine-selector-wrapper">
              <slot name="engine-selector" />
            </div>
          </div>
        </div>

        <div class="actions">
          <n-space vertical :size="12">
            <n-grid :cols="2" :x-gap="12">
              <n-grid-item>
                <n-button
                  block
                  secondary
                  type="success"
                  size="large"
                  :disabled="openingStore.isFinalEvaluating"
                  @click="emit('playout')"
                  class="action-btn"
                >
                  <template #icon
                    ><n-icon><PlayOutline /></n-icon
                  ></template>
                  Playout
                </n-button>
              </n-grid-item>
              <n-grid-item>
                <n-button
                  block
                  secondary
                  type="info"
                  size="large"
                  :disabled="openingStore.isFinalEvaluating"
                  @click="emit('analyze')"
                  class="action-btn"
                >
                  <template #icon
                    ><n-icon><SearchOutline /></n-icon
                  ></template>
                  Analyze
                </n-button>
              </n-grid-item>
            </n-grid>

            <n-button
              block
              quaternary
              size="large"
              @click="emit('restart')"
              style="margin-top: 8px"
            >
              <template #icon
                ><n-icon><RefreshOutline /></n-icon
              ></template>
              {{ t('features.diamondHunter.header.newSession') }}
            </n-button>
          </n-space>
        </div>
      </n-space>
    </n-card>
  </n-modal>
</template>

<style scoped>
.selection-card {
  width: 100%;
  border-radius: 20px;
  background: var(--bg-0, rgba(16, 16, 20, 0.7));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.header {
  text-align: center;
  margin-bottom: 4px;
}

.title {
  font-size: 2rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.subtitle {
  font-size: 1rem;
}

.selection-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.section-label {
  font-weight: 600;
  color: var(--text-secondary, #999);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

/* Stats Styling */
.stat-box {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}
:deep(.n-statistic .n-statistic-value__prefix) {
  margin-right: 8px;
}

/* Eval Section Styling */
.eval-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
}
.eval-result {
  margin-top: 8px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.actions {
  width: 100%;
  margin-top: 8px;
}

.action-btn {
  font-weight: 700;
  height: 48px;
  border-radius: 12px;
  font-size: 1.05rem;
}

@media (max-width: 600px) {
  :deep(.n-card__content) {
    padding: 24px 16px !important;
  }
  .title {
    font-size: 1.5rem;
  }
}
</style>
