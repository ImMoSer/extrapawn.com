<script setup lang="ts">
import type { UnifiedLeaderboardEntry, UnifiedLeaderboardResponse } from '@/shared/types/api.types'
import type { DataTableColumns } from 'naive-ui'
import { computed, h, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

export interface LeaderboardTab {
  id: string
  name: string
  icon: string
}

const props = defineProps({
  title: { type: String, required: true },
  data: {
    type: Object as PropType<UnifiedLeaderboardResponse>,
    required: false,
    default: () => ({}),
  },
  tabs: { type: Array as PropType<LeaderboardTab[]>, required: true },
  colorClass: { type: String, required: true },
  isLoading: { type: Boolean, default: false },
})

const { t } = useI18n()

const activeTab = ref(props.tabs[0]?.id || '')

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
}

const getSubscriptionIcon = (tier?: string) => {
  const actualTier = tier && tierToPieceMap[tier] ? tier : 'Pawn'
  return `/piece/alpha/${tierToPieceMap[actualTier]}`
}

const columns = computed<DataTableColumns<UnifiedLeaderboardEntry>>(() => {
  const isOverall = activeTab.value === 'overall'
  return [
    {
      title: '#',
      key: 'rank',
      align: 'center',
      width: 30,
      render: (row) => row.rank || '-',
    },
    {
      title: t('features.leaderboards.table.player'),
      key: 'username',
      minWidth: 120,
      ellipsis: { tooltip: true },
      render(row) {
        const tier = row.tier || 'Pawn'
        const id = row.id
        const icon = getSubscriptionIcon(tier)
        return h('div', { style: { display: 'flex', alignItems: 'center' } }, [
          icon ? h('img', { src: icon, class: 'tier-icon', style: { marginRight: '6px' } }) : null,
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
      title: isOverall ? 'Score' : t('features.leaderboards.table.maxRating', 'maxRating'),
      key: isOverall ? 'score' : 'maxRating',
      align: 'center' as const,
      width: 85,
      render: (row) =>
        h('span', { class: 'mode-score-value' }, isOverall ? row.score : row.maxRating),
    },
    ...(!isOverall
      ? [
          {
            title: t('features.leaderboards.table.avgRating', 'Avg'),
            key: 'avgRating',
            align: 'center' as const,
            width: 85,
            render: (row: UnifiedLeaderboardEntry) =>
              h('span', { style: { color: 'var(--color-text-muted)' } }, row.avgRating),
          },
        ]
      : []),
    {
      title: t('features.leaderboards.table.bestDay', 'error'),
      key: 'highScore',
      align: 'center' as const,
      width: 100,
      render: (row) => h('span', { style: { fontWeight: 'bold' } }, row.highScore),
    },
    {
      title: t('features.leaderboards.table.activeDays', 'Days'),
      key: 'activeDays',
      align: 'center' as const,
      width: 100,
      render: (row) => row.activeDays,
    },
    {
      title: t('features.leaderboards.table.played'),
      key: 'played',
      align: 'center' as const,
      width: 100,
      render: (row) => row.solved + row.failed,
    },
    {
      title: '%',
      key: 'accuracy',
      align: 'right' as const,
      width: 45,
      render(row) {
        const total = row.solved + row.failed
        if (total === 0) return '-'
        const acc = (row.solved / total) * 100
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
          `${acc.toFixed(0)}`,
        )
      },
    },
  ]
})
</script>

<template>
  <div class="records-card" :class="colorClass">
    <div class="card-header main-header">
      <h3 class="card-title">
        {{ title }}
      </h3>
    </div>

    <div class="modes-container">
      <div v-if="isLoading" class="loading-wrapper">
        <n-spin size="large" />
      </div>
      <n-tabs v-else v-model:value="activeTab" type="segment" animated>
        <n-tab-pane v-for="tab in tabs" :key="tab.id" :name="tab.id">
          <template #tab>
            <div class="tab-label">
              <span class="tab-name">{{ tab.name }}</span>
            </div>
          </template>
          <div class="mode-table-wrapper">
            <n-data-table
              :columns="columns"
              :data="
                [...(data[tab.id] || [])]
                  .sort((a, b) => {
                    if (tab.id === 'overall') return (b.score || 0) - (a.score || 0)
                    return b.solved - a.solved
                  })
                  .map((row, idx) => ({ ...row, rank: row.rank || (idx + 1).toString() }))
              "
              :row-key="(row: UnifiedLeaderboardEntry) => row.id"
              size="small"
              striped
              class="records-table"
              :max-height="400"
              :scroll-x="400"
            />
          </div>
        </n-tab-pane>
      </n-tabs>
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
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  height: 100%;
}

.main-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
}

.tornadoLeaderboard .card-title {
  color: var(--neon-orange);
}
.finishHimLeaderboard .card-title {
  color: var(--neon-purple);
}
.theoryLeaderboard .card-title {
  color: var(--color-accent-warning);
}
.practicalLeaderboard .card-title {
  color: var(--neon-lime);
}

.card-title {
  font-size: 1.2rem;
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

.mode-table-wrapper {
  margin-top: 16px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.2);
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode-score-value {
  font-weight: bold;
  color: var(--color-accent-warning);
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.1em;
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
  .card-title {
    font-size: 0.9rem;
  }
  .tab-name {
    display: inline-block;
    font-size: 0.75rem;
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
