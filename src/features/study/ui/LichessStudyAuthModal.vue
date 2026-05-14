<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('features.study.authModal.title')"
    style="width: 500px; max-width: 90vw"
    :mask-closable="false"
    :closable="false"
  >
    <div class="p-4 space-y-4">
      <p class="text-base">
        {{ t('features.study.authModal.description') }}
      </p>

      <n-alert :title="t('features.study.authModal.whyTitle')" type="info" :show-icon="false">
        <span
          v-html="
            t('features.study.authModal.whyText', {
              read: '<code>study:read</code>',
              write: '<code>study:write</code>',
            })
          "
        ></span>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li v-for="(item, index) in tm('features.study.authModal.whyList')" :key="index">
            {{ rt(item) }}
          </li>
        </ul>
      </n-alert>

      <n-alert
        :title="t('features.study.authModal.securityTitle')"
        type="warning"
        :show-icon="false"
      >
        {{ t('features.study.authModal.securityText') }}
      </n-alert>

      <div class="flex justify-end space-x-3 mt-6">
        <n-button @click="$emit('cancel')">{{ t('common.actions.cancel') }}</n-button>
        <n-button type="primary" @click="handleAuthorize" :loading="isAuthorizing">
          {{ t('features.study.authModal.authorize') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NAlert, NButton } from 'naive-ui'
import { useAuthStore } from '@/entities/user'
import { useI18n } from 'vue-i18n'

const { t, tm, rt } = useI18n()

defineProps<{
  show: boolean
}>()

defineEmits<{
  (e: 'cancel'): void
}>()

const isAuthorizing = ref(false)
const authStore = useAuthStore()

const handleAuthorize = () => {
  isAuthorizing.value = true
  authStore.confirmLogin(['preference:read', 'study:read', 'study:write'])
}
</script>
