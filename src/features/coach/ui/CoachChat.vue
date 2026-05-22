<!-- src/features/coach/ui/CoachChat.vue -->
<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NIcon,
  NScrollbar,
  NInput,
  NSpin,
  type ScrollbarInst,
} from 'naive-ui'
import { SendOutline } from '@vicons/ionicons5'
import { useCoachStore } from '../model/coach.store'

// State
const { t } = useI18n()
const coachStore = useCoachStore()

const currentQuestion = ref<string>('')
const chatScrollbarRef = ref<ScrollbarInst | null>(null)

// Chat Coach LLM Communication
async function sendChatMessage() {
  const query = currentQuestion.value.trim()
  if (!query) return

  currentQuestion.value = ''
  
  await coachStore.sendChatMessage(query)
  
  nextTick(() => {
    chatScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })
}

// Watch for new messages to scroll
watch(() => coachStore.chatMessages.length, () => {
  nextTick(() => {
    chatScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })
})

onMounted(() => {
  nextTick(() => {
    chatScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })
})
</script>

<template>
  <div class="chat-panel">
    <div class="chat-container">
      <!-- Messages List -->
      <div class="chat-messages-scroller">
        <n-scrollbar ref="chatScrollbarRef">
          <div class="messages-list">
            <div
              v-for="(msg, idx) in coachStore.chatMessages"
              :key="idx"
              class="msg-bubble-wrapper"
              :class="[msg.sender, msg.type]"
            >
              <div class="msg-bubble">
                <div v-if="msg.sender !== 'referee'" class="msg-header">
                  {{ msg.sender === 'coach' ? 'Coach' : 'Du' }}
                </div>
                <div class="msg-text">
                  <template v-if="msg.sender === 'referee'">
                    <span class="referee-prefix">Referee:</span> {{ msg.text }}
                  </template>
                  <template v-else>
                    {{ msg.text }}
                  </template>
                </div>
              </div>
            </div>
            <div v-if="coachStore.isChatLoading" class="chat-loading-indicator">
              <n-spin size="small" />
              <n-text depth="3" style="margin-left: 8px">
                {{ t('features.learningCoach.coachThinking') }}
              </n-text>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <!-- Chat Input -->
      <div class="chat-input-row">
        <n-input
          v-model:value="currentQuestion"
          type="text"
          :placeholder="t('features.learningCoach.chatPlaceholder')"
          @keyup.enter="sendChatMessage"
          class="glass-chat-input"
        />
        <n-button type="primary" class="send-btn" @click="sendChatMessage" :disabled="coachStore.isChatLoading">
          <template #icon>
            <n-icon><SendOutline /></n-icon>
          </template>
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.chat-messages-scroller {
  flex: 1;
  min-height: 0;
  padding: 10px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.msg-bubble-wrapper {
  display: flex;
  width: 100%;
}

.msg-bubble-wrapper.coach {
  justify-content: flex-start;
}

.msg-bubble-wrapper.user {
  justify-content: flex-end;
}

.msg-bubble-wrapper.referee {
  justify-content: flex-start;
}

.msg-bubble-wrapper.referee.userMove {
  justify-content: flex-end;
}

.msg-bubble {
  max-width: 85%;
  border-radius: 12px;
  padding: 8px 12px;
  font-size: 0.85rem;
  line-height: 1.4;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.coach .msg-bubble {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-text-default);
  border-top-left-radius: 2px;
}

.user .msg-bubble {
  background: rgba(157, 78, 221, 0.2);
  border: 1px solid rgba(157, 78, 221, 0.4);
  color: #e0b0ff;
  border-top-right-radius: 2px;
}

.referee .msg-bubble {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(239, 68, 68, 0.4); /* Default red border */
  color: #a9b7c6;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  padding: 4px 10px;
  white-space: nowrap;
}

.referee.userMove .msg-bubble {
  border-color: rgba(0, 242, 255, 0.4); /* Blue border for user moves */
}

.referee-prefix {
  font-weight: 800;
  text-transform: uppercase;
  margin-right: 4px;
  opacity: 0.7;
}

.msg-header {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 4px;
  opacity: 0.6;
}

.chat-loading-indicator {
  display: flex;
  align-items: center;
  padding: 4px;
}

.chat-input-row {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.send-btn {
  background: var(--neon-pink-alpha, #ff007f33) !important;
  border-color: var(--neon-pink, #ff007f) !important;
  color: #fff !important;
}

.send-btn:hover {
  background: var(--neon-pink, #ff007f) !important;
  box-shadow: 0 0 10px var(--neon-pink, #ff007f);
}

.glass-chat-input {
  background: rgba(255, 255, 255, 0.05);
}
</style>
