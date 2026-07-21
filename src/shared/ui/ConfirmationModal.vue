<!-- src/shared/ui/ConfirmationModal.vue -->
<script setup lang="ts">
import { useUiStore } from '@/shared/ui/model/ui.store'

const uiStore = useUiStore()
</script>

<template>
  <div v-if="uiStore.isModalVisible" class="fixed inset-0 bg-void/80 backdrop-blur-md flex justify-center items-center z-[9999]" @click.self="uiStore.handleOverlayClick">
    <div class="bg-elevated p-8 rounded-lg border border-border shadow-elevated w-[90%] max-w-[350px] text-center max-xs:max-w-[285px]">
      <h3 class="mt-0 text-warning text-lg font-bold font-display">{{ uiStore.modalTitle }}</h3>
      <p class="text-text-primary mb-8 text-sm">{{ uiStore.modalMessage }}</p>
      <div class="flex justify-around gap-4">
        <button
          v-if="uiStore.isExtraButtonVisible"
          class="px-6 py-3 rounded-md bg-success text-void font-bold cursor-pointer hover:bg-success-deep transition-all"
          @click="uiStore.handleExtra"
        >
          {{ uiStore.modalExtraText }}
        </button>
        <button
          v-if="uiStore.isCancelButtonVisible"
          class="px-6 py-3 rounded-md bg-surface text-text-primary border border-border font-bold cursor-pointer hover:bg-border transition-all"
          @click="uiStore.handleCancel"
        >
          {{ uiStore.modalCancelText }}
        </button>
        <button class="px-6 py-3 rounded-md bg-danger text-white font-bold cursor-pointer hover:bg-danger-deep transition-all" @click="uiStore.handleConfirm">
          {{ uiStore.modalConfirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
