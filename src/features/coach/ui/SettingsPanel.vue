<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NPopover, NIcon } from 'naive-ui'
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
        :class="showPopover ? 'bg-border-hover text-text-primary border-border-hover' : 'bg-elevated text-text-secondary border-border hover:border-border-hover hover:text-text-primary'"
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
              :class="coachStore.visualLayers.lastMoveNag ? 'bg-brand' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-on-brand shadow-md transform transition-transform duration-200 ease-in-out"
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
              :class="coachStore.visualLayers.candidateArrow ? 'bg-brand' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-on-brand shadow-md transform transition-transform duration-200 ease-in-out"
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
              :class="coachStore.visualLayers.tacticalPlans ? 'bg-brand' : 'bg-border'"
            >
              <div
                class="w-3 h-3 rounded-full bg-on-brand shadow-md transform transition-transform duration-200 ease-in-out"
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
          class="px-3 py-1 text-[10px] font-bold bg-elevated text-text-primary border border-border hover:border-border-hover rounded-md cursor-pointer transition-colors"
        >
          {{ t('shared.buttons.close') }}
        </button>
      </div>
    </div>
  </n-popover>
</template>
