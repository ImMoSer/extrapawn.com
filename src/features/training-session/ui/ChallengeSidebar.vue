<script setup lang="ts">
import {
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  EyeOutline,
  FlagOutline,
  RefreshOutline,
  TimeOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NScrollbar } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../model/challenge.store'

const { t, te } = useI18n()
const router = useRouter()
const store = useChallengeStore()
const authStore = useAuthStore()
const uiStore = useUiStore()

const state = computed(() => store.challengeState)
const puzzle = computed(() => store.currentPuzzle)
const myEntry = computed(() => store.myEntry)

const disciplineLabel = computed(() =>
  state.value ? resolveDisciplineLabel(state.value.discipline, t) : '',
)

const difficultyLabel = computed(() =>
  state.value ? resolveDifficultyLabel(state.value.difficulty, t) : '',
)

const categoryLabel = computed(() => {
  if (!puzzle.value) return ''
  return resolveScopeLabel('scopes', puzzle.value.category, t, te)
})

const botName = computed(() => ENGINE_NAMES[store.activeBotEngine] ?? store.activeBotEngine)

const showBotInfo = computed(() => state.value && state.value.discipline !== 'tactics')

const solvedParticipantsCount = computed(
  () => store.leaderboard.filter((p) => p.solved).length,
)

async function handleGiveUpAndAnalyze(): Promise<void> {
  const confirmed = await uiStore.showConfirmation(
    t('features.trainingCenter.challenge.confirmSurrenderTitle'),
    t('features.trainingCenter.challenge.confirmSurrenderMessage'),
    {
      confirmText: t('features.trainingCenter.challenge.confirmSurrenderBtn'),
      cancelText: t('shared.buttons.cancel'),
      showCancel: true,
    },
  )

  if (confirmed === 'confirm') {
    await store.surrenderAndAnalyze()
  }
}

function goToTrainingCenter(): void {
  store.stopChallenge()
  void router.push('/training')
}

function goToChallengeRecords(): void {
  store.stopChallenge()
  void router.push('/challenge/records')
}
</script>

<template>
  <div
    class="h-full flex flex-col gap-3 p-3 bg-surface/90 backdrop-blur-md border-r border-border text-text-primary select-none overflow-hidden"
  >
    <!-- Challenge Header -->
    <div v-if="state" class="flex flex-col gap-2 pb-2 border-b border-border shrink-0">
      <div class="flex items-center justify-between gap-2">
        <span class="font-display font-bold text-sm uppercase tracking-wider text-neon-cyan truncate">
          {{ disciplineLabel }}
        </span>
        <span
          class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-elevated border border-border text-text-primary"
        >
          {{ t('features.trainingCenter.challenge.badge') }} · {{ difficultyLabel }}
        </span>
      </div>

      <div class="flex items-center justify-between text-xs text-text-secondary">
        <span class="truncate">
          #{{ state.puzzle_id }}
          <template v-if="categoryLabel"> · {{ categoryLabel }}</template>
        </span>
        <span v-if="showBotInfo" class="font-condensed text-text-primary shrink-0 ml-2">
          {{ botName }}
        </span>
      </div>
    </div>

    <!-- Current User Status / Action Banner -->
    <div
      v-if="store.isSolved && myEntry"
      class="p-3 rounded-md border bg-success/10 border-success/40 flex flex-col gap-2 shrink-0"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-success font-display font-bold text-xs uppercase tracking-wider">
          <NIcon size="16"><CheckmarkCircleOutline /></NIcon>
          <span>{{ t('features.trainingCenter.challenge.solvedBannerTitle') }}</span>
        </div>
        <span class="font-condensed font-bold text-sm text-success">
          {{ myEntry.score_text }} · {{ store.formatDurationMs(myEntry.solved_time_ms) }}
        </span>
      </div>

      <div class="pt-1">
        <NButton
          block
          size="small"
          type="primary"
          @click="store.enterAnalysis(false)"
        >
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>
      </div>
    </div>

    <div
      v-else-if="store.isSurrendered && myEntry"
      class="p-3 rounded-md border bg-warning/10 border-warning/40 flex flex-col gap-2 shrink-0"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-warning font-display font-bold text-xs uppercase tracking-wider">
          <NIcon size="16"><FlagOutline /></NIcon>
          <span>{{ t('features.trainingCenter.challenge.surrenderedBannerTitle') }}</span>
        </div>
        <span class="font-condensed font-bold text-sm text-warning">
          {{ myEntry.score_text }}
        </span>
      </div>

      <div class="pt-1">
        <NButton
          block
          size="small"
          type="primary"
          @click="store.enterAnalysis(false)"
        >
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>
      </div>
    </div>

    <div
      v-else-if="store.isAttemptFailed"
      class="p-3 rounded-md border bg-danger/10 border-danger/40 flex flex-col gap-2 shrink-0"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-danger font-display font-bold text-xs uppercase tracking-wider">
          <NIcon size="16"><CloseCircleOutline /></NIcon>
          <span>{{ t('features.trainingCenter.challenge.attemptFailedTitle') }}</span>
        </div>
        <span v-if="myEntry" class="font-condensed font-bold text-sm text-danger">
          {{ myEntry.score_text }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1">
        <NButton
          size="small"
          type="primary"
          :disabled="store.isSubmitting"
          @click="store.retryChallenge()"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.challenge.tryAgainBtn') }}
        </NButton>
        <NButton
          size="small"
          secondary
          :disabled="store.isSubmitting"
          @click="handleGiveUpAndAnalyze()"
        >
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>
      </div>
    </div>

    <!-- Active Attempt Info Strip -->
    <div
      v-else-if="store.isPlaying"
      class="px-3 py-2 rounded-md border border-border bg-elevated/50 flex items-center justify-between text-xs shrink-0"
    >
      <span class="text-text-secondary">
        {{
          t('features.trainingCenter.challenge.currentAttemptLabel', {
            attempt: (myEntry?.attempts ?? 0) + 1,
          })
        }}
      </span>
      <span v-if="myEntry" class="font-condensed font-bold text-text-primary">
        {{ myEntry.score_text }}
      </span>
    </div>

    <!-- Challenge Leaderboard List -->
    <div class="flex-1 flex flex-col min-h-0 border border-border rounded-md bg-elevated/30 overflow-hidden">
      <div class="px-3 py-1.5 bg-elevated/80 border-b border-border flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <NIcon size="14" class="text-warning"><TrophyOutline /></NIcon>
          <span class="font-display font-bold text-[11px] uppercase tracking-wider text-text-secondary">
            {{ t('features.trainingCenter.challenge.leaderboardTitle') }}
          </span>
        </div>
        <span class="font-condensed text-xs text-text-secondary">
          {{
            t('features.trainingCenter.challenge.solvedParticipantsRatio', {
              solved: solvedParticipantsCount,
              total: store.leaderboard.length,
            })
          }}
        </span>
      </div>

      <NScrollbar class="flex-1">
        <div
          v-if="store.leaderboard.length === 0"
          class="p-6 text-center text-xs text-text-secondary"
        >
          {{ t('features.trainingCenter.challenge.noParticipantsYet') }}
        </div>

        <div v-else class="divide-y divide-border/50">
          <div
            v-for="row in store.leaderboard"
            :key="row.user_id"
            class="flex items-center justify-between px-2.5 py-2 text-xs transition-colors"
            :class="[
              row.user_id === authStore.userProfile?.id
                ? 'bg-neon-cyan/10 border-l-2 border-l-neon-cyan'
                : row.solved
                  ? 'bg-success/5 border-l-2 border-l-success'
                  : 'bg-danger/5 border-l-2 border-l-danger',
            ]"
          >
            <!-- Left: Rank + Player Name + Status Badge -->
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span
                class="w-5 h-5 rounded-sm flex items-center justify-center font-condensed font-bold text-[11px] shrink-0 border"
                :class="[
                  row.solved && row.rank === 1
                    ? 'bg-warning/20 text-warning border-warning/50'
                    : row.solved
                      ? 'bg-success/15 text-success border-success/40'
                      : 'bg-elevated text-text-secondary border-border',
                ]"
              >
                {{ row.rank }}
              </span>

              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="truncate text-text-primary font-medium">
                    {{ row.username }}
                  </span>
                  <span
                    v-if="row.user_id === authStore.userProfile?.id"
                    class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40 shrink-0"
                  >
                    {{ t('features.leaderboards.sidebar.currentUser') }}
                  </span>
                  <span
                    v-if="row.status === 'surrendered'"
                    class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40 shrink-0"
                  >
                    {{ t('features.trainingCenter.challenge.surrenderedShort') }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Right: Score (1/N or 0/N) + Time -->
            <div class="flex items-center gap-2.5 shrink-0 ml-2">
              <span
                class="px-1.5 py-0.5 rounded-sm font-condensed font-bold text-[11px] border"
                :class="
                  row.solved
                    ? 'bg-success/15 text-success border-success/40'
                    : 'bg-danger/15 text-danger border-danger/40'
                "
              >
                {{ row.score_text }}
              </span>
              <span class="font-condensed text-[11px] text-text-secondary min-w-13 text-right flex items-center justify-end gap-0.5">
                <NIcon v-if="row.solved" size="11" class="text-warning"><TimeOutline /></NIcon>
                {{ row.solved ? store.formatDurationMs(row.solved_time_ms) : '--:--.-' }}
              </span>
            </div>
          </div>
        </div>
      </NScrollbar>
    </div>

    <!-- Footer Controls -->
    <div class="mt-auto pt-2 border-t border-border flex flex-col gap-2 shrink-0">
      <NButton block size="small" type="primary" secondary @click="goToChallengeRecords()">
        <template #icon>
          <NIcon><TrophyOutline /></NIcon>
        </template>
        {{ t('features.trainingCenter.challenge.openRecordsBtn') }}
      </NButton>
      <NButton block size="small" secondary @click="goToTrainingCenter()">
        {{ t('features.trainingCenter.actions.backToHub') }}
      </NButton>
    </div>
  </div>
</template>

