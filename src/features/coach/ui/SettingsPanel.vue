<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover, NIcon, NSlider } from 'naive-ui'
import { SettingsOutline } from '@vicons/ionicons5'
import { useCoachStore, type CoachVisualLayers } from '../model/coach.store'

const { t } = useI18n()

const emit = defineEmits<{
  change: []
}>()

const coachStore = useCoachStore()
const showPopover = ref(false)

function close() {
  showPopover.value = false
  emit('change')
}

function toggleLayer(layer: keyof CoachVisualLayers) {
  coachStore.toggleVisualLayer(layer)
}
</script>

<template>
  <n-popover
    v-model:show="showPopover"
    trigger="click"
    placement="bottom-end"
    raw
    :show-arrow="false"
  >
    <template #trigger>
      <button
        :title="t('features.coach.settings.buttonTitle')"
        :aria-label="t('features.coach.settings.buttonAriaLabel')"
        class="icon-btn p-1.5 rounded-md border text-xs cursor-pointer flex items-center justify-center transition-colors"
        :class="showPopover ? 'bg-border-hover text-text-primary border-neon-cyan' : 'bg-elevated text-text-secondary border-border hover:border-border-hover hover:text-text-primary'"
      >
        <NIcon size="14">
          <SettingsOutline />
        </NIcon>
      </button>
    </template>

    <div
      class="w-[310px] p-3.5 bg-surface border border-border-hover rounded-lg shadow-2xl z-[9999] text-[11px] text-text-primary max-h-[85vh] overflow-y-auto thin-scroll"
    >
      <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-2">
        {{ t('features.coach.settings.title') }}
      </div>

      <!-- Server Mode Badge -->
      <div class="mb-3 p-2 rounded bg-success/10 border border-success/20 text-[10px] text-success leading-tight flex items-center justify-between">
        <span>⚡ {{ t('features.coach.settings.serverEngineActive') }}</span>
        <span class="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/20">Docker</span>
      </div>

      <!-- Coach Oversight & Takeback Section -->
      <div class="mb-3 pt-2 border-t border-border">
        <div class="text-[10px] uppercase font-bold text-text-primary mb-2 tracking-wide flex items-center gap-1.5">
          <span>🧠</span>
          <span>{{ t('features.coach.settings.assistantSection') }}</span>
        </div>

        <div class="flex flex-col gap-2">
          <!-- Coach Spy Toggle -->
          <div
            @click="coachStore.toggleCoachSpy()"
            class="p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated cursor-pointer flex items-center justify-between transition-all select-none"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-text-primary text-[11px]">🕵️ {{ t('features.coach.settings.coachSpyTitle') }}</span>
              <span class="text-[9px] text-text-secondary">{{ t('features.coach.settings.coachSpyDesc') }}</span>
            </div>
            <div
              class="w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0"
              :class="coachStore.coachSpy ? 'bg-neon-cyan' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-void shadow-md transform transition-transform duration-200 ease-in-out"
                :class="coachStore.coachSpy ? 'translate-x-4' : 'translate-x-0'"
              />
            </div>
          </div>

          <!-- Auto Takeback Toggle (Only if Coach Spy is on) -->
          <div
            v-if="coachStore.coachSpy"
            @click="coachStore.toggleAutoTakeback()"
            class="p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated cursor-pointer flex items-center justify-between transition-all select-none"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-text-primary text-[11px]">↩️ {{ t('features.coach.settings.autoTakebackTitle') }}</span>
              <span class="text-[9px] text-text-secondary">
                {{ coachStore.autoTakeback ? t('features.coach.settings.autoTakebackDesc') : t('features.coach.settings.manualTakebackDesc') }}
              </span>
            </div>
            <div
              class="w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0"
              :class="coachStore.autoTakeback ? 'bg-neon-cyan' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-void shadow-md transform transition-transform duration-200 ease-in-out"
                :class="coachStore.autoTakeback ? 'translate-x-4' : 'translate-x-0'"
              />
            </div>
          </div>

          <!-- Auto Takeback Delay Slider (if Auto Takeback is enabled) -->
          <div
            v-if="coachStore.coachSpy && coachStore.autoTakeback"
            class="p-2 rounded-md border border-border bg-elevated/30 flex flex-col gap-1.5"
          >
            <div class="flex items-center justify-between text-[11px]">
              <span class="font-semibold text-text-primary">⏱️ {{ t('features.coach.settings.takebackDelayTitle') }}</span>
              <span class="font-mono text-neon-cyan text-[10px] font-bold">
                {{ (coachStore.autoTakebackDelay / 1000).toFixed(1) }}s
              </span>
            </div>
            <div class="px-1 py-0.5">
              <n-slider
                :value="coachStore.autoTakebackDelay"
                :min="100"
                :max="3000"
                :step="100"
                @update:value="coachStore.setAutoTakebackDelay"
              />
            </div>
            <div class="flex justify-between text-[8px] text-text-disabled font-mono">
              <span>0.1s</span>
              <span>1.5s</span>
              <span>3.0s</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Visualization Layers Config -->
      <div class="mb-3 pt-2 border-t border-border">
        <div class="text-[10px] uppercase font-bold text-text-primary mb-2 tracking-wide flex items-center gap-1.5">
          <span>🎨</span>
          <span>{{ t('features.coach.settings.visualLayersSection') }}</span>
        </div>

        <div class="flex flex-col gap-2">
          <!-- Layer 1: Last Move Quality Badge -->
          <div
            @click="toggleLayer('lastMoveNag')"
            class="p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated cursor-pointer flex items-center justify-between transition-all select-none"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-text-primary text-[11px]">🏷️ {{ t('features.coach.settings.lastMoveQualityTitle') }}</span>
              <span class="text-[9px] text-text-secondary">{{ t('features.coach.settings.lastMoveQualityDesc') }}</span>
            </div>
            <div
              class="w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0"
              :class="coachStore.visualLayers.lastMoveNag ? 'bg-neon-cyan' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-void shadow-md transform transition-transform duration-200 ease-in-out"
                :class="coachStore.visualLayers.lastMoveNag ? 'translate-x-4' : 'translate-x-0'"
              />
            </div>
          </div>

          <!-- Layer 2: Candidate Move Arrow -->
          <div
            @click="toggleLayer('candidateArrow')"
            class="p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated cursor-pointer flex items-center justify-between transition-all select-none"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-text-primary text-[11px]">🎯 {{ t('features.coach.settings.recommendedArrowTitle') }}</span>
              <span class="text-[9px] text-text-secondary">{{ t('features.coach.settings.recommendedArrowDesc') }}</span>
            </div>
            <div
              class="w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0"
              :class="coachStore.visualLayers.candidateArrow ? 'bg-neon-cyan' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-void shadow-md transform transition-transform duration-200 ease-in-out"
                :class="coachStore.visualLayers.candidateArrow ? 'translate-x-4' : 'translate-x-0'"
              />
            </div>
          </div>

          <!-- Layer 3: Tactical & Strategic Plans -->
          <div
            @click="toggleLayer('tacticalPlans')"
            class="p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated cursor-pointer flex items-center justify-between transition-all select-none"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-text-primary text-[11px]">🧠 {{ t('features.coach.settings.tacticalPlansTitle') }}</span>
              <span class="text-[9px] text-text-secondary">{{ t('features.coach.settings.tacticalPlansDesc') }}</span>
            </div>
            <div
              class="w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0"
              :class="coachStore.visualLayers.tacticalPlans ? 'bg-neon-cyan' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-void shadow-md transform transition-transform duration-200 ease-in-out"
                :class="coachStore.visualLayers.tacticalPlans ? 'translate-x-4' : 'translate-x-0'"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-1.5 justify-end pt-2 border-t border-border">
        <button
          @click="close"
          class="px-3 py-1 text-[10px] font-bold bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40 rounded-md cursor-pointer hover:bg-neon-cyan/25 transition-colors"
        >
          {{ t('shared.buttons.close') }}
        </button>
      </div>
    </div>
  </n-popover>
</template>
