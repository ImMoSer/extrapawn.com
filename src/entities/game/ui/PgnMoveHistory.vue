<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useGameStore } from '../model/game.store'
import PgnTree from './PgnTree.vue'
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { NText, NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { ArrowUpOutline, TrashOutline, TrendingUpOutline } from '@vicons/ionicons5'

const props = withDefaults(
  defineProps<{
    readOnly?: boolean
  }>(),
  {
    readOnly: undefined,
  },
)

const { t } = useI18n()
const gameStore = useGameStore()
const scrollContainer = ref<HTMLElement | null>(null)

const isReadOnly = computed(() => props.readOnly ?? gameStore.gamePhase === 'PLAYING')

watch(
  pgnTreeVersion,
  () => {
    if (window.matchMedia('(orientation: portrait)').matches) {
      return
    }

    nextTick(() => {
      const activeEl = scrollContainer.value?.querySelector('.move-san.is-active')
      activeEl?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    })
  },
  { immediate: true },
)

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const selectedNode = ref<PgnNode | null>(null)

const handleContextMenu = (payload: { event: MouseEvent; node: PgnNode }) => {
  const { event, node } = payload

  if (isReadOnly.value || node.ply === 0) return

  selectedNode.value = node
  menuX.value = event.clientX
  menuY.value = event.clientY
  showMenu.value = true
}

const closeMenu = () => {
  showMenu.value = false
  selectedNode.value = null
}

const handleGlobalClick = () => {
  if (showMenu.value) {
    closeMenu()
  }
}

onMounted(() => {
  window.addEventListener('click', handleGlobalClick)
  window.addEventListener('contextmenu', handleGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
  window.removeEventListener('contextmenu', handleGlobalClick)
})

const promoteToMain = () => {
  if (selectedNode.value) {
    pgnService.promoteToMainline(selectedNode.value)
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())
  }
  closeMenu()
}

const promoteToVariant = () => {
  if (selectedNode.value) {
    pgnService.promoteToVariantMainline(selectedNode.value)
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())
  }
  closeMenu()
}

const deleteMove = () => {
  if (selectedNode.value) {
    pgnService.deleteNode(selectedNode.value)
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())
  }
  closeMenu()
}
</script>

<template>
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-surface"
  >
    <div class="px-3 pt-2 pb-1">
      <n-text class="text-xs font-bold tracking-[0.5px] uppercase" depth="3">
        {{ t('shared.board.pgn.moveHistory') }}
      </n-text>
    </div>

    <div
      ref="scrollContainer"
      class="mx-2 mb-2 min-h-0 flex-1 overflow-y-auto rounded border border-border bg-void/40 px-3 py-2"
    >
      <PgnTree :key="pgnTreeVersion" :read-only="isReadOnly" @contextmenu="handleContextMenu" />
    </div>

    <teleport to="body">
      <div
        v-if="showMenu && selectedNode"
        class="glass fixed z-[99999] flex min-w-[250px] translate-y-1 flex-col gap-0.5 rounded-[10px] p-1.5"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
      >
        <div
          class="group flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[0.85rem] font-medium text-text-primary transition-colors select-none hover:bg-elevated"
          @click="promoteToMain"
        >
          <n-icon class="text-base text-text-secondary group-hover:text-text-primary">
            <ArrowUpOutline />
          </n-icon>
          <span>{{ t('shared.board.pgn.promoteToMain') }}</span>
        </div>

        <div
          class="group flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[0.85rem] font-medium text-text-primary transition-colors select-none hover:bg-elevated"
          @click="promoteToVariant"
        >
          <n-icon class="text-base text-text-secondary group-hover:text-text-primary">
            <TrendingUpOutline />
          </n-icon>
          <span>{{ t('shared.board.pgn.promoteVariation') }}</span>
        </div>

        <div
          class="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-[0.85rem] font-medium text-danger transition-colors select-none hover:bg-danger/15"
          @click="deleteMove"
        >
          <n-icon class="text-base text-danger"><TrashOutline /></n-icon>
          <span>{{ t('shared.board.pgn.deleteVariation') }}</span>
        </div>
      </div>
    </teleport>
  </div>
</template>
