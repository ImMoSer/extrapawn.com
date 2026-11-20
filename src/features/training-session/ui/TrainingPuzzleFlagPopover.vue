<script setup lang="ts">
import { FlagOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NInput, NPopover } from 'naive-ui'
import { ref } from 'vue'

defineProps<{
  puzzleId: string | number
  loading: boolean
}>()

const emit = defineEmits<{
  submit: [reason: string]
}>()

const showPopover = ref<boolean>(false)
const comment = ref<string>('')

function handleSubmit(preset?: string): void {
  const reason = preset ?? comment.value.trim()
  showPopover.value = false
  comment.value = ''
  emit('submit', reason || 'Помечено при проверке курса')
}
</script>

<template>
  <NPopover
    v-model:show="showPopover"
    trigger="click"
    placement="bottom-end"
  >
    <template #trigger>
      <NButton
        size="tiny"
        quaternary
        type="warning"
        :loading="loading"
        title="Пожаловаться на задачу и перейти к следующей"
      >
        <template #icon>
          <NIcon><FlagOutline /></NIcon>
        </template>
        Флаг
      </NButton>
    </template>
    <div class="w-64 p-1 flex flex-col gap-2 text-xs">
      <div class="font-display font-bold text-text-primary">
        Отправить задачу #{{ puzzleId }} в доработку
      </div>
      <div class="flex flex-wrap gap-1">
        <NButton
          size="tiny"
          secondary
          @click="handleSubmit('Неоднозначное решение / дуаль')"
        >
          Дуаль
        </NButton>
        <NButton
          size="tiny"
          secondary
          @click="handleSubmit('Слишком короткое / странное решение')"
        >
          Странная линия
        </NButton>
        <NButton
          size="tiny"
          secondary
          @click="handleSubmit('Неверная тема / классификация')"
        >
          Не та тема
        </NButton>
      </div>
      <NInput
        v-model:value="comment"
        size="small"
        placeholder="Комментарий (опционально)..."
        @keyup.enter="handleSubmit()"
      />
      <NButton
        size="small"
        type="warning"
        block
        :loading="loading"
        @click="handleSubmit()"
      >
        В блокнот и далее →
      </NButton>
    </div>
  </NPopover>
</template>
