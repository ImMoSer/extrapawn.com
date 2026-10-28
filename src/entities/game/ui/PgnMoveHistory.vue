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
  <div class="pgn-move-history">
    <div class="history-header">
      <n-text class="header-title" depth="3">{{ t('shared.board.pgn.moveHistory') }}</n-text>
    </div>

    <div ref="scrollContainer" class="history-content-scroll">
      <PgnTree :key="pgnTreeVersion" :read-only="isReadOnly" @contextmenu="handleContextMenu" />
    </div>

    <teleport to="body">
      <transition name="fade">
        <div
          v-if="showMenu && selectedNode"
          class="custom-context-menu glass"
          :style="{ left: menuX + 'px', top: menuY + 'px' }"
          @click.stop
        >
          <div class="menu-item" @click="promoteToMain">
            <n-icon class="menu-icon"><ArrowUpOutline /></n-icon>
            <span>{{ t('shared.board.pgn.promoteToMain') }}</span>
          </div>

          <div class="menu-item" @click="promoteToVariant">
            <n-icon class="menu-icon"><TrendingUpOutline /></n-icon>
            <span>{{ t('shared.board.pgn.promoteVariation') }}</span>
          </div>

          <div class="menu-item delete" @click="deleteMove">
            <n-icon class="menu-icon"><TrashOutline /></n-icon>
            <span>{{ t('shared.board.pgn.deleteVariation') }}</span>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped lang="scss">
.pgn-move-history {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--bg-1);
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  overflow: hidden;
}

.history-header {
  padding: 8px 12px 4px;
}

.header-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-content-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.03);
  margin: 0 8px 8px;
  border-radius: 6px;
}

.history-content-scroll::-webkit-scrollbar {
  width: 4px;
}

.history-content-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.history-content-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.history-content-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.custom-context-menu {
  position: fixed;
  z-index: 99999;
  min-width: 250px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 10px;
  transform: translate(0, 4px);

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-primary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;

    .menu-icon {
      font-size: 1rem;
      color: var(--text-secondary);
    }

    &:hover {
      background: rgba(255, 255, 255, 0.06);

      .menu-icon {
        color: var(--text-primary);
      }
    }

    &.delete {
      color: var(--color-error);

      .menu-icon {
        color: var(--color-error);
      }

      &:hover {
        background: rgba(255, 7, 58, 0.15);
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(0, 0) scale(0.95);
}
</style>

