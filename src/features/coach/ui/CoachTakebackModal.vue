<template>
  <n-modal
    v-model:show="coachStore.takebackModalVisible"
    preset="card"
    title="Coach Intervention"
    :style="{ width: '400px', maxWidth: '90vw' }"
    :mask-closable="false"
    :closable="false"
  >
    <div class="takeback-content">
      <p>Wait, that was a <strong>{{ coachStore.takebackQuality }}</strong>! Take back the move?</p>
    </div>
    <template #action>
      <div class="actions">
        <n-button @click="handleReject" type="default">
          Don't Believe
        </n-button>
        <n-button @click="handleAccept" type="primary">
          Move Back
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useCoachStore } from '../model/coach.store'
import { NModal, NButton } from 'naive-ui'

const coachStore = useCoachStore()

function handleAccept() {
  coachStore.resolveTakeback(true)
}

function handleReject() {
  coachStore.resolveTakeback(false)
}
</script>

<style scoped>
.takeback-content {
  font-size: 1.1em;
  text-align: center;
  margin-bottom: 1rem;
  color: #fff;
}
.takeback-content strong {
  text-transform: uppercase;
  color: #d03050; /* Basic error red color */
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
