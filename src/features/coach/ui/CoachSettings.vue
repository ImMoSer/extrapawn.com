<template>
  <div class="relative" ref="wrapRef">
    <button
      @click="toggleOpen"
      title="Engine settings (depth, multi-PV)"
      aria-label="Open engine settings"
      :aria-expanded="open"
      aria-haspopup="dialog"
      class="icon-btn settings-btn"
      :class="{ 'is-open': open }"
    >
      <n-icon size="14"><SettingsOutline /></n-icon>
    </button>
    <div v-if="open" class="settings-dropdown">
      <div class="settings-title">Engine settings</div>

      <!-- Server Engine Switch -->
      <div class="setting-group">
        <div class="setting-header">
          <label for="setting-server">Use Server Engine (Premium)</label>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
          <span class="setting-desc" style="margin-top: 0;">Offloads analysis to the cloud</span>
          <input
            id="setting-server"
            type="checkbox"
            v-model="useServer"
            @change="handleServerToggle"
          />
        </div>
      </div>

      <!-- Depth -->
      <div class="setting-group" :class="{ 'is-disabled': useServer }">
        <div class="setting-header">
          <label for="setting-depth">Search depth</label>
          <span class="setting-value">{{ depth }}</span>
        </div>
        <input
          id="setting-depth"
          type="range"
          min="6"
          max="22"
          step="1"
          v-model.number="depth"
          class="setting-slider"
          :disabled="useServer"
        />
        <div class="setting-labels">
          <span>fast (6)</span>
          <span>deep (22)</span>
        </div>
        <div class="setting-desc">
          Higher depth → stronger analysis, slower per move. Default 12 is a good balance.
        </div>
      </div>

      <!-- MultiPV -->
      <div class="setting-group" :class="{ 'is-disabled': useServer }">
        <div class="setting-header">
          <label for="setting-multipv">Top moves shown</label>
          <span class="setting-value">{{ multipv }}</span>
        </div>
        <input
          id="setting-multipv"
          type="range"
          min="1"
          max="10"
          step="1"
          v-model.number="multipv"
          class="setting-slider"
          :disabled="useServer"
        />
        <div class="setting-labels">
          <span>1</span>
          <span>10</span>
        </div>
        <div class="setting-desc">How many candidate moves the engine evaluates per position.</div>
      </div>

      <!-- Coach Takeback Settings -->
      <div class="settings-title" style="margin-top: 16px; border-top: 1px solid #27272a; padding-top: 12px;">
        Coach Takeback
      </div>

      <!-- Takeback Enable Switch -->
      <div class="setting-group">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label for="setting-takeback" style="color: #d4d4d8; font-weight: 600;">Enable Auto-Takeback</label>
          <input
            id="setting-takeback"
            type="checkbox"
            v-model="takebackEnabled"
          />
        </div>
        <div class="setting-desc">Automatically undo blunders to try again</div>
      </div>

      <!-- Takeback Delay -->
      <div class="setting-group" :class="{ 'is-disabled': !takebackEnabled }">
        <div class="setting-header">
          <label for="setting-takeback-delay">Takeback delay</label>
          <span class="setting-value">{{ takebackDelay / 1000 }}s</span>
        </div>
        <input
          id="setting-takeback-delay"
          type="range"
          min="1000"
          max="5000"
          step="1000"
          v-model.number="takebackDelay"
          class="setting-slider"
          :disabled="!takebackEnabled"
        />
        <div class="setting-labels">
          <span>1s</span>
          <span>5s</span>
        </div>
        <div class="setting-desc">How long the blunder visuals stay on board before undo.</div>
      </div>

      <!-- Actions -->
      <div class="settings-actions">
        <button class="btn-cancel" @click="open = false">Cancel</button>
        <button class="btn-apply" @click="apply">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { SettingsOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { usePreferencesStore } from '@/features/settings'

const emit = defineEmits(['change'])

const open = ref(false)
const preferencesStore = usePreferencesStore()

const useServer = ref(preferencesStore.preferences.engine.useServerCoach)
const depth = ref(preferencesStore.preferences.engine.depth)
const multipv = ref(preferencesStore.preferences.engine.multipv)
const takebackEnabled = ref(preferencesStore.coachTakebackEnabled)
const takebackDelay = ref(preferencesStore.coachTakebackDelay)
const wrapRef = ref<HTMLElement | null>(null)

// Sync local inputs if preferences update from elsewhere
watch(
  () => preferencesStore.preferences.engine,
  (newEngine) => {
    useServer.value = newEngine.useServerCoach
    depth.value = newEngine.depth
    multipv.value = newEngine.multipv
  },
  { deep: true }
)

watch(
  () => [preferencesStore.coachTakebackEnabled, preferencesStore.coachTakebackDelay] as const,
  ([newEnabled, newDelay]) => {
    takebackEnabled.value = newEnabled
    takebackDelay.value = newDelay
  }
)

const handleServerToggle = (event: Event) => {
  const target = event.target as HTMLInputElement
  useServer.value = target.checked
}

const toggleOpen = () => {
  open.value = !open.value
}

const handleClickOutside = (e: MouseEvent) => {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

const apply = () => {
  preferencesStore.updatePreferences({
    engine: {
      useServerCoach: useServer.value,
      depth: depth.value,
      multipv: multipv.value,
    }
  })
  preferencesStore.updateCoachTakeback(takebackEnabled.value, takebackDelay.value)
  open.value = false
  emit('change', { depth: depth.value, multipv: multipv.value })
}
</script>

<style scoped>
.relative {
  position: relative;
}

.settings-btn {
  padding: 7px;
  border-radius: 6px;
  background-color: #1f1f23;
  color: #a1a1aa;
  border: 1px solid #27272a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.settings-btn.is-open {
  background-color: #3f3f46;
  color: #fafafa;
  border-color: #52525b;
}

.settings-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 260px;
  padding: 12px;
  background-color: #0e0e10;
  border: 1px solid #3f3f46;
  border-radius: 8px;
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.7);
  z-index: 100;
  font-size: 11px;
}

.settings-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #71717a;
  margin-bottom: 8px;
}

.setting-group {
  margin-bottom: 12px;
}

.setting-group.is-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.setting-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.setting-header label {
  color: #d4d4d8;
  font-weight: 600;
}

.setting-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #86efac;
  font-weight: 700;
}

.setting-slider {
  width: 100%;
  accent-color: #86efac;
}

.setting-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #52525b;
  margin-top: 2px;
}

.setting-desc {
  font-size: 10px;
  color: #71717a;
  margin-top: 4px;
  line-height: 1.4;
}

.settings-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 700;
  background-color: transparent;
  color: #a1a1aa;
  border: 1px solid #27272a;
  border-radius: 6px;
  cursor: pointer;
}

.btn-apply {
  padding: 5px 12px;
  font-size: 10px;
  font-weight: 700;
  background-color: rgba(74, 222, 128, 0.15);
  color: #86efac;
  border: 1px solid rgba(74, 222, 128, 0.4);
  border-radius: 6px;
  cursor: pointer;
}
</style>
