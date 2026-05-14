<script setup lang="ts">
import BaseSelectionLayout from '@/shared/ui/BaseSelectionLayout.vue'
import VisualRadioGroup from '@/shared/ui/VisualRadioGroup.vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'

const { t } = useI18n()
const router = useRouter()

const selectedCategory = ref('blitz')

const modes = computed(() => [
  { label: t('features.tornado.modes.bullet'), value: 'bullet', icon: '⚡' },
  { label: t('features.tornado.modes.blitz'), value: 'blitz', icon: '🔥' },
  { label: t('features.tornado.modes.rapid'), value: 'rapid', icon: '🚶' },
  { label: t('features.tornado.modes.classic'), value: 'classic', icon: '⏳' },
])

function handleStart() {
  router.push({ name: 'tornado', params: { mode: selectedCategory.value } })
}
</script>

<template>
  <BaseSelectionLayout
    title="TORNADO"
    :subtitle="t('features.tornado.feedback.selectMode')"
    accent-type="primary"
    is-tornado
    @start="handleStart"
  >
    <template #sections>
      <div class="section">
        <VisualRadioGroup v-model:value="selectedCategory" :options="modes" :columns="2" />
      </div>
    </template>
  </BaseSelectionLayout>
</template>
