<script setup lang="ts">
import { AVAILABLE_BOARDS, AVAILABLE_PIECE_SETS } from '@/entities/user'
import { ColorPaletteOutline } from '@vicons/ionicons5'
import { NCollapse, NCollapseItem, NIcon } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  board: string
  pieces: string
}>()

const emit = defineEmits<{
  (e: 'update:board', value: string): void
  (e: 'update:pieces', value: string): void
}>()

const { t } = useI18n()
const boardTabRef = ref<HTMLElement | null>(null)
const expandedCollapseNames = ref<string[]>([])

const handleCollapseChange = (expandedNames: string[]) => {
  if (expandedNames.includes('board_pieces')) {
    setTimeout(() => {
      boardTabRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 150)
  }
}
</script>

<template>
  <div ref="boardTabRef">
    <NCollapse
      v-model:expanded-names="expandedCollapseNames"
      @update:expanded-names="handleCollapseChange"
    >
      <NCollapseItem name="board_pieces">
        <template #header>
          <div class="flex items-center gap-2.5 font-display font-semibold text-sm text-text-primary">
            <NIcon><ColorPaletteOutline /></NIcon>
            <span>{{ t('features.settings.selectBoard') }} & {{ t('features.settings.selectPieces') }}</span>
          </div>
        </template>

        <div class="p-3.5 rounded-lg bg-elevated/40 border border-border mb-3">
          <div class="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
            {{ t('features.settings.board') }}
          </div>
          <div class="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-0.5">
            <button
              v-for="boardOpt in AVAILABLE_BOARDS"
              :key="boardOpt.name"
              type="button"
              class="p-0.5 rounded-md border-2 bg-canvas cursor-pointer transition-colors"
              :class="
                boardOpt.name === board
                  ? 'border-brand'
                  : 'border-transparent hover:border-border-hover'
              "
              @click="emit('update:board', boardOpt.name)"
            >
              <img
                :src="`/board/jpg_png/${boardOpt.thumbnailFile}`"
                :alt="boardOpt.name"
                class="w-full h-auto block rounded-xs"
              />
            </button>
          </div>
        </div>

        <div class="p-3.5 rounded-lg bg-elevated/40 border border-border">
          <div class="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
            {{ t('features.settings.pieces') }}
          </div>
          <div class="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-0.5">
            <button
              v-for="pieceSet in AVAILABLE_PIECE_SETS"
              :key="pieceSet.name"
              type="button"
              class="aspect-square p-1 rounded-md border-2 bg-canvas cursor-pointer flex items-center justify-center transition-colors"
              :class="
                pieceSet.name === pieces
                  ? 'border-brand'
                  : 'border-transparent hover:border-border-hover'
              "
              @click="emit('update:pieces', pieceSet.name)"
            >
              <img
                :src="pieceSet.previewPieceFile"
                :alt="pieceSet.name"
                class="max-w-4/5 max-h-4/5"
              />
            </button>
          </div>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>
