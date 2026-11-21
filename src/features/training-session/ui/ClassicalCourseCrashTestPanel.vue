<script setup lang="ts">
import type { TacticsCourseCurriculumDTO, TacticsCourseSlug } from '@/entities/training'
import {
  DownloadOutline,
  FlagOutline,
  PlayOutline,
  RefreshOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NInputNumber, NPopconfirm } from 'naive-ui'
import { ref, watch } from 'vue'
import {
  downloadCrashTestReport,
  resetCrashTestReport,
  useCrashTestReport,
} from '../lib/crashTestReportLogger'

const props = defineProps<{
  courseSlug: TacticsCourseSlug
  isEndgameCourse: boolean
  curriculum: TacticsCourseCurriculumDTO | null
  crashTestTotal: number
  isStartingSession: boolean
}>()

const emit = defineEmits<{
  startOrResume: []
  jump: [zeroBasedIndex: number]
  restart: []
}>()

const { report: crashTestReport, anomaliesCount } = useCrashTestReport()
const jumpIndexInput = ref<number | null>(1)
const showFlagsPanel = ref<boolean>(false)

watch(
  () => props.curriculum?.crash_test_index,
  (idx) => {
    if ((idx ?? 0) > 0) {
      jumpIndexInput.value = (idx ?? 0) + 1
    }
  },
  { immediate: true },
)

function handleJump(): void {
  const maxIdx = Math.max(0, props.crashTestTotal - 1)
  const targetOneBased = jumpIndexInput.value ?? 1
  const zeroBased = Math.max(0, Math.min(maxIdx, Math.floor(targetOneBased) - 1))
  emit('jump', zeroBased)
}

function handleDownload(): void {
  downloadCrashTestReport()
}

function handleClearReport(): void {
  resetCrashTestReport(props.crashTestTotal)
}
</script>

<template>
  <div class="p-3.5 sm:p-4 rounded-lg bg-surface border border-warning/40 flex flex-col gap-3">
    <div class="flex flex-col @5xl:flex-row @5xl:items-center @5xl:justify-between gap-3">
      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40"
          >
            {{
              isEndgameCourse
                ? `КРЭШ-ТЕСТ 4 КУРСОВ ЭНДШПИЛЯ · ${crashTestTotal} ПОЗИЦИЙ В 1 ДАМП`
                : `КРЭШ-ТЕСТ 3 КУРСОВ ТАКТИКИ · ${crashTestTotal} ЗАДАЧ В 1 ДАМП`
            }}
          </span>
          <span v-if="curriculum" class="font-condensed font-bold text-sm text-text-primary">
            Позиция: #{{ Math.min(crashTestTotal, (curriculum.crash_test_index ?? 0) + 1) }} /
            {{ crashTestTotal }} · Решено: {{ curriculum.crash_test_solved ?? 0 }} · Ошибок:
            {{ curriculum.crash_test_failed ?? 0 }}
          </span>
          <span
            class="px-2 py-0.5 rounded-sm text-[11px] font-condensed bg-elevated border border-border text-text-secondary"
          >
            Лог в браузере: проверено {{ crashTestReport.processed_count }} · аномалий
            {{ anomaliesCount }}
          </span>
        </div>
        <p class="text-xs text-text-secondary">
          <template v-if="isEndgameCourse">
            Сквозной прогон всех {{ crashTestTotal }} позиций 4 курсов эндшпиля в одном дампе
            (разыгрывание против MOZERO по правилам FIDE). Все ошибки сохраняются в браузере
            (`localStorage`) для выгрузки `craschTestReport.json`.
          </template>
          <template v-else>
            Сквозной прогон всех {{ crashTestTotal }} задач 3 курсов тактики в одном дампе. Все
            ошибки сохраняются в браузере (`localStorage`) для выгрузки `craschTestReport.json`.
          </template>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-text-secondary font-condensed">Задача #:</span>
          <NInputNumber
            v-model:value="jumpIndexInput"
            size="small"
            :min="1"
            :max="crashTestTotal"
            class="w-24"
          />
          <NButton size="small" secondary :loading="isStartingSession" @click="handleJump">
            Перейти
          </NButton>
        </div>

        <NButton
          v-if="curriculum?.crash_test_active"
          size="small"
          quaternary
          type="warning"
          :loading="isStartingSession"
          @click="emit('restart')"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          С начала (#1)
        </NButton>

        <NButton
          size="small"
          type="warning"
          :loading="isStartingSession"
          @click="emit('startOrResume')"
        >
          <template #icon>
            <NIcon><PlayOutline /></NIcon>
          </template>
          {{
            curriculum?.crash_test_active
              ? `Продолжить (#${Math.min(crashTestTotal, (curriculum.crash_test_index ?? 0) + 1)})`
              : `Крэш-Тест (${crashTestTotal})`
          }}
        </NButton>

        <NButton size="small" secondary type="info" @click="handleDownload">
          <template #icon>
            <NIcon><DownloadOutline /></NIcon>
          </template>
          JSON ({{ anomaliesCount }})
        </NButton>

        <NPopconfirm
          v-if="crashTestReport.processed_count > 0 || anomaliesCount > 0"
          positive-text="Очистить"
          negative-text="Отмена"
          @positive-click="handleClearReport"
        >
          <template #trigger>
            <NButton size="small" quaternary type="error">
              <template #icon>
                <NIcon><TrashOutline /></NIcon>
              </template>
            </NButton>
          </template>
          Очистить локальный отчёт craschTestReport.json в браузере?
        </NPopconfirm>

        <NButton
          v-if="curriculum && (curriculum.flagged_puzzles?.length ?? 0) > 0"
          size="small"
          secondary
          @click="showFlagsPanel = !showFlagsPanel"
        >
          <template #icon>
            <NIcon><FlagOutline /></NIcon>
          </template>
          Флаги ({{ curriculum.flagged_puzzles?.length ?? 0 }})
        </NButton>
      </div>
    </div>

    <div
      v-if="showFlagsPanel && curriculum && (curriculum.flagged_puzzles?.length ?? 0) > 0"
      class="pt-3 border-t border-border flex flex-col gap-2"
    >
      <div class="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary">
        Отмеченные задачи на проверку ({{ curriculum.flagged_puzzles?.length ?? 0 }})
      </div>
      <div
        class="max-h-48 overflow-y-auto divide-y divide-border/50 rounded-sm border border-border bg-elevated/30"
      >
        <div
          v-for="fl in curriculum.flagged_puzzles ?? []"
          :key="fl.puzzle_id"
          class="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-condensed font-bold text-warning">
              {{ fl.puzzle_id }}
            </span>
            <span
              class="px-1.5 py-0.2 rounded-sm text-[10px] font-condensed bg-surface border border-border text-text-secondary"
            >
              Батч #{{ fl.batch_id }}
            </span>
            <span class="text-text-primary truncate">
              {{ fl.comment }}
            </span>
          </div>
          <span class="font-condensed text-[11px] text-text-secondary shrink-0">
            {{ fl.created_at }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
