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
  <div class="p-1.5 md:p-1.5 flex flex-col gap-6 w-full max-w-[1000px] mx-auto my-6">
    <h1 class="brand-text hall-of-fame-title">HALL OF FAME</h1>

    <div v-if="isLoading" class="p-3 text-center bg-surface border border-border rounded-md max-w-[600px] mx-auto text-text-secondary">
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
        <h2 class="text-xl font-bold uppercase tracking-widest text-text-secondary border-b border-border pb-3 flex items-center gap-5">
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

<style scoped>
.hall-of-fame-title {
  margin: 0;
  font-size: clamp(2rem, 6vw, 4.5rem);
  line-height: 1;
  text-align: center;
  align-self: center;
  padding: 20px 0 10px;
  position: relative;
  display: inline-block;
  margin: 0 auto;
}

.hall-of-fame-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: -15%;
  width: 130%;
  height: 3px;
  background: linear-gradient(90deg, var(--color-highlight), var(--color-neon-purple));
  filter: blur(2px);
  border-radius: 2px;
  opacity: 0.8;
  box-shadow: 0 0 15px var(--color-highlight);
}
</style>
