<script setup lang="ts">
import type { UnifiedLeaderboardEntry, UnifiedLeaderboardResponse } from '@/shared/types/api.types'
import type { DataTableColumns } from 'naive-ui'
import { computed, h, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { tokens } from '@/shared/theme/tokens'

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
  pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'rubyDiamond.svg',
  VIP: 'rubyDiamond.svg',
  vip: 'rubyDiamond.svg',
  Queen: 'wQ.svg',
  queen: 'wQ.svg',
  King: 'wK.svg',
  king: 'wK.svg',
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
      title: isOverall ? t('features.leaderboards.table.solved', 'Solved') : t('features.leaderboards.table.maxRating', 'Max'),
      key: isOverall ? 'score' : 'maxRating',
      align: 'center' as const,
      width: 90,
      render: (row) =>
        h('span', { class: 'font-condensed font-bold text-warning text-base' }, isOverall ? row.score : row.maxRating),
    },
    ...(!isOverall
      ? [
          {
            title: t('features.leaderboards.table.avgRating', 'Schnitt'),
            key: 'avgRating',
            align: 'center' as const,
            width: 90,
            render: (row: UnifiedLeaderboardEntry) =>
              h('span', { style: { color: tokens.textSecondary } }, row.avgRating),
          },
        ]
      : []),
    {
      title: t('features.leaderboards.table.bestDay', 'Best Day'),
      key: 'highScore',
      align: 'center' as const,
      width: 95,
      render: (row) => h('span', { style: { fontWeight: 'bold' } }, row.highScore),
    },
    {
      title: t('features.leaderboards.table.activeDays', 'Tage'),
      key: 'activeDays',
      align: 'center' as const,
      width: 90,
      render: (row) => row.activeDays,
    },
    ...(isOverall
      ? [
          {
            title: t('features.leaderboards.table.plans', 'Plans'),
            key: 'plansCount',
            align: 'center' as const,
            width: 90,
            render: (row: UnifiedLeaderboardEntry) => h('span', { style: { fontWeight: 'bold', color: tokens.success } }, row.plansCount || 0),
          },
        ]
      : [
          {
            title: t('features.leaderboards.table.played', 'Spiele'),
            key: 'played',
            align: 'center' as const,
            width: 90,
            render: (row: UnifiedLeaderboardEntry) => row.solved + row.failed,
          },
        ]),
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
                  ? tokens.success
                  : acc > 40
                    ? tokens.warning
                    : tokens.danger,
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
  <div class="bg-surface border border-border rounded-xl shadow-flat overflow-hidden flex flex-col mb-5 h-full">
    <div class="px-5 py-4 max-md:px-3.5 max-md:py-2.5 border-b border-border bg-elevated/40">
      <h3 class="m-0 text-center font-display font-extrabold text-xl max-md:text-sm tracking-wider uppercase text-warning flex justify-center items-center gap-3">
        {{ title }}
      </h3>
    </div>

    <div class="p-3 max-md:p-0.5">
      <div v-if="isLoading" class="flex justify-center items-center h-[200px]">
        <n-spin size="large" />
      </div>
      <n-tabs v-else v-model:value="activeTab" type="segment" animated>
        <n-tab-pane v-for="tab in tabs" :key="tab.id" :name="tab.id">
          <template #tab>
            <div class="flex items-center gap-1.5">
              <span class="text-sm max-md:text-xs font-bold font-display">{{ tab.name }}</span>
            </div>
          </template>
          <div class="mt-4 border border-border rounded-lg overflow-hidden bg-void/40">
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
              :max-height="400"
              :scroll-x="400"
            />
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>
