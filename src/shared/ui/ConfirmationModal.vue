<!-- src/shared/ui/ConfirmationModal.vue -->
<script setup lang="ts">
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  InformationCircleOutline,
  LockClosedOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

const uiStore = useUiStore()
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    leave-active-class="transition-opacity duration-150 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="uiStore.isModalVisible"
      class="fixed inset-0 bg-canvas/80 flex justify-center items-center z-9999 p-4"
      @click.self="uiStore.handleOverlayClick"
    >
      <div
        class="bg-surface p-6 rounded-xl border border-border shadow-lg w-full max-w-[420px] text-center box-border flex flex-col items-center"
      >
        <!-- Icon Badge -->
        <div
          v-if="uiStore.modalIcon === 'lock'"
          class="w-12 h-12 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center mb-4 text-brand"
        >
          <NIcon size="24">
            <LockClosedOutline />
          </NIcon>
        </div>
        <div
          v-else-if="uiStore.modalIcon === 'warning'"
          class="w-12 h-12 rounded-lg bg-warning/10 border border-warning/30 flex items-center justify-center mb-4 text-warning"
        >
          <NIcon size="24">
            <WarningOutline />
          </NIcon>
        </div>
        <div
          v-else-if="uiStore.modalIcon === 'info'"
          class="w-12 h-12 rounded-lg bg-info/10 border border-info/30 flex items-center justify-center mb-4 text-info"
        >
          <NIcon size="24">
            <InformationCircleOutline />
          </NIcon>
        </div>

        <h3 class="text-text-primary text-lg font-semibold mb-2 font-display">
          {{ uiStore.modalTitle }}
        </h3>

        <p class="text-text-secondary text-sm leading-relaxed mb-6 font-display">
          {{ uiStore.modalMessage }}
        </p>

        <!-- Standard Confirmation Buttons -->
        <div class="flex items-center justify-center gap-2.5 w-full">
          <button
            v-if="uiStore.isCancelButtonVisible"
            type="button"
            class="flex-1 py-2.5 px-4 rounded-md bg-elevated border border-border text-text-secondary font-medium text-sm hover:border-border-hover hover:text-text-primary transition-colors cursor-pointer"
            @click="uiStore.handleCancel"
          >
            {{ uiStore.modalCancelText }}
          </button>
          <button
            v-if="uiStore.isExtraButtonVisible"
            type="button"
            class="flex-1 py-2.5 px-4 rounded-md bg-elevated border border-brand/40 text-brand font-medium text-sm hover:bg-brand/10 transition-colors cursor-pointer"
            @click="uiStore.handleExtra"
          >
            {{ uiStore.modalExtraText }}
          </button>
          <button
            type="button"
            class="flex-1 py-2.5 px-4 rounded-md font-medium text-sm cursor-pointer transition-colors border-0"
            :class="{
              'bg-brand text-on-brand hover:bg-brand-deep': uiStore.modalVariant === 'primary',
              'bg-danger text-white hover:bg-danger-deep': uiStore.modalVariant === 'danger',
              'bg-warning text-on-brand hover:bg-warning-deep': uiStore.modalVariant === 'warning',
              'bg-info text-white hover:bg-info-deep': uiStore.modalVariant === 'info',
            }"
            @click="uiStore.handleConfirm"
          >
            {{ uiStore.modalConfirmText }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
