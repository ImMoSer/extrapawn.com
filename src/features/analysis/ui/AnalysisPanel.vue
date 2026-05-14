<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import type { PgnNode } from '@/shared/lib/pgn/PgnService'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
  TerminalOutline,
} from '@vicons/ionicons5'
import { NButton, NButtonGroup, NIcon, NScrollbar, NSelect, NText, NTooltip } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, h, onUnmounted, type FunctionalComponent } from 'vue'
import { EngineLines, TablebaseInfo, useAnalysisStore } from '../index'

const props = withDefaults(
  defineProps<{
    showPgn?: boolean
  }>(),
  {
    showPgn: true,
  },
)

const analysisStore = useAnalysisStore()
const boardStore = useBoardStore()

onUnmounted(() => {
  analysisStore.resetAnalysisState()
})

const { isPanelVisible, isAnalysisActive, numThreads, maxThreads, isMultiThreadAvailable } =
  storeToRefs(analysisStore)

const threadOptions = computed(() => {
  return Array.from({ length: maxThreads.value }, (_, i) => ({
    label: `${i + 1}`,
    value: i + 1,
  }))
})

const pgnRendererComponent = computed(() => {
  const rootNode = pgnService.getRootNode()
  if (!rootNode) return null
  return h(PgnRenderer, { nodes: rootNode.children })
})

const handlePgnMoveClick = (node: PgnNode) => {
  boardStore.navigateToNode(node)
}

const handlePgnWheelNavigation = (event: WheelEvent) => {
  event.preventDefault()
  if (event.deltaY < 0) {
    boardStore.navigatePgn('backward', analysisStore.playerColor)
  } else {
    boardStore.navigatePgn('forward', analysisStore.playerColor)
  }
}

const PgnRenderer: FunctionalComponent<{ nodes: PgnNode[]; pathPrefix?: string }> = (props) => {
  const { nodes, pathPrefix = '' } = props
  if (!nodes || nodes.length === 0) return []

  const mainlineNode = nodes[0]
  if (!mainlineNode) return []

  const variations = nodes.slice(1)
  const elements = []

  // Check if this specific node is the current one in the service
  const isCurrent = mainlineNode === pgnService.getCurrentNode()

  if (mainlineNode.ply % 2 !== 0) {
    elements.push(
      h(
        NText,
        { depth: 3, class: 'move-number' },
        { default: () => `${Math.ceil(mainlineNode.ply / 2)}. ` },
      ),
    )
  }

  elements.push(
    h(
      NText,
      {
        strong: isCurrent,
        type: isCurrent ? 'primary' : 'default',
        class: { 'pgn-move': true, current: isCurrent },
        onClick: () => handlePgnMoveClick(mainlineNode),
      },
      { default: () => mainlineNode.san },
    ),
  )

  if (variations.length > 0) {
    variations.forEach((variationNode) => {
      elements.push(
        h('span', { class: 'pgn-variation' }, [
          h(NText, { depth: 3 }, { default: () => ' (' }),
          h(PgnRenderer, { nodes: [variationNode], pathPrefix }),
          h(NText, { depth: 3 }, { default: () => ') ' }),
        ]),
      )
    })
  }

  if (mainlineNode.children.length > 0) {
    elements.push(h('span', null, ' '))
    elements.push(h(PgnRenderer, { nodes: mainlineNode.children }))
  }

  return elements
}
</script>

<template>
  <div v-if="isPanelVisible" class="analysis-container">
    <transition name="fade-slide">
      <div v-if="isAnalysisActive" class="analysis-header-nav">
        <!-- Navigation -->
        <n-button-group class="nav-group">
          <n-button quaternary circle @click="boardStore.navigatePgn('start')">
            <template #icon
              ><n-icon><PlaySkipBackOutline /></n-icon
            ></template>
          </n-button>
          <n-button
            quaternary
            circle
            @click="boardStore.navigatePgn('backward', analysisStore.playerColor)"
          >
            <template #icon
              ><n-icon><ChevronBackOutline /></n-icon
            ></template>
          </n-button>

          <!-- Threads selection in the center -->
          <div class="threads-nav-wrapper">
            <n-tooltip trigger="hover">
              <template #trigger>
                <n-icon size="14" depth="3" class="threads-icon">
                  <TerminalOutline />
                </n-icon>
              </template>
              {{ $t('features.analysis.threads') }}
            </n-tooltip>
            <n-select
              class="threads-select-nav"
              size="tiny"
              :bordered="false"
              :disabled="!isMultiThreadAvailable"
              :value="numThreads"
              :options="threadOptions"
              @update:value="analysisStore.setThreads"
              :consistent-menu-width="false"
            />
          </div>

          <n-button
            quaternary
            circle
            @click="boardStore.navigatePgn('forward', analysisStore.playerColor)"
          >
            <template #icon
              ><n-icon><ChevronForwardOutline /></n-icon
            ></template>
          </n-button>
          <n-button quaternary circle @click="boardStore.navigatePgn('end')">
            <template #icon
              ><n-icon><PlaySkipForwardOutline /></n-icon
            ></template>
          </n-button>
        </n-button-group>
      </div>
    </transition>

    <EngineLines />
    <TablebaseInfo />

    <transition name="fade-slide">
      <div v-if="isAnalysisActive && props.showPgn" class="analysis-body">
        <!-- PGN Display -->
        <div class="pgn-wrapper" @wheel="handlePgnWheelNavigation">
          <n-scrollbar class="pgn-scroll">
            <div class="pgn-content">
              <component :is="pgnRendererComponent" :key="pgnTreeVersion" />
            </div>
          </n-scrollbar>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
.analysis-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.toolbar-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  backdrop-filter: var(--glass-blur);
}

.threads-select {
  width: 110px;
}

.analysis-header-nav {
  margin-bottom: 4px;
}

.nav-group {
  width: 100%;
  display: flex;
  align-items: center;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 4px;
  backdrop-filter: var(--glass-blur);

  .n-button {
    flex: 1;
    --n-border-radius: 8px !important;
  }
}

.threads-nav-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 28px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  border-right: 1px solid rgba(255, 255, 255, 0.1);

  .threads-icon {
    opacity: 0.6;
    transition: opacity 0.3s;
    &:hover {
      opacity: 1;
    }
  }

  .threads-select-nav {
    width: 50px;
    :deep(.n-base-selection) {
      background: transparent !important;
      --n-border: none !important;
      --n-border-hover: none !important;
      --n-border-active: none !important;
      --n-box-shadow-focus: none !important;
    }
    :deep(.n-base-selection-label) {
      padding: 0 !important;
      font-family: monospace;
      font-weight: 700;
      color: var(--neon-cyan);
    }
  }
}

.lines-wrapper {
  height: 110px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px;
  overflow: hidden;
}

.loading-state,
.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.lines-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.line-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);

  .line-depth {
    font-family: monospace;
    font-size: 0.75rem;
    min-width: 20px;
    text-align: right;
  }

  .score-btn {
    min-width: 54px;
    border-radius: 6px;
  }

  .pv-text {
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;

    &:hover {
      color: var(--color-accent);
    }
  }
}

.pgn-wrapper {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 12px;

  max-height: 300px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  backdrop-filter: var(--glass-blur);
}

.pgn-scroll {
  flex: 1;
  min-height: 0;
}

.pgn-content {
  line-height: 2;
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .pgn-wrapper {
    padding: 8px;
    max-height: 200px;
  }

  .pgn-content {
    line-height: 1.6;
    font-size: 0.85rem;
    letter-spacing: -0.2px;
  }

  :deep(.pgn-move) {
    padding: 1px 4px;
    margin: 0;
  }
}

:deep(.pgn-move) {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  margin: 0 1px;
  transition: all 0.2s ease;
  font-weight: 500;

  &:hover:not(.current) {
    background: rgba(255, 255, 255, 0.08);
  }

  &.current {
    background: rgba(0, 163, 255, 0.3);
    color: var(--neon-cyan);
    font-weight: 800;
    box-shadow: 0 0 10px rgba(0, 163, 255, 0.4);
    border: 1px solid rgba(0, 163, 255, 0.3);
  }
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
