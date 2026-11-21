<script setup lang="ts">
import { resolveDisciplineLabel, type TrainingDiscipline } from '@/entities/training'
import { CheckmarkCircleOutline, FlameOutline, PlayOutline } from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  discipline: TrainingDiscipline
  pendingCount: number
  canStart: boolean
  isStarting: boolean
}>()

const emit = defineEmits<{
  startBatch: []
}>()

const { t } = useI18n()

const disciplineLabel = computed(() => resolveDisciplineLabel(props.discipline, t))
</script>

<template>
  <section
    class="p-3.5 @3xl:p-5 rounded-lg bg-surface border flex flex-col @xl:flex-row @xl:items-center @xl:justify-between gap-3"
    :class="pendingCount > 0 ? 'border-accent/40' : 'border-border'"
  >
    <div class="flex items-center gap-3 min-w-0">
      <div
        class="w-10 h-10 rounded-md border flex items-center justify-center shrink-0"
        :class="
          pendingCount > 0
            ? 'bg-accent/15 border-accent/40 text-accent'
            : 'bg-success/10 border-success/30 text-success'
        "
      >
        <NIcon size="20">
          <FlameOutline v-if="pendingCount > 0" />
          <CheckmarkCircleOutline v-else />
        </NIcon>
      </div>

      <div class="flex flex-col gap-0.5 min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <h2
            class="font-display font-bold text-sm uppercase tracking-wider truncate"
            :class="pendingCount > 0 ? 'text-accent' : 'text-text-primary'"
          >
            {{ t('features.trainingCenter.woodpecker.batchTitle') }} · {{ disciplineLabel }}
          </h2>
        </div>

        <p v-if="pendingCount > 0" class="text-xs text-text-secondary">
          {{ t('features.trainingCenter.woodpecker.batchRuleHint') }}
        </p>
        <p v-else class="text-xs text-text-secondary">
          {{ t('features.trainingCenter.woodpecker.batchEmptyHint') }}
        </p>
      </div>
    </div>

    <div class="flex items-center justify-between @xl:justify-end gap-3 shrink-0">
      <div v-if="pendingCount > 0" class="flex items-baseline gap-1.5">
        <span class="font-condensed font-bold text-2xl text-warning">
          {{ pendingCount }}
        </span>
        <span class="text-xs text-text-secondary">
          {{ t('features.trainingCenter.woodpecker.batchRemainingLabel') }}
        </span>
      </div>

      <NButton
        v-if="pendingCount > 0 && canStart"
        type="primary"
        :loading="isStarting"
        @click="emit('startBatch')"
      >
        <template #icon>
          <NIcon><PlayOutline /></NIcon>
        </template>
        {{ t('features.trainingCenter.woodpecker.startBatchBtn') }}
      </NButton>
    </div>
  </section>
</template>
