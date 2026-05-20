<script setup lang="ts">
import { ref, markRaw, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { NTabs, NTabPane } from 'naive-ui'
import BaseSelectionLayout from '@/shared/ui/BaseSelectionLayout.vue'

// Import components for each mode's content
import FinishHimSelectionContent from './FinishHimSelectionContent.vue'
import TheoryEndingsSelectionContent from './TheoryEndingsSelectionContent.vue'
import PracticalChessSelectionContent from './PracticalChessSelectionContent.vue'

interface TabItem {
  name: string
  labelKey: string
  component: Component
}

const { t } = useI18n()
const activeTab = ref('finish-him')

const tabs: TabItem[] = [
  { name: 'finish-him', labelKey: 'welcome.buttons.finishHim', component: markRaw(FinishHimSelectionContent) },
  { name: 'theory-endings', labelKey: 'welcome.buttons.theoryEndgames', component: markRaw(TheoryEndingsSelectionContent) },
  { name: 'practical-chess', labelKey: 'welcome.buttons.practicalChess', component: markRaw(PracticalChessSelectionContent) }
]

const currentTab = ref<TabItem>(tabs[0]!)

function handleTabChange(value: string) {
  activeTab.value = value
  const found = tabs.find(tab => tab.name === value)
  if (found) {
    currentTab.value = found
  }
}

interface SelectionContentExposed {
  handleStart: () => void
}

const contentRef = ref<SelectionContentExposed | null>(null)

function handleStart() {
  if (contentRef.value?.handleStart) {
    contentRef.value.handleStart()
  }
}
</script>

<template>
  <BaseSelectionLayout
    :title="t('welcome.buttons.endgames')"
    accent-type="primary"
    @start="handleStart"
  >
    <template #sections>
      <n-tabs
        v-model:value="activeTab"
        type="segment"
        @update:value="handleTabChange"
        class="endgames-tabs"
      >
        <n-tab-pane
          v-for="tab in tabs"
          :key="tab.name"
          :name="tab.name"
          :tab="t(tab.labelKey)"
        />
      </n-tabs>

      <div class="tab-content">
        <component
          :is="currentTab.component"
          ref="contentRef"
        />
      </div>
    </template>

    <template #start-button-label>
      {{ t('features.theoryEndgames.selection.start') }}
    </template>
  </BaseSelectionLayout>
</template>

<style scoped>
.endgames-tabs {
  margin-bottom: 20px;
}
.tab-content {
  min-height: 300px;
}
</style>
