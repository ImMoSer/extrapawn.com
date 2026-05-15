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

      <!-- Language -->
      <div class="setting-group">
        <div class="setting-header">
          <label for="setting-lang">Mentor Language</label>
        </div>
        <select
          id="setting-lang"
          class="setting-select"
          :value="coachStore.preferredLanguage"
          @change="handleLanguageChange"
        >
          <option value="EN">English</option>
          <option value="DE">Deutsch</option>
          <option value="RU">Русский</option>
        </select>
      </div>

      <!-- Voice -->
      <div class="setting-group" v-if="hasSpeechSynthesis">
        <div class="setting-header">
          <label for="setting-voice">Mentor Voice (TTS)</label>
        </div>
        <select
          id="setting-voice"
          class="setting-select"
          :value="coachStore.preferredVoiceURI"
          @change="handleVoiceChange"
        >
          <option value="">Default (Auto-detect)</option>
          <option v-for="voice in filteredVoices" :key="voice.voiceURI" :value="voice.voiceURI">
            {{ voice.name }}
          </option>
        </select>
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

      <!-- Threads -->
      <div class="setting-group" :class="{ 'is-disabled': useServer }">
        <div class="setting-header">
          <label for="setting-threads">CPU Threads</label>
          <span class="setting-value">{{ threads }}</span>
        </div>
        <input
          id="setting-threads"
          type="range"
          min="1"
          :max="maxThreads"
          step="1"
          v-model.number="threads"
          class="setting-slider"
          :disabled="useServer"
        />
        <div class="setting-labels">
          <span>1</span>
          <span>{{ maxThreads }}</span>
        </div>
        <div class="setting-desc">More threads → faster analysis, but higher CPU usage.</div>
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useCoachStore } from '@/features/coach/model/coach.store'
import { SettingsOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import { getEngineDefaults, USE_SERVER_ENGINE, setUseServerEngine } from '@/shared/lib/engine/coach/engine'

const emit = defineEmits(['change'])

const open = ref(false)
const useServer = ref(USE_SERVER_ENGINE)

const handleServerToggle = (event: Event) => {
  const target = event.target as HTMLInputElement
  setUseServerEngine(target.checked)
}
const defaults = getEngineDefaults()
const depth = ref(defaults.depth)
const multipv = ref(defaults.multipv)
const threads = ref(defaults.threads)
const maxThreads = computed(() => Math.max(1, navigator.hardwareConcurrency || 4))
const wrapRef = ref<HTMLElement | null>(null)
const coachStore = useCoachStore()
const availableVoices = ref<SpeechSynthesisVoice[]>([])
const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window

const loadVoices = () => {
  if ('speechSynthesis' in window) {
    availableVoices.value = window.speechSynthesis.getVoices()
  }
}

const filteredVoices = computed(() => {
  const langPrefix = coachStore.preferredLanguage.toLowerCase()
  return availableVoices.value.filter(v => v.lang.startsWith(langPrefix))
})

watch(() => coachStore.preferredLanguage, () => {
  coachStore.setPreferredVoiceURI('')
})

const handleLanguageChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  coachStore.setPreferredLanguage(target.value)
}

const handleVoiceChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  coachStore.setPreferredVoiceURI(target.value)
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
  
  loadVoices()
  if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

const apply = () => {
  coachEngineManager.setDefaults({
    depth: depth.value,
    multipv: multipv.value,
    threads: threads.value,
  })
  open.value = false
  emit('change', { depth: depth.value, multipv: multipv.value, threads: threads.value })
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

.setting-select {
  width: 100%;
  padding: 6px;
  background-color: #1f1f23;
  color: #a1a1aa;
  border: 1px solid #3f3f46;
  border-radius: 4px;
  font-size: 11px;
  outline: none;
  margin-top: 4px;
}
.setting-select:focus {
  border-color: #86efac;
}
</style>
