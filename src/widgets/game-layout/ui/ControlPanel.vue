<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { useAnalysisStore } from '@/features/analysis'
import { ENGINE_NAMES, useEngineSelectionStore } from '@/features/engine'
import { SmartHintButton } from '@/features/smart-hint'
import type { EngineId } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  AnalyticsOutline as AnalysisIcon,
  HardwareChipOutline as BotIcon,
  PlayCircleOutline as NewIcon,
  FlagOutline as ResignIcon,
  RefreshOutline as RestartIcon,
  LinkOutline as ShareIcon,
} from '@vicons/ionicons5'
import { NButton, NDropdown, NIcon, NSpace, NSwitch, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useControlsStore } from '../model/controls.store'

const controlsStore = useControlsStore()
const analysisStore = useAnalysisStore()
const engineStore = useEngineSelectionStore()
const authStore = useAuthStore()
const uiStore = useUiStore()
const { t } = useI18n()

const showEngineDropdown = ref(false)

const engineOptions = computed(() => {
  return engineStore.availableEngines.map((e) => ({
    label: ENGINE_NAMES[e as EngineId] || e,
    key: e,
  }))
})

const handleBotClick = async () => {
  if (authStore.isAuthenticated) {
    showEngineDropdown.value = !showEngineDropdown.value
  } else {
    const userConfirmedLogin = await uiStore.showConfirmation(
      t('features.auth.requiredForAction'),
      t('features.userCabinet.loginPrompt'),
      {
        confirmText: t('nav.loginWithLichess'),
        showCancel: true,
      },
    )
    if (userConfirmedLogin === 'confirm') {
      authStore.login()
    }
  }
}

const selectEngine = (engineKey: string) => {
  engineStore.setEngine(engineKey as EngineId)
  showEngineDropdown.value = false
}

const toggleAnalysis = () => {
  if (analysisStore.isAnalysisActive) {
    analysisStore.hidePanel()
  } else {
    analysisStore.showPanel(true)
  }
}
</script>

<template>
  <div class="control-panel-container">
    <n-space justify="center" align="center" :size="[8, 0]">
      <!-- New Game -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button
            circle
            quaternary
            size="large"
            :disabled="!controlsStore.canRequestNew"
            @click="controlsStore.performRequestNew"
          >
            <template #icon>
              <n-icon class="icon-new" :class="{ 'pulse-active': controlsStore.canRequestNew }">
                <NewIcon />
              </n-icon>
            </template>
          </n-button>
        </template>
        {{ $t('features.controls.new') }}
      </n-tooltip>

      <!-- Restart -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button
            circle
            quaternary
            size="large"
            :disabled="!controlsStore.canRestart"
            @click="controlsStore.performRestart"
          >
            <template #icon>
              <n-icon class="icon-restart"><RestartIcon /></n-icon>
            </template>
          </n-button>
        </template>
        {{ $t('features.controls.restart') }}
      </n-tooltip>

      <!-- Bot / Sparring Partner Selector -->
      <n-dropdown
        v-if="controlsStore.showEngineSelection"
        placement="top"
        trigger="manual"
        :show="showEngineDropdown"
        :options="engineOptions"
        :value="engineStore.selectedEngine"
        class="engine-dropdown-glass"
        @select="selectEngine"
        @clickoutside="showEngineDropdown = false"
      >
        <span style="display: inline-flex">
          <n-tooltip trigger="hover" placement="bottom">
            <template #trigger>
              <n-button
                circle
                size="large"
                :quaternary="!showEngineDropdown"
                :tertiary="showEngineDropdown"
                :type="showEngineDropdown ? 'primary' : 'default'"
                @click="handleBotClick"
              >
                <template #icon>
                  <n-icon
                    :class="{ 'icon-bot-active': showEngineDropdown || engineStore.selectedEngine }"
                  >
                    <BotIcon />
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ $t('features.engine.select', 'Sparring Partner') }}
          </n-tooltip>
        </span>
      </n-dropdown>

      <!-- Resign OR Analysis Toggle -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button
            v-if="controlsStore.canResign"
            circle
            quaternary
            size="large"
            @click="controlsStore.performResign"
          >
            <template #icon>
              <n-icon><ResignIcon /></n-icon>
            </template>
          </n-button>

          <n-switch
            v-else
            :value="analysisStore.isAnalysisActive"
            size="medium"
            @update:value="toggleAnalysis"
          >
            <template #checked-icon>
              <n-icon class="icon-analysis-active"><AnalysisIcon /></n-icon>
            </template>
            <template #unchecked-icon>
              <n-icon><AnalysisIcon /></n-icon>
            </template>
          </n-switch>
        </template>
        {{
          controlsStore.canResign ? $t('features.controls.resign') : $t('features.analysis.engine')
        }}
      </n-tooltip>

      <!-- Share -->
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-button
            circle
            quaternary
            size="large"
            :disabled="!controlsStore.canShare"
            @click="controlsStore.onShare"
          >
            <template #icon>
              <n-icon class="icon-share"><ShareIcon /></n-icon>
            </template>
          </n-button>
        </template>
        {{ $t('features.controls.share') }}
      </n-tooltip>

      <!-- Hint -->
      <SmartHintButton v-if="controlsStore.canRequestHint" />
    </n-space>
  </div>
</template>

<style scoped>
.control-panel-container {
  padding: 2px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  backdrop-filter: var(--glass-blur);
  width: fit-content;
  margin: 5px auto 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  min-height: 40px;
  max-width: 95vw;
}

.icon-restart {
  color: var(--neon-orange);
}

.icon-share {
  color: var(--neon-purple);
}

.icon-analysis-active {
  color: var(--neon-cyan);
  filter: drop-shadow(0 0 4px var(--neon-cyan));
}

.icon-bot-active {
  color: var(--color-success, #00ff55);
  filter: drop-shadow(0 0 6px rgba(0, 255, 85, 0.6));
}

:deep(.n-switch.n-switch--active) {
  --n-button-box-shadow: 0 0 8px var(--neon-cyan);
}

.pulse-active {
  animation: rainbow-pulse 4s infinite ease-in-out;
}

@keyframes rainbow-pulse {
  0% {
    color: var(--neon-pink);
    transform: scale(1);
    filter: drop-shadow(0 0 2px var(--neon-pink));
  }
  33% {
    color: var(--neon-purple);
    filter: drop-shadow(0 0 4px var(--neon-purple));
  }
  50% {
    transform: scale(1.15);
  }
  66% {
    color: var(--neon-orange);
    filter: drop-shadow(0 0 4px var(--neon-orange));
  }
  100% {
    color: var(--neon-pink);
    transform: scale(1);
    filter: drop-shadow(0 0 2px var(--neon-pink));
  }
}

:deep(.n-button.n-button--disabled) .n-icon {
  color: var(--color-text-muted) !important;
  animation: none !important;
  filter: none !important;
  opacity: 0.5;
}

@media (orientation: portrait) {
  .control-panel-container {
    padding: 0 4px;
    width: 100%;
    border-radius: 8px;
    min-height: 44px;
    justify-content: space-around;
  }

  :deep(.n-button) {
    --n-height: 44px !important;
    --n-width: 44px !important;
  }
}
</style>

<style>
/* Unscoped style required to target the naive UI teleported body element */
.engine-dropdown-glass {
  background: rgba(16, 16, 20, 0.7) !important;
  backdrop-filter: blur(16px) !important;
  border-radius: 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}

.engine-dropdown-glass .n-dropdown-option-body {
  padding: 10px 16px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.engine-dropdown-glass .n-dropdown-option-body:hover {
  background: rgba(255, 255, 255, 0.05);
}
</style>
