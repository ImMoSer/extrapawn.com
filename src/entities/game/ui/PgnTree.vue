<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import PgnTreeNode from './PgnTreeNode.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    readOnly?: boolean
  }>(),
  {
    readOnly: false,
  },
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
  <div class="text-left font-condensed text-[0.95rem] leading-relaxed text-text-primary">
    <div v-if="rootNode && rootNode.children.length > 0" class="p-1">
      <PgnTreeNode
        :node="rootNode"
        :depth="0"
        :read-only="props.readOnly"
        @contextmenu="emit('contextmenu', $event)"
      />
    </div>
    <div v-else class="p-5 text-center text-[0.9rem] text-text-secondary italic">
      {{ t('shared.board.pgn.noMoves') }}
    </div>
  </div>
</template>
