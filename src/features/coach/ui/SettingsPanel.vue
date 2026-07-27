<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getEngineDefaults, setEngineDefaults } from '@/shared/lib/engine/coach/engine'

const emit = defineEmits<{
  (e: 'change', payload: { depth: number; multipv: number; version: string; source: string }): void
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

const engineDefaults = getEngineDefaults()
const depth = ref(engineDefaults.depth || 12)
const multipv = ref(engineDefaults.multipv || 5)
const version = ref<string>(engineDefaults.version || 'lite')
const source = ref<string>(engineDefaults.source || 'remote')

function onClickOutside(e: MouseEvent) {
  if (open.value && wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})

function apply() {
  setEngineDefaults({ depth: depth.value, multipv: multipv.value, version: version.value, source: source.value })
  open.value = false
  emit('change', { depth: depth.value, multipv: multipv.value, version: version.value, source: source.value })
}
</script>

<template>
  <div ref="wrapRef" class="relative">
    <button
      @click="open = !open"
      title="Engine settings (depth, multi-PV, version)"
      aria-label="Open engine settings"
      :aria-expanded="open"
      class="icon-btn p-1.5 rounded-md border text-xs cursor-pointer flex items-center justify-center transition-colors"
      :class="open ? 'bg-border-hover text-text-primary border-neon-cyan' : 'bg-elevated text-text-secondary border-border'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-[calc(100%+6px)] w-[320px] p-3.5 bg-surface border border-border-hover rounded-lg shadow-2xl z-50 text-[11px]"
    >
      <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-2">
        Engine settings
      </div>

      <!-- Engine Source Toggle Switch -->
      <div class="mb-3 p-2.5 rounded-lg border border-border bg-void">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-text-primary font-semibold text-[11px]">Engine Mode</span>
          <span
            class="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded"
            :class="source === 'remote' ? 'bg-success/15 text-success border border-success/30' : 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/30'"
          >
            {{ source === 'remote' ? 'Docker Server' : 'Local WASM' }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-2 text-[10px] mt-2 px-1">
          <span class="cursor-pointer" :class="source === 'local' ? 'text-neon-cyan font-bold' : 'text-text-secondary'" @click="source = 'local'">
            Local (WASM)
          </span>

          <!-- Sliding Toggle Switch -->
          <button
            type="button"
            role="switch"
            :aria-checked="source === 'remote'"
            @click="source = source === 'remote' ? 'local' : 'remote'"
            title="Toggle Engine Mode (Left: Local WASM, Right: Docker Server)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
            :class="source === 'remote' ? 'bg-success-deep' : 'bg-cyan-deep'"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out"
              :class="source === 'remote' ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>

          <span class="cursor-pointer" :class="source === 'remote' ? 'text-success font-bold' : 'text-text-secondary'" @click="source = 'remote'">
            Docker Server
          </span>
        </div>
      </div>

      <!-- Server Mode Info Notice when remote is active -->
      <div v-if="source === 'remote'" class="mb-3 p-2 rounded bg-success/10 border border-success/20 text-[10px] text-success leading-tight">
        ⚡ Server engine uses fixed settings (Depth: 12, MultiPV: 3) & opening book. Local settings are deactivated.
      </div>

      <!-- Local Engine Controls (Disabled when remote source is active) -->
      <div :class="source === 'remote' ? 'opacity-40 pointer-events-none select-none' : ''">
        <!-- Stockfish Version -->
        <div class="mb-3">
          <label for="setting-version" class="block text-text-primary font-semibold mb-1">
            Stockfish Version
          </label>
          <select
            id="setting-version"
            v-model="version"
            :disabled="source === 'remote'"
            class="w-full bg-elevated border border-border rounded text-text-primary p-1.5 text-[11px] focus:outline-none focus:border-neon-cyan cursor-pointer disabled:cursor-not-allowed"
          >
            <option value="lite">Stockfish 18 Lite (~7 MB)</option>
            <option value="full">Stockfish 18 Full (~113 MB)</option>
          </select>
          <div class="text-[10px] text-text-secondary mt-1 leading-tight">
            Full version includes larger NNUE evaluation net for max strength.
          </div>
        </div>

        <!-- Depth -->
        <div class="mb-3">
          <div class="flex justify-between items-baseline mb-1">
            <label for="setting-depth" class="text-text-primary font-semibold">
              Search depth
            </label>
            <span class="font-mono text-neon-cyan font-bold">
              {{ source === 'remote' ? 12 : depth }}
            </span>
          </div>
          <input
            id="setting-depth"
            type="range"
            min="6"
            max="22"
            step="1"
            v-model.number="depth"
            :disabled="source === 'remote'"
            class="w-full accent-neon-cyan disabled:cursor-not-allowed"
          />
          <div class="flex justify-between text-[9px] text-text-disabled mt-0.5">
            <span>fast (6)</span>
            <span>deep (22)</span>
          </div>
          <div class="text-[10px] text-text-secondary mt-1 leading-tight">
            Higher depth → stronger analysis, slower per move.
          </div>
        </div>

        <!-- MultiPV -->
        <div class="mb-3">
          <div class="flex justify-between items-baseline mb-1">
            <label for="setting-multipv" class="text-text-primary font-semibold">
              Top moves shown
            </label>
            <span class="font-mono text-neon-cyan font-bold">
              {{ source === 'remote' ? 3 : multipv }}
            </span>
          </div>
          <input
            id="setting-multipv"
            type="range"
            min="1"
            max="10"
            step="1"
            v-model.number="multipv"
            :disabled="source === 'remote'"
            class="w-full accent-neon-cyan disabled:cursor-not-allowed"
          />
          <div class="flex justify-between text-[9px] text-text-disabled mt-0.5">
            <span>1</span>
            <span>10</span>
          </div>
          <div class="text-[10px] text-text-secondary mt-1 leading-tight">
            Candidate moves evaluated per position.
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-1.5 justify-end">
        <button
          @click="open = false"
          class="px-2.5 py-1 text-[10px] font-bold bg-transparent text-text-secondary border border-border rounded-md cursor-pointer hover:bg-elevated hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          @click="apply"
          class="px-3 py-1 text-[10px] font-bold bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40 rounded-md cursor-pointer hover:bg-neon-cyan/25 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  </div>
</template>
