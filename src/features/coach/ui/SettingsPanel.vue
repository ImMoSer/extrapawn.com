<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'change', payload: { depth: number; multipv: number; version: string; source: string }): void
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

const depth = ref(12)
const multipv = ref(3)
const version = ref<string>('lite')
const source = ref<string>('remote')

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
      class="absolute right-0 bottom-[calc(100%+8px)] w-[320px] p-3.5 bg-surface border border-border-hover rounded-lg shadow-2xl z-50 text-[11px]"
    >
      <div class="text-[9px] uppercase tracking-wider font-bold text-text-secondary mb-2">
        Engine settings
      </div>

      <!-- Server Mode Badge -->
      <div class="mb-3 p-2 rounded bg-success/10 border border-success/20 text-[10px] text-success leading-tight flex items-center justify-between">
        <span>⚡ Server Engine Mode Active</span>
        <span class="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/20">Docker</span>
      </div>

      <div>
        <!-- Stockfish Version -->
        <div class="mb-3">
          <label for="setting-version" class="block text-text-primary font-semibold mb-1">
            Stockfish Version
          </label>
          <select
            id="setting-version"
            v-model="version"
            class="w-full bg-elevated border border-border rounded text-text-primary p-1.5 text-[11px] focus:outline-none focus:border-neon-cyan cursor-pointer"
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
              {{ depth }}
            </span>
          </div>
          <input
            id="setting-depth"
            type="range"
            min="6"
            max="22"
            step="1"
            v-model.number="depth"
            class="w-full accent-neon-cyan"
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
              {{ multipv }}
            </span>
          </div>
          <input
            id="setting-multipv"
            type="range"
            min="1"
            max="10"
            step="1"
            v-model.number="multipv"
            class="w-full accent-neon-cyan"
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
