<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { CloseOutline, TrashOutline, WarningOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NIcon, NModal } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  username: string
}>()

const { t } = useI18n()
const authStore = useAuthStore()

const showConfirmModal = ref(false)
const isStartingDeletion = ref(false)
const modalError = ref<string | null>(null)

function openModal(): void {
  modalError.value = null
  showConfirmModal.value = true
}

function closeModal(): void {
  if (isStartingDeletion.value) return
  showConfirmModal.value = false
}

async function handleConfirmDeletion(): Promise<void> {
  isStartingDeletion.value = true
  modalError.value = null
  try {
    await authStore.startAccountDeletion()
  } catch (err: unknown) {
    modalError.value =
      err instanceof Error ? err.message : t('pages.userCabinet.accountDanger.statusError')
    isStartingDeletion.value = false
  }
}
</script>

<template>
  <section
    class="rounded-xl border border-danger/35 bg-surface p-4 sm:p-5 flex flex-col @2xl:flex-row @2xl:items-center @2xl:justify-between gap-4"
  >
    <div class="flex items-start gap-3 min-w-0">
      <div
        class="w-9 h-9 rounded-md border border-danger/40 bg-danger/10 text-danger flex items-center justify-center shrink-0 mt-0.5"
      >
        <NIcon :component="WarningOutline" size="18" />
      </div>
      <div class="flex flex-col gap-1 min-w-0">
        <h2 class="font-display text-sm font-bold uppercase tracking-wider text-danger">
          {{ t('pages.userCabinet.accountDanger.title') }}
        </h2>
        <p class="text-xs text-text-secondary leading-relaxed">
          {{ t('pages.userCabinet.accountDanger.description') }}
        </p>
      </div>
    </div>

    <div class="shrink-0">
      <NButton
        type="error"
        secondary
        class="min-w-0 max-w-full"
        @click="openModal"
      >
        <template #icon>
          <NIcon :component="TrashOutline" />
        </template>
        <span class="truncate">{{ t('pages.userCabinet.accountDanger.triggerBtn') }}</span>
      </NButton>
    </div>

    <NModal v-model:show="showConfirmModal" :mask-closable="!isStartingDeletion">
      <div
        class="w-full max-w-md rounded-xl border border-danger/40 bg-surface p-5 shadow-xl text-text-primary select-none flex flex-col gap-4"
      >
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2 min-w-0">
            <NIcon :component="WarningOutline" class="text-lg text-danger shrink-0" />
            <h3
              class="font-display text-base font-bold uppercase tracking-wider text-danger truncate"
            >
              {{ t('pages.userCabinet.accountDanger.modalTitle') }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded p-1 text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
            :disabled="isStartingDeletion"
            @click="closeModal"
          >
            <NIcon :component="CloseOutline" class="text-lg" />
          </button>
        </div>

        <p class="text-xs text-text-primary leading-relaxed">
          {{ t('pages.userCabinet.accountDanger.modalLead', { username }) }}
        </p>

        <ul
          class="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-text-secondary space-y-1.5 list-disc list-inside"
        >
          <li>{{ t('pages.userCabinet.accountDanger.bulletRatings') }}</li>
          <li>{{ t('pages.userCabinet.accountDanger.bulletActivity') }}</li>
          <li>{{ t('pages.userCabinet.accountDanger.bulletCourses') }}</li>
          <li>{{ t('pages.userCabinet.accountDanger.bulletProfile') }}</li>
        </ul>

        <p class="text-xs text-text-secondary leading-relaxed">
          {{ t('pages.userCabinet.accountDanger.reauthHint') }}
        </p>

        <NAlert v-if="modalError" type="error" closable @close="modalError = null">
          {{ modalError }}
        </NAlert>

        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <NButton
            secondary
            class="min-w-0"
            :disabled="isStartingDeletion"
            @click="closeModal"
          >
            <span class="truncate">{{ t('shared.buttons.cancel') }}</span>
          </NButton>
          <NButton
            type="error"
            class="min-w-0"
            :loading="isStartingDeletion"
            @click="handleConfirmDeletion"
          >
            <template #icon>
              <NIcon :component="TrashOutline" />
            </template>
            <span class="truncate">{{ t('pages.userCabinet.accountDanger.confirmBtn') }}</span>
          </NButton>
        </div>
      </div>
    </NModal>
  </section>
</template>
