<script setup lang="ts">
import { NButton, NCard, NModal, NSpace, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';

const { t } = useI18n()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleConfirm() {
  emit('confirm')
  emit('update:show', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="props.show"
    @update:show="(v) => emit('update:show', v)"
    transform-origin="center"
    :mask-closable="false"
    :close-on-esc="false"
  >
    <NCard
      style="width: 400px"
      :title="t('features.taskToday.setupTitle')"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <NSpace vertical size="large">
        <NText>
          {{ t('features.taskToday.readyToStart') }}
        </NText>

        <NSpace justify="end">
          <NButton @click="handleCancel">{{ t('shared.buttons.cancel') }}</NButton>
          <NButton type="primary" @click="handleConfirm">{{
            t('features.taskToday.startBtn')
          }}</NButton>
        </NSpace>
      </NSpace>
    </NCard>
  </NModal>
</template>
