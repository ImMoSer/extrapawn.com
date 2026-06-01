<!-- src/features/leaderboards/ui/PlanStreakLeaderboardTable.vue -->
<script setup lang="ts">
import type { PlanStreakLeaderboardResponse, PlanStreakLeaderboardEntry } from '@/shared/types/api.types'
import type { DataTableColumns } from 'naive-ui'
import { computed, h, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { NTabs, NTabPane, NSpin, NEmpty, NDataTable } from 'naive-ui'

const props = defineProps({
  title: { type: String, required: true },
  entries: {
    type: Object as PropType<PlanStreakLeaderboardResponse>,
    required: true,
  },
  colorClass: { type: String, required: true },
  isLoading: { type: Boolean, default: false },
})

const { t } = useI18n()

const activeTab = ref<'Novice' | 'Pro' | 'Master'>('Novice')

const currentEntries = computed(() => {
  if (!props.entries) return []
  return props.entries[activeTab.value] || []
})

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
  Administrator: 'wK.svg',
}

const getSubscriptionIcon = (tierStr: string) => {
  const actualTier = tierStr && tierToPieceMap[tierStr] ? tierStr : 'Pawn'
  return `/piece/alpha/${tierToPieceMap[actualTier]}`
}

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return '-'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

const columns = computed<DataTableColumns<PlanStreakLeaderboardEntry>>(() => {
  return [
    {
      title: '#',
      key: 'rank',
      align: 'center',
      width: 40,
      render: (_, idx) => (idx + 1).toString(),
    },
    {
      title: t('features.leaderboards.table.player', 'Player'),
      key: 'username',
      minWidth: 120,
      ellipsis: { tooltip: true },
      render(row) {
        const tier = row.tier || 'Pawn'
        const id = row.id
        const icon = getSubscriptionIcon(tier)
        return h('div', { style: { display: 'flex', alignItems: 'center' } }, [
          icon ? h('img', { src: icon, class: 'tier-icon', style: { marginRight: '6px', width: '20px', height: '20px' } }) : null,
          h(
            'n-a',
            {
              href: `https://lichess.org/@/${id}`,
              target: '_blank',
              style: { fontWeight: 'bold' },
            },
            row.username,
          ),
        ])
      },
    },
    {
      title: t('features.leaderboards.table.streakDays', 'Streak'),
      key: 'current_streak',
      align: 'center' as const,
      width: 95,
      render: (row) => h('span', { style: { fontWeight: 'bold', color: '#e67e22' } }, `${row.current_streak || 0} 🔥`),
    },
    {
      title: t('features.leaderboards.table.plans', 'Plans'),
      key: 'completed_count',
      align: 'center' as const,
      width: 90,
      render: (row) => h('span', { style: { fontWeight: 'bold', color: '#2ecc71' } }, `${row.completed_count || 0} ✅`),
    },
    {
      title: t('features.leaderboards.table.solved', 'Solved'),
      key: 'puzzles_solved',
      align: 'center' as const,
      width: 90,
      render: (row) => h('span', { style: { fontWeight: 'bold' } }, row.puzzles_solved || 0),
    },
    {
      title: t('features.leaderboards.table.time', 'Time'),
      key: 'time_spent',
      align: 'center' as const,
      width: 100,
      render: (row) => h('span', { style: { fontFamily: 'monospace' } }, formatDuration(row.time_spent)),
    },
    {
      title: '%',
      key: 'accuracy',
      align: 'right' as const,
      width: 65,
      render(row) {
        const acc = row.accuracy
        if (acc === undefined || acc === null) return '-'
        return h(
          'span',
          {
            style: {
              color:
                acc > 70
                  ? 'var(--color-accent-success)'
                  : acc > 40
                    ? 'var(--color-accent-warning)'
                    : 'var(--color-accent-error)',
              fontWeight: 'bold',
            },
          },
          `${acc.toFixed(1)}%`,
        )
      },
    },
  ]
})
</script>

<template>
  <div class="records-card" :class="colorClass">
    <div class="card-header">
      <h3 class="card-title">
        {{ title }}
      </h3>
    </div>

    <div class="modes-container">
      <div v-if="isLoading" class="loading-wrapper">
        <NSpin size="large" />
      </div>
      <template v-else>
        <NTabs v-model:value="activeTab" type="segment" animated>
          <NTabPane name="Novice" tab="Novice" />
          <NTabPane name="Pro" tab="Pro" />
          <NTabPane name="Master" tab="Master" />
        </NTabs>
        <div class="table-container">
          <NDataTable
            v-if="currentEntries.length > 0"
            :columns="columns"
            :data="currentEntries"
            :row-key="(row: PlanStreakLeaderboardEntry) => row.id"
            size="small"
            striped
            class="records-table"
            :max-height="400"
            :scroll-x="400"
          />
          <NEmpty v-else :description="t('pages.userCabinet.stats.noData')" />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.records-card {
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border-radius: var(--panel-border-radius);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
}

.planStreak .card-title {
  color: #9b59b6;
}

.card-title {
  font-size: 1.4rem;
  margin: 0;
  text-align: center;
  font-weight: 800;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.modes-container {
  padding: 12px;
}

.loading-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.table-container {
  margin-top: 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.2);
}

.records-table {
  --n-td-color-striped: rgba(255, 255, 255, 0.035);
}

:deep(.n-data-table-th) {
  background-color: rgba(255, 255, 255, 0.05) !important;
  color: var(--color-text-muted) !important;
  font-family: var(--font-family-primary);
  font-size: 0.85rem;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 1px;
}

:deep(.n-data-table-td) {
  font-family: var(--font-family-primary);
  font-size: 0.95rem;
  padding: 10px 4px !important;
}

:deep(.n-tabs-tab) {
  font-family: var(--font-family-primary);
}

@media (max-width: 768px) {
  .card-header {
    padding: 11px 14px;
  }

  .card-title {
    font-size: 1rem;
    letter-spacing: 1px;
    gap: 8px;
  }

  :deep(.n-data-table-th) {
    font-size: 0.65rem;
  }
  
  :deep(.n-data-table-td) {
    font-size: 0.75rem;
    padding: 4px 2px !important;
  }

  .modes-container {
    padding: 2px;
  }
}
</style>
