<!-- src/shared/ui/ConfirmationModal.vue -->
<script setup lang="ts">
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  LockClosedOutline,
  WarningOutline,
  InformationCircleOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

const uiStore = useUiStore()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="uiStore.isModalVisible"
      class="fixed inset-0 bg-void/85 backdrop-blur-md flex justify-center items-center z-[9999] p-4"
      @click.self="uiStore.handleOverlayClick"
    >
      <div
        class="bg-elevated p-7 rounded-2xl border border-neon-cyan/30 shadow-glow-cyan/20 w-full max-w-[440px] text-center box-border flex flex-col items-center animate-scale-in"
      >
        <!-- Icon Badge -->
        <div
          v-if="uiStore.modalIcon === 'lock'"
          class="w-14 h-14 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center mb-4 text-neon-cyan"
        >
          <NIcon size="28">
            <LockClosedOutline />
          </NIcon>
        </div>
        <div
          v-else-if="uiStore.modalIcon === 'warning'"
          class="w-14 h-14 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center mb-4 text-warning"
        >
          <NIcon size="28">
            <WarningOutline />
          </NIcon>
        </div>
        <div
          v-else-if="uiStore.modalIcon === 'info'"
          class="w-14 h-14 rounded-full bg-info/10 border border-info/30 flex items-center justify-center mb-4 text-info"
        >
          <NIcon size="28">
            <InformationCircleOutline />
          </NIcon>
        </div>

        <h3 class="text-text-primary text-xl font-bold mb-2 font-display">
          {{ uiStore.modalTitle }}
        </h3>

        <p class="text-text-primary text-sm leading-relaxed mb-6 font-body">
          {{ uiStore.modalMessage }}
        </p>

        <!-- Standard Confirmation Buttons -->
        <div class="flex items-center justify-center gap-3 w-full">
          <button
            v-if="uiStore.isCancelButtonVisible"
            class="flex-1 py-2.5 px-4 rounded-lg bg-surface border border-border text-text-secondary font-medium text-sm hover:border-border-hover hover:text-text-primary transition-all cursor-pointer"
            @click="uiStore.handleCancel"
          >
            {{ uiStore.modalCancelText }}
          </button>
          <button
            v-if="uiStore.isExtraButtonVisible"
            class="flex-1 py-2.5 px-4 rounded-lg bg-surface border border-neon-cyan/40 text-neon-cyan font-bold text-sm hover:bg-neon-cyan/10 transition-all cursor-pointer"
            @click="uiStore.handleExtra"
          >
            {{ uiStore.modalExtraText }}
          </button>
          <button
            class="flex-1 py-2.5 px-4 rounded-lg font-bold text-sm cursor-pointer transition-all shadow-md"
            :class="{
              'bg-neon-cyan text-void hover:bg-cyan-deep shadow-glow-cyan/20': uiStore.modalVariant === 'primary',
              'bg-danger text-white hover:bg-danger-deep': uiStore.modalVariant === 'danger',
              'bg-warning text-void hover:bg-warning-deep': uiStore.modalVariant === 'warning',
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

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
