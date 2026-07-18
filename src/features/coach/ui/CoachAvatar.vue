<template>
  <div class="coach-avatar-card" :class="mood">
    <div class="avatar-wrapper">
      <div class="avatar-sphere">
        <span class="avatar-emoji">{{ emoji }}</span>
      </div>
      <div class="status-dot" :class="mood"></div>
    </div>
    <div class="speech-bubble">
      <div class="coach-name">Chess Coach</div>
      <div class="coach-message">{{ message }}</div>
      <!-- Engine Plan -->
      <div v-if="hasPlan && mood === 'neutral'" class="engine-plan">
        <div class="section-title">
          Engine plan{{ plan?.depth ? ` · depth ${plan.depth}` : '' }}
        </div>
        <div v-if="plan?.zwischenzug" class="plan-zwischenzug">
          {{ plan.zwischenzug.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCoachFeedbackStore } from '../model/coach-feedback.store'
import { useCoachStore } from '../model/coach.store'

const feedbackStore = useCoachFeedbackStore()
const coachStore = useCoachStore()

const plan = computed(() => coachStore.currentExplanation?.principal_plan)
const hasPlan = computed<boolean>(
  () => !!(plan.value && Array.isArray(plan.value.moves) && plan.value.moves.length >= 2),
)

const mood = computed(() => feedbackStore.coachMood)

const emoji = computed(() => {
  switch (mood.value) {
    case 'proud':
      return '🤩'
    case 'shocked':
      return '🤦‍♂️'
    case 'thoughtful':
      return '🧐'
    case 'warning':
      return '🤨'
    case 'relieved':
      return '😅'
    case 'celebrating':
      return '🙌'
    case 'neutral':
    default:
      return '🙂'
  }
})

const message = computed(() => {
  if (feedbackStore.takebackMessage) {
    return feedbackStore.takebackMessage
  }

  if (coachStore.isAnalyzing && !coachStore.currentExplanation) {
    return 'Rechne... Lass mich die Stellung analysieren.'
  }

  switch (mood.value) {
    case 'proud':
      return 'Hervorragender Zug! Ganz feines Schachgespür!'
    case 'shocked':
      return 'Oha... Das war ein schwerer Patzer. Wir müssen aufpassen!'
    case 'thoughtful':
      return 'Interessante Konstellation. Ich gehe tiefer in die Varianten...'
    case 'warning':
      return 'Vorsicht! Du hast da eine drohende Antwort übersehen.'
    case 'relieved':
      return 'Puh! Genau der richtige Zug, um die Stellung zu stabilisieren.'
    case 'celebrating':
      return 'Schachmatt! Fantastisch zu Ende gespielt!'
    case 'neutral':
    default:
      if (hasPlan.value && plan.value?.description) {
        return plan.value.description
      }
      return 'Wie lautet dein Plan für diese Stellung?'
  }
})
</script>

<style scoped>
.coach-avatar-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  margin: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar-sphere {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1e1e24 0%, #0d0d11 100%);
  border: 2px solid #3f3f46;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #0b0d17;
  background-color: #a1a1aa;
  transition: background-color 0.3s ease;
}

/* Spezialeffekte je nach Stimmung */
.proud .avatar-sphere {
  border-color: #34d399;
  background: rgba(52, 211, 153, 0.05);
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(52, 211, 153, 0.3);
}
.proud .status-dot {
  background-color: #34d399;
}

.shocked .avatar-sphere {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
  animation: shake 0.5s ease;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.3);
}
.shocked .status-dot {
  background-color: #ef4444;
}

.warning .avatar-sphere {
  border-color: #fb923c;
  background: rgba(251, 146, 60, 0.05);
  box-shadow: 0 0 10px rgba(251, 146, 60, 0.2);
}
.warning .status-dot {
  background-color: #fb923c;
}

.thoughtful .avatar-sphere {
  border-color: #a78bfa;
  animation: breathe 2s infinite ease-in-out;
}
.thoughtful .status-dot {
  background-color: #a78bfa;
}

.celebrating .avatar-sphere {
  border-color: #22d3ee;
  background: rgba(34, 211, 238, 0.08);
  animation: bounce 0.6s infinite alternate;
  box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);
}
.celebrating .status-dot {
  background-color: #22d3ee;
}

.speech-bubble {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.coach-name {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
}

.coach-message {
  font-size: 12px;
  color: #fafafa;
  line-height: 1.4;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-4px); }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.95; }
  50% { transform: scale(1.02); opacity: 1; }
}

@media (max-width: 768px) {
  .coach-avatar-card {
    margin: 6px 8px;
    padding: 10px 12px;
    gap: 10px;
  }
}

.engine-plan {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  font-size: 11px;
  line-height: 1.4;
}

.section-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #71717a;
  margin-bottom: 2px;
}

.plan-zwischenzug {
  margin-top: 4px;
  font-size: 11px;
  color: #fde68a;
}
</style>
