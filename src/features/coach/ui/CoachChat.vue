<!-- src/features/coach/ui/CoachChat.vue -->
<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NIcon,
  NScrollbar,
  NInput,
  NSpin,
  useMessage,
  type ScrollbarInst,
} from 'naive-ui'
import { SendOutline } from '@vicons/ionicons5'
import { useCoachStore } from '../model/coach.store'
import { useBoardStore } from '@/entities/game'

// Types
type ChatMessage = {
  sender: 'user' | 'coach'
  text: string
  timestamp: Date
}

// State
const { t } = useI18n()
const message = useMessage()
const boardStore = useBoardStore()
const coachStore = useCoachStore()

const chatMessages = ref<ChatMessage[]>([])
const currentQuestion = ref<string>('')
const isChatLoading = ref<boolean>(false)
const chatScrollbarRef = ref<ScrollbarInst | null>(null)

// Chat Coach LLM Communication
async function sendChatMessage() {
  const query = currentQuestion.value.trim()
  if (!query) return

  chatMessages.value.push({
    sender: 'user',
    text: query,
    timestamp: new Date(),
  })

  currentQuestion.value = ''
  isChatLoading.value = true
  nextTick(() => {
    chatScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })

  const backendApiUrl = import.meta.env.VITE_BACKEND_API_URL
  if (!backendApiUrl) {
    message.error('Backend URL configuration is missing.')
    isChatLoading.value = false
    return
  }

  try {
    const currentExplanation = coachStore.currentExplanation
    
    // Convert current chat messages to the format expected by the backend
    const historyPayload = chatMessages.value.map((msg) => ({
      fen: boardStore.fen,
      message: `${msg.sender === 'user' ? 'User' : 'Coach'}: ${msg.text}`,
    }))

    const basePayload = {
      question: query,
      fen: boardStore.fen,
      side_to_move: boardStore.turn,
      user_color: boardStore.orientation,
      language: coachStore.preferredLanguage || 'DE',
      coach_history: historyPayload,
      context_summary: currentExplanation?.summary_text || 'No static analysis context available.',
      eval_cp: currentExplanation?.eval_cp || 0,
      verdict: currentExplanation?.verdict || 'unknown',
    }

    const fullPayload = {
      payload: basePayload,
      profile: null,
    }

    const response = await fetch(`${backendApiUrl}/coach/mentor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(fullPayload),
    })

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Nur Abonnenten mit King-Status haben Zugriff auf den Chat-Coach.')
      }
      throw new Error(`Server returned status ${response.status}`)
    }

    const data = await response.json()
    if (data && data.output) {
      chatMessages.value.push({
        sender: 'coach',
        text: data.output,
        timestamp: new Date(),
      })
    } else {
      throw new Error('Empty response from LLM')
    }
  } catch (err: unknown) {
    console.error('LLM Mentor communication error:', err)
    const errMessage = err instanceof Error ? err.message : String(err)
    chatMessages.value.push({
      sender: 'coach',
      text: `Entschuldigung, ich konnte keine Verbindung herstellen. Details: ${errMessage}`,
      timestamp: new Date(),
    })
  } finally {
    isChatLoading.value = false
    nextTick(() => {
      chatScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
    })
  }
}

function addWelcomeMessage() {
  chatMessages.value = [
    {
      sender: 'coach',
      text: t('features.learningCoach.welcomeMsg', { source: 'Chat Coach' }),
      timestamp: new Date(),
    },
  ]
  nextTick(() => {
    chatScrollbarRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
  })
}

onMounted(() => {
  if (chatMessages.value.length === 0) {
    addWelcomeMessage()
  }
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
              v-for="(msg, idx) in chatMessages"
              :key="idx"
              class="msg-bubble-wrapper"
              :class="msg.sender"
            >
              <div class="msg-bubble">
                <div class="msg-header">
                  {{ msg.sender === 'coach' ? 'Coach' : 'Du' }}
                </div>
                <div class="msg-text">{{ msg.text }}</div>
              </div>
            </div>
            <div v-if="isChatLoading" class="chat-loading-indicator">
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
        <n-button type="primary" class="send-btn" @click="sendChatMessage" :disabled="isChatLoading">
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
