<script setup lang="ts">
import { NModal, NText, NButton, NSpace, NIcon } from 'naive-ui'
import { AlertCircleOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
  status?: number
  message: string
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const { t } = useI18n()

const displayMessage = computed(() => {
  if (props.message === 'This study is now private') {
    return t('features.study.manager.errors.studyPrivate')
  }
  return props.message
})
</script>

<template>
  <NModal
    :show="show"
    @update:show="(v) => emit('update:show', v)"
    preset="card"
    :title="t('common.actions.error')"
    style="width: 400px"
  >
    <NSpace vertical align="center" size="large">
      <NIcon size="48" color="#ff4757">
        <AlertCircleOutline />
      </NIcon>

      <div style="text-align: center">
        <NText depth="3" style="font-size: 0.9em; display: block; margin-bottom: 8px">
          {{ t('common.status.label') }}: {{ status || t('common.status.unknown') }}
        </NText>
        <NText strong style="font-size: 1.1em">
          {{ displayMessage }}
        </NText>
      </div>

      <NButton block type="primary" @click="emit('update:show', false)">
        {{ t('common.actions.ok') }}
      </NButton>
    </NSpace>
  </NModal>
</template>
