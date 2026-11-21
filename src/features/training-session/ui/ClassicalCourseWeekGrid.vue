<script setup lang="ts">
import {
  resolveScopeLabel,
  type CourseBatchStatusDTO,
  type WoodpeckerCheckpointDTO,
} from '@/entities/training'
import {
  AlertCircleOutline,
  CheckmarkCircleOutline,
  FlameOutline,
  LockClosedOutline,
  PlayOutline,
  RefreshOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { ClassicalCourseWeekGroup } from '../model/classicalCourseMeta'

defineProps<{
  weeksList: ClassicalCourseWeekGroup[]
  isStartingSession: boolean
}>()

const emit = defineEmits<{
  launchBatch: [batch: CourseBatchStatusDTO]
  launchWoodpecker: [wp: WoodpeckerCheckpointDTO]
}>()

const { t, te } = useI18n()
</script>

<template>
  <div v-if="weeksList.length > 0" class="flex flex-col gap-5">
    <div v-for="wg in weeksList" :key="wg.week" class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2 border-b border-border pb-2 px-0.5">
        <span class="font-display font-bold text-sm uppercase tracking-wider text-text-primary">
          {{ wg.title }}
        </span>
        <span class="text-xs font-condensed text-text-secondary shrink-0">
          4 батча + 2 Дня Дятла
        </span>
      </div>

      <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-3">
        <template v-for="batch in wg.batches" :key="batch.batch_id">
          <!-- Batch Card -->
          <div
            class="p-3.5 rounded-md border flex flex-col justify-between gap-2.5 transition-colors"
            :class="[
              batch.is_failed_attempt
                ? 'bg-elevated border-danger/50 shadow-xs'
                : batch.is_current
                  ? 'bg-elevated border-brand shadow-xs'
                  : batch.is_completed
                    ? 'bg-surface border-success/40'
                    : batch.is_unlocked
                      ? 'bg-surface border-border hover:border-border-hover'
                      : 'bg-surface/40 border-border opacity-60',
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span
                    class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase border"
                    :class="
                      batch.is_failed_attempt
                        ? 'bg-danger/15 text-danger border-danger/40'
                        : batch.is_current
                          ? 'bg-brand text-on-brand border-brand'
                          : batch.is_completed
                            ? 'bg-success/15 text-success border-success/40'
                            : 'bg-elevated text-text-secondary border-border'
                    "
                  >
                    Батч #{{ batch.batch_id }}
                  </span>

                  <span
                    v-if="batch.is_failed_attempt"
                    class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-danger/10 text-danger border border-danger/40"
                  >
                    {{
                      t('features.trainingCenter.classical.batchFailedBadge', {
                        pct: batch.pass_percent ?? 0,
                      })
                    }}
                  </span>
                  <span
                    v-else-if="batch.is_completed"
                    class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-success/10 text-success border border-success/40"
                  >
                    {{ batch.pass_percent ?? 100 }}%
                  </span>

                  <span
                    v-if="batch.is_exam"
                    class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40"
                  >
                    ЭКЗАМЕН БЕЗ ПОДСКАЗОК
                  </span>
                  <span
                    v-else
                    class="px-2 py-0.5 rounded-sm text-[10px] font-condensed bg-surface border border-border text-text-secondary truncate"
                  >
                    {{ resolveScopeLabel('domain', batch.domain, t, te) }}
                  </span>
                </div>

                <div class="font-display font-semibold text-sm text-text-primary">
                  {{ batch.batch_title }}
                </div>

                <p v-if="batch.is_failed_attempt" class="text-[11px] text-danger leading-snug">
                  {{ t('features.trainingCenter.classical.batchFailedHint') }}
                </p>
              </div>

              <NIcon
                size="18"
                :class="
                  batch.is_failed_attempt
                    ? 'text-danger'
                    : batch.is_completed
                      ? 'text-success'
                      : batch.is_unlocked
                        ? 'text-brand'
                        : 'text-text-disabled'
                "
              >
                <AlertCircleOutline v-if="batch.is_failed_attempt" />
                <CheckmarkCircleOutline v-else-if="batch.is_completed" />
                <SparklesOutline v-else-if="batch.is_current" />
                <LockClosedOutline v-else-if="!batch.is_unlocked" />
                <PlayOutline v-else />
              </NIcon>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
              <div class="flex items-center gap-2 font-condensed text-xs min-w-0">
                <span class="text-text-primary font-bold">
                  {{ batch.solved_count }} / {{ batch.total_puzzles }}
                </span>
                <span class="text-text-secondary">решено</span>
                <span v-if="batch.failed_count > 0" class="text-warning">
                  · ошибок: {{ batch.failed_count }}
                </span>
              </div>

              <NButton
                size="tiny"
                class="min-w-0 shrink-0"
                :type="
                  batch.is_failed_attempt ? 'error' : batch.is_current ? 'primary' : 'default'
                "
                :secondary="!batch.is_current || batch.is_failed_attempt"
                :disabled="!batch.is_unlocked"
                :loading="isStartingSession && batch.is_current"
                @click="emit('launchBatch', batch)"
              >
                <template #icon>
                  <NIcon>
                    <RefreshOutline v-if="batch.is_failed_attempt || batch.is_completed" />
                    <PlayOutline v-else-if="batch.is_unlocked" />
                    <LockClosedOutline v-else />
                  </NIcon>
                </template>
                <span class="truncate">
                  {{
                    batch.is_failed_attempt || batch.is_completed
                      ? t('shared.buttons.retry')
                      : batch.is_current
                        ? t('features.trainingCenter.classical.startShort')
                        : batch.is_unlocked
                          ? t('features.trainingCenter.classical.openShort')
                          : t('features.trainingCenter.classical.lockedShort')
                  }}
                </span>
              </NButton>
            </div>
          </div>

          <!-- Woodpecker Checkpoint Banner after every 2nd batch -->
          <div
            v-if="batch.batch_id % 2 === 0 && wg.checkpoints[batch.batch_id]"
            class="@3xl:col-span-2 px-3.5 py-2.5 rounded-md border flex flex-col @2xl:flex-row @2xl:items-center @2xl:justify-between gap-2"
            :class="
              !wg.checkpoints[batch.batch_id]?.is_unlocked
                ? 'bg-surface/40 border-border opacity-70'
                : wg.checkpoints[batch.batch_id]?.is_failed_attempt
                  ? 'bg-danger/10 border-danger/50'
                  : wg.checkpoints[batch.batch_id]?.is_active
                    ? 'bg-warning/10 border-warning/50'
                    : wg.checkpoints[batch.batch_id]?.is_completed
                      ? 'bg-success/5 border-success/30'
                      : 'bg-surface/60 border-border'
            "
          >
            <div class="flex flex-wrap items-center gap-2 text-xs min-w-0">
              <NIcon
                size="16"
                :class="
                  !wg.checkpoints[batch.batch_id]?.is_unlocked
                    ? 'text-text-disabled'
                    : wg.checkpoints[batch.batch_id]?.is_failed_attempt
                      ? 'text-danger'
                      : wg.checkpoints[batch.batch_id]?.is_completed
                        ? 'text-success'
                        : wg.checkpoints[batch.batch_id]?.is_active
                          ? 'text-warning'
                          : 'text-text-secondary'
                "
              >
                <LockClosedOutline v-if="!wg.checkpoints[batch.batch_id]?.is_unlocked" />
                <AlertCircleOutline v-else-if="wg.checkpoints[batch.batch_id]?.is_failed_attempt" />
                <CheckmarkCircleOutline
                  v-else-if="wg.checkpoints[batch.batch_id]?.is_completed"
                />
                <FlameOutline v-else />
              </NIcon>
              <span class="font-display font-semibold text-text-primary">
                День Дятла #{{ wg.checkpoints[batch.batch_id]?.checkpoint_id }}
                (после Батчей #{{ batch.batch_id - 1 }}–#{{ batch.batch_id }})
              </span>
              <span class="font-condensed text-text-secondary">
                · В очереди ошибок:
                <strong
                  :class="
                    (wg.checkpoints[batch.batch_id]?.due_count ?? 0) > 0
                      ? 'text-warning'
                      : 'text-success'
                  "
                >
                  {{ wg.checkpoints[batch.batch_id]?.due_count ?? 0 }}
                </strong>
              </span>
              <span
                v-if="wg.checkpoints[batch.batch_id]?.is_failed_attempt"
                class="px-1.5 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-danger/15 text-danger border border-danger/40"
              >
                {{
                  t('features.trainingCenter.classical.batchFailedBadge', {
                    pct: wg.checkpoints[batch.batch_id]?.pass_percent ?? 0,
                  })
                }}
              </span>
            </div>

            <span
              v-if="!wg.checkpoints[batch.batch_id]?.is_unlocked"
              class="inline-flex items-center gap-1 font-condensed text-xs text-text-disabled shrink-0"
            >
              <NIcon size="13"><LockClosedOutline /></NIcon>
              {{
                t('features.trainingCenter.woodpecker.checkpointLocked', {
                  batch: batch.batch_id,
                })
              }}
            </span>
            <NButton
              v-else-if="(wg.checkpoints[batch.batch_id]?.due_count ?? 0) > 0"
              size="tiny"
              class="min-w-0 shrink-0"
              :type="wg.checkpoints[batch.batch_id]?.is_failed_attempt ? 'error' : 'warning'"
              :loading="isStartingSession"
              @click="emit('launchWoodpecker', wg.checkpoints[batch.batch_id]!)"
            >
              <template #icon>
                <NIcon>
                  <RefreshOutline v-if="wg.checkpoints[batch.batch_id]?.is_failed_attempt" />
                  <FlameOutline v-else />
                </NIcon>
              </template>
              <span class="truncate">
                {{
                  wg.checkpoints[batch.batch_id]?.is_failed_attempt
                    ? t('shared.buttons.retry')
                    : t('features.trainingCenter.classical.clearErrorsShort', {
                        count: wg.checkpoints[batch.batch_id]?.due_count ?? 0,
                      })
                }}
              </span>
            </NButton>
            <span
              v-else-if="wg.checkpoints[batch.batch_id]?.is_completed"
              class="font-condensed font-bold text-xs text-success shrink-0"
            >
              {{ t('features.trainingCenter.woodpecker.checkpointCleared') }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
