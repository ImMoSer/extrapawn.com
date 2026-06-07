<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useGameStore, PgnTree } from '@/entities/game'
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { NText, NIcon } from 'naive-ui'
import { 
  ArrowUpOutline, 
  TrashOutline, 
  TrendingUpOutline 
} from '@vicons/ionicons5'

const gameStore = useGameStore()

// Context Menu State
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const selectedNode = ref<PgnNode | null>(null)

const handleContextMenu = (payload: { event: MouseEvent; node: PgnNode }) => {
  const { event, node } = payload
  
  // Do not show menu on root node (ply 0)
  if (node.ply === 0) return

  selectedNode.value = node
  menuX.value = event.clientX
  menuY.value = event.clientY
  showMenu.value = true
}

const closeMenu = () => {
  showMenu.value = false
  selectedNode.value = null
}

// Global click/contextmenu listeners to dismiss menu
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

// Menu Actions
const promoteToMain = () => {
  if (selectedNode.value) {
    pgnService.promoteToMainline(selectedNode.value)
    // Sync board
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())
  }
  closeMenu()
}

const promoteToVariant = () => {
  if (selectedNode.value) {
    pgnService.promoteToVariantMainline(selectedNode.value)
    // Sync board
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())
  }
  closeMenu()
}

const deleteMove = () => {
  if (selectedNode.value) {
    pgnService.deleteNode(selectedNode.value)
    // Sync board (since deleteNode navigates current to parent if needed)
    gameStore.loadPosition(pgnService.getCurrentNavigatedFen())
  }
  closeMenu()
}
</script>

<template>
  <div class="pgn-move-history">
    <div class="history-header">
      <n-text class="header-title" depth="3">Partieverlauf</n-text>
    </div>
    
    <div class="history-content-scroll">
      <PgnTree :key="pgnTreeVersion" @contextmenu="handleContextMenu" />
    </div>

    <!-- Custom Glassmorphic Context Menu -->
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
            <span>Als Hauptvariante setzen</span>
          </div>
          
          <div class="menu-item" @click="promoteToVariant">
            <n-icon class="menu-icon"><TrendingUpOutline /></n-icon>
            <span>Als Varianten-Hauptlinie setzen</span>
          </div>
          
          <div class="menu-item delete" @click="deleteMove">
            <n-icon class="menu-icon"><TrashOutline /></n-icon>
            <span>Variante löschen</span>
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
  border-bottom: 1px solid var(--glass-border);
}

.history-header {
  padding: 8px 14px 4px;
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
  padding: 8px 14px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.03);
  margin: 0 14px 12px;
  border-radius: 8px;
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

/* Custom Context Menu */
.custom-context-menu {
  position: fixed;
  z-index: 99999;
  min-width: 250px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-radius: 10px;
  transform: translate(0, 4px); /* offset slightly below cursor */
  
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
        color: #fff;
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

/* Context Menu Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(0, 0) scale(0.95);
}
</style>
