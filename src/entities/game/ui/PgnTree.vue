<script setup lang="ts">
import { computed } from 'vue'
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import PgnTreeNode from './PgnTreeNode.vue'

const props = withDefaults(
  defineProps<{
    readOnly?: boolean
  }>(),
  {
    readOnly: false,
  }
)

const rootNode = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return pgnService.getRootNode()
})

const emit = defineEmits<{
  (e: 'contextmenu', payload: { event: MouseEvent; node: PgnNode }): void
}>()
</script>

<template>
  <div class="pgn-tree-view">
    <div v-if="rootNode && rootNode.children.length > 0" class="tree-content">
      <PgnTreeNode
        :node="rootNode"
        :depth="0"
        :read-only="props.readOnly"
        @contextmenu="emit('contextmenu', $event)"
      />
    </div>
    <div v-else class="empty-pgn">
      Keine Züge vorhanden
    </div>
  </div>
</template>

<style scoped>
.pgn-tree-view {
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.6;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  text-align: left;
}

.tree-content {
  padding: 4px;
}

.empty-pgn {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.9rem;
}
</style>
