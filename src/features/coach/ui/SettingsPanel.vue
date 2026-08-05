<script setup lang="ts">
import { ref } from 'vue'
import { NPopover, NIcon } from 'naive-ui'
import { SettingsOutline } from '@vicons/ionicons5'
import { useCoachStore, type CoachVisualLayers } from '../model/coach.store'

const emit = defineEmits<{
  (e: 'change'): void
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
        title="Coach & Engine settings"
        aria-label="Open coach settings"
        class="icon-btn p-1.5 rounded-md border text-xs cursor-pointer flex items-center justify-center transition-colors"
        :class="showPopover ? 'bg-border-hover text-text-primary border-neon-cyan' : 'bg-elevated text-text-secondary border-border hover:border-border-hover hover:text-text-primary'"
      >
        <NIcon size="14">
          <SettingsOutline />
        </NIcon>
      </button>
    </template>

    <div
      class="w-[300px] p-3.5 bg-surface border border-border-hover rounded-lg shadow-2xl z-[9999] text-[11px] text-text-primary"
    >
      <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-2">
        Coach Settings
      </div>

      <!-- Server Mode Badge -->
      <div class="mb-3 p-2 rounded bg-success/10 border border-success/20 text-[10px] text-success leading-tight flex items-center justify-between">
        <span>⚡ Server Engine Mode Active</span>
        <span class="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/20">Docker</span>
      </div>

      <!-- Visualization Layers Config -->
      <div class="mb-3 pt-2 border-t border-border">
        <div class="text-[10px] uppercase font-bold text-text-primary mb-2 tracking-wide flex items-center gap-1.5">
          <span>🎨</span>
          <span>Board Visualization Layers</span>
        </div>

        <div class="flex flex-col gap-2">
          <!-- Layer 1: Last Move Quality Badge -->
          <div
            @click="toggleLayer('lastMoveNag')"
            class="p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated cursor-pointer flex items-center justify-between transition-all select-none"
          >
            <div class="flex flex-col">
              <span class="font-semibold text-text-primary text-[11px]">🏷️ Last Move Quality</span>
              <span class="text-[9px] text-text-secondary">Badge on last move destination</span>
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
              <span class="font-semibold text-text-primary text-[11px]">🎯 Recommended Arrow</span>
              <span class="text-[9px] text-text-secondary">Candidate move arrow & target NAG</span>
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
              <span class="font-semibold text-text-primary text-[11px]">🧠 Tactical & Strategic Plans</span>
              <span class="text-[9px] text-text-secondary">Arrows for attacks, key squares & plans</span>
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
          Close
        </button>
      </div>
    </div>
  </n-popover>
</template>
