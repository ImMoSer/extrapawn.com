<script setup lang="ts">
import {
  usePlanStreakLeaderboardQuery,
  useTopTodayLeaderboardQuery,
  useUnifiedDashboardQuery,
} from '@/shared/api/queries/leaderboard.queries'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Import child components
import {
  PlanStreakLeaderboardTable,
  SkillLeaderboardTable,
  TimedModeLeaderboardTable,
} from '@/features/leaderboards'

const { t } = useI18n()

// Vue Query fetching
const { data: dashboardData, isFetching: isDashboardLoading } = useUnifiedDashboardQuery(
  true,
)

// Top Today Query
const { data: topTodayResponse, isFetching: isTopTodayLoading } = useTopTodayLeaderboardQuery(
  true,
)

// Plan Streak Query
const { data: planStreakResponse, isFetching: isPlanStreakLoading } = usePlanStreakLeaderboardQuery(
  true,
)

const strategicTabs = computed(() => [
  { id: 'practical_chess', name: t('shared.gameModes.practicalChess'), icon: '' },
  { id: 'theory_endings', name: t('shared.gameModes.theoryEndgames'), icon: '' },
  { id: 'finish_him', name: t('shared.gameModes.finishHim'), icon: '' },
  { id: 'tactics', name: t('shared.gameModes.tactics'), icon: '' },
])

const isLoading = computed(() => {
  return isTopTodayLoading.value || isDashboardLoading.value || isPlanStreakLoading.value
})
</script>

<template>
  <div class="p-2 md:p-4 flex flex-col gap-6 w-full max-w-[1000px] mx-auto my-6">
    <h1 class="font-display text-4xl md:text-6xl font-black text-center my-4 py-2 relative inline-block mx-auto tracking-wider bg-gradient-to-r from-neon-cyan via-neon-purple to-highlight bg-clip-text text-transparent after:content-[''] after:absolute after:-bottom-1 after:-left-[15%] after:w-[130%] after:h-[3px] after:bg-gradient-to-r after:from-highlight after:to-neon-purple after:blur-[2px] after:rounded after:opacity-80 after:shadow-[0_0_15px_var(--color-highlight)]">
      HALL OF FAME
    </h1>

    <div v-if="isLoading" class="p-4 text-center bg-surface border border-border rounded-lg max-w-[600px] mx-auto text-text-secondary shadow-flat">
      <n-spin size="small" /> {{ t('shared.app.loading') }}
    </div>

    <div v-else class="flex flex-col gap-10">
      <!-- SECTION: HALL OF FAME (Overall) -->
      <section class="flex flex-col gap-5">
        <div class="grid grid-cols-1 gap-6">
          <PlanStreakLeaderboardTable
            title="TrainingPlanStreak"
            :entries="planStreakResponse || { Novice: [], Pro: [], Master: [] }"
            color-class="planStreak"
            :is-loading="isPlanStreakLoading"
          />

          <SkillLeaderboardTable
            :title="t('features.leaderboards.titles.topToday')"
            :entries="topTodayResponse?.entries || []"
            color-class="topToday"
            :is-loading="isTopTodayLoading"
          />
        </div>

        <TimedModeLeaderboardTable
          :title="t('features.leaderboards.titles.overallSkill')"
          :data="dashboardData"
          :tabs="[{ id: 'overall', name: t('shared.app.global', 'Global'), icon: '' }]"
          :is-loading="isDashboardLoading"
          color-class="topToday"
        />
      </section>

      <!-- SECTION: COMPETITIVE (Modes) -->
      <section class="flex flex-col gap-5">
        <h2 class="text-xl font-display font-bold uppercase tracking-widest text-text-secondary border-b border-border pb-3 flex items-center gap-5">
          {{ t('features.leaderboards.sections.competitive') }}
        </h2>
        <div class="grid grid-cols-1 gap-6">
          <!-- Strategic Mastery -->
          <TimedModeLeaderboardTable
            title="Puzzle Master"
            :data="dashboardData"
            :tabs="strategicTabs"
            :is-loading="isDashboardLoading"
            color-class="theoryLeaderboard"
          />
        </div>
      </section>
    </div>
  </div>
</template>
