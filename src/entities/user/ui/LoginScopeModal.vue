<template>
  <n-modal
    :show="authStore.isLoginModalVisible"
    preset="card"
    :title="t('features.auth.loginModal.title')"
    style="width: 500px; max-width: 90vw"
    :mask-closable="true"
    @update:show="(val) => !val && authStore.cancelLogin()"
  >
    <div class="p-4 space-y-6">
      <p class="text-base text-gray-700">
        {{ t('features.auth.loginModal.intro') }}
      </p>

      <div class="space-y-4">
        <!-- Base Permission -->
        <div class="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <n-checkbox :checked="true" disabled />
          <div>
            <div class="font-medium">{{ t('features.auth.loginModal.permissions.prefTitle') }}</div>
            <div class="text-sm text-gray-500">
              {{ t('features.auth.loginModal.permissions.prefDesc') }}
            </div>
          </div>
        </div>

        <!-- Study Permission -->
        <div
          class="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer"
          @click="toggleStudyScope"
        >
          <n-checkbox v-model:checked="enableStudyScope" @click.stop />
          <div>
            <div class="font-medium">
              {{ t('features.auth.loginModal.permissions.studyTitle') }}
            </div>
            <div class="text-sm text-gray-500">
              {{ t('features.auth.loginModal.permissions.studyDesc') }}
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end space-x-3 pt-4">
        <n-button @click="authStore.cancelLogin()">{{ t('common.actions.cancel') }}</n-button>
        <n-button type="primary" @click="handleContinue" :loading="authStore.isLoading">
          {{ t('features.auth.loginModal.continue') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NCheckbox, NButton } from 'naive-ui'
import { useAuthStore } from '../model/auth.store'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()
const enableStudyScope = ref(false)

const toggleStudyScope = () => {
  enableStudyScope.value = !enableStudyScope.value
}

const handleContinue = () => {
  const scopes = ['preference:read']
  if (enableStudyScope.value) {
    scopes.push('study:read', 'study:write')
  }
  authStore.confirmLogin(scopes)
}
</script>
