<script setup lang="ts">
import {
  useCurrentTrainingPlanQuery,
  useNextTrainingPlanMutation,
} from '@/shared/api/queries/userCabinet.queries'
import {
  ChevronDownOutline,
  ChevronUpOutline,
  PlayOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NDataTable,
  NH3,
  NIcon,
  NModal,
  NProgress,
  NSpace,
  NText,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameLauncher } from '../lib/composables/useGameLauncher'

const message = useMessage()
const { t } = useI18n()
const { launchGame } = useGameLauncher()

const props = withDefaults(
  defineProps<{
    userStatus?: 'N' | 'P' | 'M'
    isExample?: boolean
    compact?: boolean
    activeTaskKey?: string | null
  }>(),
  {
    userStatus: 'N',
    isExample: false,
    compact: false,
    activeTaskKey: null,
  },
)

const statusMap: Record<string, string> = {
  N: 'Novice',
  P: 'Pro',
  M: 'Master',
}

const requestedLevel = computed(() => statusMap[props.userStatus] || 'Novice')

const { data: planData, isPending, error, refetch } = useCurrentTrainingPlanQuery(!props.isExample)
const { mutate: requestNextPlan, isPending: isRequesting } = useNextTrainingPlanMutation()

const planDateStr = computed(() => planData.value?.date || '')
const todayDateStr = computed(() => new Date().toISOString().split('T')[0]!)

const isYesterday = computed(() => {
  if (!planDateStr.value) return false
  return planDateStr.value < todayDateStr.value
})

const isToday = computed(() => planDateStr.value === todayDateStr.value)
const isCompleted = computed(() => (planData.value?.overall_progress_percent || 0) >= 100)

const currentPlanLevel = computed(() => planData.value?.plan?.level || 'Novice')

const isRefreshing = ref(false)
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await refetch()
    message.success(t('features.userCabinet.trainingPlan.refreshed') || 'Plan refreshed')
  } finally {
    isRefreshing.value = false
  }
}

const showUpgradeModal = ref(false)
const upgradeMessage = ref('')

const handleRequestPlan = () => {
  requestNextPlan(requestedLevel.value, {
    onSuccess: (res) => {
      if (res.type === 'CONGRATULATIONS') {
        upgradeMessage.value = res.message || ''
        showUpgradeModal.value = true
      } else {
        message.success(res.message || 'Plan requested')
      }
    },
    onError: (err: Error) => {
      const error = err as Error & { response?: { data?: { message?: string } } }
      message.error(error.response?.data?.message || 'Error requesting plan')
    },
  })
}

const mapModeForLauncher = (mode: string) => {
  if (mode === 'THEORY_ENDING') return 'theory'
  if (mode === 'PRACTICAL_CHESS') return 'practical'
  if (mode === 'FINISH_HIM') return 'finish_him'
  if (mode === 'TORNADO') return 'tornado'
  return mode
}

interface TrainingPlanRow {
  key: string
  mode: string
  sub_mode: string
  theme: string
  count: number
  current_solved: number
  is_done: boolean
}

const getModeLabel = (mode: string) => {
  const modeMap: Record<string, string> = {
    THEORY_ENDING: 'gameModes.theoryEndgames',
    PRACTICAL_CHESS: 'gameModes.practicalChess',
    FINISH_HIM: 'gameModes.finishHim',
    TORNADO: 'gameModes.tornado',
  }
  const key = modeMap[mode] || mode
  return t(key)
}

const getThemeLabel = (mode: string, theme: string) => {
  const isTornado = mode === 'TORNADO'
  const finalTheme = theme === 'rook' ? 'rookPawn' : theme
  const i18nKey = isTornado ? `chess.tactics.${finalTheme}` : `chess.themes.${finalTheme}`
  return t(i18nKey)
}

const columns = computed<DataTableColumns<TrainingPlanRow>>(() => [
  {
    title: t('features.userCabinet.trainingPlan.columns.mode'),
    key: 'mode',
    render: (row: TrainingPlanRow) => getModeLabel(row.mode),
  },
  { title: t('features.userCabinet.trainingPlan.columns.subMode'), key: 'sub_mode' },
  {
    title: t('features.userCabinet.trainingPlan.columns.theme'),
    key: 'theme',
    render: (row: TrainingPlanRow) => getThemeLabel(row.mode, row.theme),
  },
  {
    title: t('features.userCabinet.trainingPlan.columns.progress'),
    key: 'progress',
    align: 'center',
    titleAlign: 'center',
    render: (row: TrainingPlanRow) =>
      h(
        NProgress,
        {
          type: 'line',
          color: '#b000ff',
          percentage:
            row.count > 0 ? Math.min(100, Math.round((row.current_solved / row.count) * 100)) : 0,
          indicatorPlacement: 'inside',
        },
        {
          default: () =>
            h(
              'span',
              { style: 'color: #fff; font-weight: 500; text-shadow: 0 0 2px #000;' },
              `${row.current_solved} / ${row.count}`,
            ),
        },
      ),
  },
  {
    title: t('features.userCabinet.trainingPlan.columns.action'),
    key: 'action',
    align: 'right',
    titleAlign: 'right',
    render: (row: TrainingPlanRow) =>
      h(
        NButton,
        {
          size: 'small',
          type: row.is_done ? 'default' : 'primary',
          disabled: row.is_done || isCompleted.value,
          onClick: () =>
            launchGame({
              mode: mapModeForLauncher(row.mode) as
                | 'theory'
                | 'practical'
                | 'finish_him'
                | 'tornado',
              subMode: row.sub_mode,
              theme: row.theme === 'rook' ? 'rookPawn' : row.theme,
              difficulty: currentPlanLevel.value,
            }),
        },
        {
          default: () =>
            row.is_done
              ? t('features.userCabinet.trainingPlan.actions.done')
              : t('features.userCabinet.trainingPlan.actions.play'),
        },
      ),
  },
])

const tableData = computed(() => {
  if (!planData.value?.plan?.tasks) return []

  const data: TrainingPlanRow[] = []
  planData.value.plan.tasks.forEach((task) => {
    task.themes.forEach((theme) => {
      data.push({
        key: `${task.mode}-${task.sub_mode}-${theme.name}`,
        mode: task.mode,
        sub_mode: task.sub_mode,
        theme: theme.name,
        count: theme.count,
        current_solved: theme.current_solved || 0,
        is_done: theme.is_done || false,
      })
    })
  })
  return data
})

const isExpanded = ref(false)

const visibleTableData = computed(() => {
  if (!props.compact) return tableData.value

  if (isExpanded.value) {
    if (!props.activeTaskKey) return tableData.value
    const activeRow = tableData.value.find((r) => r.key === props.activeTaskKey)
    const otherRows = tableData.value.filter((r) => r.key !== props.activeTaskKey)
    return activeRow ? [activeRow, ...otherRows] : tableData.value
  }

  if (props.activeTaskKey) {
    const activeRow = tableData.value.find((r) => r.key === props.activeTaskKey)
    if (activeRow) return [activeRow]
  }

  return tableData.value
})
</script>

<template>
  <div class="training-plan-widget">
    <n-card :bordered="false" class="plan-card">
      <n-space vertical size="large">
        <n-space align="center" justify="space-between">
          <n-h3 style="margin-bottom: 0">
            📅
            {{
              isYesterday
                ? t('features.userCabinet.trainingPlan.yesterdayTitle')
                : t('features.userCabinet.trainingPlan.title')
            }}
          </n-h3>
          <n-button
            v-if="planData?.active"
            circle
            quaternary
            :loading="isRefreshing"
            @click="handleRefresh"
          >
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
          </n-button>
        </n-space>

        <!-- Loading / Error -->
        <n-text v-if="isPending" depth="3">{{
          t('features.userCabinet.trainingPlan.loading')
        }}</n-text>
        <n-text v-else-if="error" type="error">{{
          t('features.userCabinet.trainingPlan.error')
        }}</n-text>

        <!-- No Active Plan -->
        <template v-else-if="!planData?.active">
          <n-text depth="3">{{ t('features.userCabinet.trainingPlan.noPlan') }}</n-text>
          <n-button type="primary" size="large" :loading="isRequesting" @click="handleRequestPlan">
            {{ t('features.userCabinet.trainingPlan.requestButton', { level: requestedLevel }) }}
          </n-button>
        </template>

        <!-- Active Plan -->
        <template v-else-if="planData?.plan">
          <!-- Status Banners -->
          <div v-if="isYesterday && !isCompleted" class="status-banner warning">
            <n-text strong>
              {{ t('features.userCabinet.trainingPlan.completeYesterdayFirst') }}
            </n-text>
          </div>

          <div v-if="isYesterday && isCompleted" class="status-banner success">
            <n-text strong>
              {{ t('features.userCabinet.trainingPlan.yesterdayCompleted') }}
            </n-text>
            <n-button type="primary" :loading="isRequesting" @click="handleRequestPlan">
              {{ t('features.userCabinet.trainingPlan.getTodayPlan') }}
            </n-button>
          </div>

          <div v-if="isToday && isCompleted" class="status-banner info">
            <n-text strong>
              {{ t('features.userCabinet.trainingPlan.planCompleted') }}
            </n-text>
          </div>

          <div class="plan-header">
            <n-space align="center">
              <n-text v-if="planData.current_streak !== undefined" strong>
                {{ t('features.userCabinet.trainingPlan.streak') }}: {{ planData.current_streak }}
              </n-text>
              <n-text v-if="planData.plan?.level" depth="3">
                | {{ t(`common.difficulties.level_${planData.plan.level.toLowerCase()}`) }}
              </n-text>
            </n-space>
            <n-text
              v-if="planData.overall_progress_percent !== undefined"
              style="margin-left: auto"
            >
              {{ t('features.userCabinet.trainingPlan.overallProgress') }}:
              {{ planData.overall_progress_percent }}%
            </n-text>
          </div>

          <!-- Progress Bar Overall -->
          <n-progress
            v-if="planData.overall_progress_percent !== undefined"
            type="line"
            :percentage="planData.overall_progress_percent"
            color="#b000ff"
            style="margin-bottom: 12px"
          />

          <template v-if="!compact">
            <n-data-table :columns="columns" :data="tableData" :bordered="false" size="small" />
          </template>
          <template v-else>
            <div class="compact-task-list">
              <div
                v-for="row in visibleTableData"
                :key="row.key"
                class="compact-task-item"
                :class="{ 'is-done': row.is_done, 'is-active': row.key === activeTaskKey }"
              >
                <div class="compact-task-header">
                  <n-text strong>{{ getModeLabel(row.mode) }}</n-text>
                  <n-text depth="3" style="font-size: 0.85em"
                    >{{ getThemeLabel(row.mode, row.theme) }} ({{ row.sub_mode }})</n-text
                  >
                </div>
                <div class="compact-action-row">
                  <n-progress
                    type="line"
                    :color="row.is_done ? '#18a058' : '#b000ff'"
                    :percentage="
                      row.count > 0
                        ? Math.min(100, Math.round((row.current_solved / row.count) * 100))
                        : 0
                    "
                    indicator-placement="inside"
                    style="flex-grow: 1"
                  >
                    <span style="color: #fff; font-weight: 500; text-shadow: 0 0 2px #000"
                      >{{ row.current_solved }} / {{ row.count }}</span
                    >
                  </n-progress>
                  <n-button
                    v-if="row.key !== activeTaskKey"
                    size="tiny"
                    :type="row.is_done ? 'default' : 'primary'"
                    :disabled="row.is_done || isCompleted"
                    @click="
                      launchGame({
                        mode: mapModeForLauncher(row.mode) as
                          | 'theory'
                          | 'practical'
                          | 'finish_him'
                          | 'tornado',
                        subMode: row.sub_mode,
                        theme: row.theme === 'rook' ? 'rookPawn' : row.theme,
                        difficulty: currentPlanLevel,
                      })
                    "
                  >
                    <template #icon v-if="!row.is_done">
                      <n-icon><PlayOutline /></n-icon>
                    </template>
                    {{ row.is_done ? t('features.userCabinet.trainingPlan.actions.done') : '' }}
                  </n-button>
                </div>
              </div>

              <n-button
                v-if="compact && tableData.length > 1"
                quaternary
                block
                size="small"
                @click="isExpanded = !isExpanded"
              >
                <template #icon>
                  <n-icon>
                    <ChevronUpOutline v-if="isExpanded" />
                    <ChevronDownOutline v-else />
                  </n-icon>
                </template>
              </n-button>
            </div>
          </template>
        </template>
      </n-space>
    </n-card>

    <n-modal
      v-model:show="showUpgradeModal"
      preset="card"
      style="max-width: 400px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('features.userCabinet.trainingPlan.upgradeTitle')"
    >
      <n-space vertical :size="24">
        <n-text style="font-size: 1.1em; line-height: 1.5">
          {{ upgradeMessage }}
        </n-text>
        <n-button type="primary" size="large" block @click="showUpgradeModal = false">
          {{ t('features.userCabinet.trainingPlan.awesome') }}
        </n-button>
      </n-space>
    </n-modal>
  </div>
</template>

<style scoped>
.plan-card {
  margin-top: 24px;
  border-radius: var(--panel-border-radius);
  background-color: #1a1b26; /* Solider dunkler Hintergrund */
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@media (max-width: 600px) {
  .plan-card :deep(.n-card-content) {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  .plan-card :deep(.n-h3) {
    font-size: 1rem !important;
  }

  .plan-card :deep(.n-data-table-th) {
    font-size: 0.8rem !important;
    padding: 8px 4px !important;
  }

  .plan-card :deep(.n-data-table-td) {
    font-size: 0.8rem !important;
    padding: 8px 4px !important;
  }

  .plan-card :deep(.n-button) {
    font-size: 0.75rem !important;
    padding: 0 8px !important;
  }

  .plan-header {
    font-size: 0.85rem;
  }

  .complete-banner n-text {
    font-size: 0.9em !important;
  }
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

:deep(.n-data-table-th) {
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  color: var(--color-text-primary) !important;
}

.complete-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 16px;
  border-radius: 8px;
  background-color: rgba(176, 0, 255, 0.1);
  border: 1px solid rgba(176, 0, 255, 0.3);
}

.status-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.status-banner.warning,
.status-banner.success,
.status-banner.info {
  background-color: rgba(176, 0, 255, 0.1);
  border: 1px solid rgba(176, 0, 255, 0.3);
}

.status-banner.warning :deep(.n-text),
.status-banner.success :deep(.n-text),
.status-banner.info :deep(.n-text) {
  color: #fff;
  text-shadow: 0 0 2px #000;
}

.compact-task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compact-task-item {
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s ease;
}

.compact-task-item.is-done {
  opacity: 0.7;
}

.compact-task-item.is-active {
  border-color: #b000ff;
}

.compact-task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.compact-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
