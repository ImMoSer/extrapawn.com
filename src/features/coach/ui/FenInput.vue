<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  fen: string
  fenError?: string | null
  totalWidth?: number
}>()

const emit = defineEmits<{
  (e: 'submit-fen', fen: string): void
}>()

const inputFen = ref(props.fen)

watch(
  () => props.fen,
  (newFen) => {
    inputFen.value = newFen
  }
)

function handleSubmit() {
  emit('submit-fen', inputFen.value)
}
</script>

<template>
  <div
    class="bg-surface p-2.5 rounded border box-border max-w-full flex-1 min-w-0 flex flex-col justify-center"
    :class="fenError ? 'border-danger/45' : 'border-border'"
    :style="totalWidth ? { width: `${totalWidth}px` } : {}"
  >
    <form @submit.prevent="handleSubmit" class="flex gap-2 items-center">
      <input
        v-model="inputFen"
        :aria-invalid="fenError ? 'true' : 'false'"
        class="flex-1 min-w-0 bg-void border rounded px-3 py-1.5 text-xs text-text-primary font-mono outline-none focus:border-neon-cyan transition-colors"
        :class="fenError ? 'border-danger/55' : 'border-border'"
        placeholder="Paste FEN string..."
      />
      <button
        type="submit"
        class="bg-elevated hover:bg-border-hover text-neon-cyan border border-border hover:border-neon-cyan px-4 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors shrink-0"
      >
        Load FEN
      </button>
    </form>

    <div
      v-if="fenError"
      role="alert"
      class="mt-1 text-[11px] text-danger font-mono leading-tight"
    >
      Invalid FEN: {{ fenError }}
    </div>
  </div>
</template>
