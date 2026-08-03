<!-- src/shared/ui/ConfirmationModal.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { apiClient } from '@/shared/api/client'
import {
  LockClosedOutline,
  WarningOutline,
  InformationCircleOutline,
  PaperPlaneOutline,
  GiftOutline,
  CheckmarkCircleOutline
} from '@vicons/ionicons5'
import { NIcon, useMessage } from 'naive-ui'

const { t } = useI18n()
const uiStore = useUiStore()
const message = useMessage()

// Gift code state
const showGiftInput = ref(false)
const giftCodeInput = ref('')
const isRedeeming = ref(false)
const redeemSuccess = ref(false)

// Reset internal state when modal closes/opens
watch(
  () => uiStore.isModalVisible,
  (isVisible) => {
    if (!isVisible) {
      showGiftInput.value = false
      giftCodeInput.value = ''
      isRedeeming.value = false
      redeemSuccess.value = false
    }
  }
)

const handleRedeemGiftCode = async () => {
  const code = giftCodeInput.value.trim()
  if (!code || code.length !== 8) {
    message.warning(t('puzzleCategories.tierRestriction.giftPlaceholder'))
    return
  }

  isRedeeming.value = true
  try {
    const res = await apiClient<{ success: boolean; tier: string; expiresAt: string }>(
      '/billing/redeem',
      {
        method: 'POST',
        body: JSON.stringify({ code })
      }
    )

    if (res.success) {
      redeemSuccess.value = true
      message.success(t('puzzleCategories.tierRestriction.giftSuccess'))
      setTimeout(() => {
        uiStore.handleCancel()
        window.location.reload()
      }, 1200)
    }
  } catch {
    message.error(t('puzzleCategories.tierRestriction.giftInvalid'))
  } finally {
    isRedeeming.value = false
  }
}
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
          class="w-14 h-14 rounded-full bg-neon-cyan/10 border border-neon-cyan/40 flex items-center justify-center mb-4 text-neon-cyan shadow-glow-cyan/20"
        >
          <NIcon size="28">
            <LockClosedOutline />
          </NIcon>
        </div>
        <div
          v-else-if="uiStore.modalIcon === 'warning'"
          class="w-14 h-14 rounded-full bg-warning/10 border border-warning/40 flex items-center justify-center mb-4 text-warning"
        >
          <NIcon size="28">
            <WarningOutline />
          </NIcon>
        </div>
        <div
          v-else-if="uiStore.modalIcon === 'info'"
          class="w-14 h-14 rounded-full bg-info/10 border border-info/40 flex items-center justify-center mb-4 text-info"
        >
          <NIcon size="28">
            <InformationCircleOutline />
          </NIcon>
        </div>

        <h3
          class="mt-0 mb-2 text-xl font-bold font-display tracking-wide"
          :class="{
            'text-neon-cyan': uiStore.modalVariant === 'primary',
            'text-danger': uiStore.modalVariant === 'danger',
            'text-warning': uiStore.modalVariant === 'warning',
            'text-info': uiStore.modalVariant === 'info',
          }"
        >
          {{ uiStore.modalTitle }}
        </h3>

        <p class="text-text-primary text-sm leading-relaxed mb-6 font-body">
          {{ uiStore.modalMessage }}
        </p>

        <!-- Subscription Restriction Options (3 Choices) -->
        <template v-if="uiStore.modalIcon === 'lock'">
          <div class="flex flex-col gap-3 w-full mb-6">
            <!-- 1. Telegram Bot Link (Hidden if user already linked Telegram) -->
            <a
              v-if="!uiStore.modalTelegramAttached"
              href="https://t.me/ExtraPawnComBot"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full py-2.5 px-4 rounded-xl bg-neon-purple/15 border border-neon-purple/40 text-neon-purple font-bold text-sm hover:bg-neon-purple/25 flex items-center justify-center gap-2 transition-all cursor-pointer no-underline box-border"
            >
              <NIcon size="18">
                <PaperPlaneOutline />
              </NIcon>
              <span>{{ t('puzzleCategories.tierRestriction.getGiftCode') }}</span>
            </a>

            <!-- 2. Enter Gift Code Expandable Section -->
            <div class="w-full flex flex-col items-center">
              <button
                v-if="!showGiftInput"
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-surface border border-border text-text-primary font-medium text-sm hover:border-neon-cyan/40 hover:text-neon-cyan flex items-center justify-center gap-2 transition-all cursor-pointer"
                @click="showGiftInput = true"
              >
                <NIcon size="18">
                  <GiftOutline />
                </NIcon>
                <span>{{ t('puzzleCategories.tierRestriction.enterGiftCode') }}</span>
              </button>

              <div v-else class="w-full flex flex-col gap-2 p-3 bg-surface rounded-xl border border-border">
                <div class="flex items-center gap-2">
                  <input
                    v-model="giftCodeInput"
                    type="text"
                    maxlength="8"
                    :placeholder="t('puzzleCategories.tierRestriction.giftPlaceholder')"
                    class="flex-1 px-3 py-2 bg-elevated border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-neon-cyan uppercase font-mono tracking-widest text-center"
                    :disabled="isRedeeming || redeemSuccess"
                    @keyup.enter="handleRedeemGiftCode"
                  />
                  <button
                    type="button"
                    class="px-4 py-2 bg-neon-cyan text-void font-bold text-sm rounded-lg hover:bg-cyan-deep disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
                    :disabled="isRedeeming || giftCodeInput.trim().length !== 8 || redeemSuccess"
                    @click="handleRedeemGiftCode"
                  >
                    <NIcon v-if="redeemSuccess" size="16">
                      <CheckmarkCircleOutline />
                    </NIcon>
                    <span>{{ t('puzzleCategories.tierRestriction.activateBtn') }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 3. Buy Subscription Button -->
            <button
              type="button"
              class="w-full py-2.5 px-4 rounded-xl bg-neon-cyan text-void font-bold text-sm hover:bg-cyan-deep shadow-glow-cyan/20 transition-all cursor-pointer"
              @click="uiStore.handleConfirm"
            >
              {{ uiStore.modalConfirmText }}
            </button>
          </div>

          <!-- Cancel / Close -->
          <button
            type="button"
            class="text-text-secondary text-xs hover:text-text-primary transition-all cursor-pointer underline"
            @click="uiStore.handleCancel"
          >
            {{ uiStore.modalCancelText }}
          </button>
        </template>

        <!-- Standard Confirmation Buttons (for normal dialogs) -->
        <template v-else>
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
        </template>
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
