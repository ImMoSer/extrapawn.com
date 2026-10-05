<script setup lang="ts">
import { ArrowForwardOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NDataTable,
  NH1,
  NH2,
  NIcon,
  NLayout,
  NLayoutContent,
  NSpace,
  NTag,
  NText,
  type DataTableColumns,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface ClubPlayer {
  lichess_id: string
  username: string
  title?: string | null
  flair?: string | null
  vector: number
  total_score: number
  performance: number
  win_rate: number
  total_games_played: number
  total_berserk_wins: number
  max_streak: number
}

const leaderboard = ref<ClubPlayer[]>([])
const loading = ref(false)

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 600)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      windowWidth.value = window.innerWidth
    })
  }
  fetchLeaderboard()
})

const fetchLeaderboard = async () => {
  loading.value = true
  try {
    const response = await fetch(
      'https://club.extrapawn.com/api/stats/xtrapawn/players?period=last_30_days',
    )
    const data = await response.json()
    leaderboard.value = (data || []).slice(0, 20)
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
  } finally {
    loading.value = false
  }
}

const renderUsername = (row: ClubPlayer) => {
  const elements = []

  if (row.title) {
    elements.push(
      h(
        NTag,
        {
          size: 'small',
          bordered: false,
          style: { fontWeight: 'bold', padding: '0 2px', color: '#ff5500', marginRight: '4px' },
        },
        { default: () => row.title },
      ),
    )
  }

  elements.push(
    h(
      'a',
      {
        href: `https://lichess.org/@/${row.lichess_id}`,
        target: '_blank',
        style: { color: 'var(--neon-cyan)', textDecoration: 'none', fontWeight: '800' },
      },
      row.username,
    ),
  )

  if (row.flair) {
    elements.push(
      h('img', {
        src: `https://lichess1.org/assets/flair/img/${row.flair}.webp`,
        style: {
          height: isMobile.value ? '11px' : '14px',
          marginLeft: '4px',
          verticalAlign: 'middle',
        },
        alt: 'Flair',
      }),
    )
  }

  return h('div', { style: { display: 'flex', alignItems: 'center' } }, elements)
}

const columns = computed<DataTableColumns<ClubPlayer>>(() => {
  const numericWidth = isMobile.value ? 50 : 85

  const allCols = [
    {
      title: '#',
      key: 'rank',
      width: isMobile.value ? 30 : 55,
      render: (_: ClubPlayer, index: number) =>
        h('span', { style: { color: 'var(--text-color-3)', fontWeight: 'bold' } }, index + 1),
    },
    {
      title: t('pages.bonus.table.player'),
      key: 'username',
      minWidth: isMobile.value ? 120 : 160,
      render: (row: ClubPlayer) => renderUsername(row),
    },
    {
      title: t('pages.bonus.table.vector'),
      key: 'vector',
      align: 'right' as const,
      width: numericWidth,
      render: (row: ClubPlayer) =>
        h('span', { style: { fontWeight: '900', color: 'var(--neon-purple)' } }, row.vector),
    },
    {
      title: t('pages.bonus.table.performance'),
      key: 'performance',
      align: 'right' as const,
      width: numericWidth,
    },
    {
      title: t('pages.bonus.table.gamesPlayed'),
      key: 'total_games_played',
      align: 'right' as const,
      width: numericWidth,
    },
    {
      title: t('pages.bonus.table.winRate'),
      key: 'win_rate',
      align: 'right' as const,
      width: numericWidth,
      render: (row: ClubPlayer) => `${row.win_rate}%`,
    },
    {
      title: t('pages.bonus.table.streak'),
      key: 'max_streak',
      align: 'right' as const,
      width: numericWidth,
    },
  ]

  if (isMobile.value) {
    return allCols.filter(
      (col) => !['performance', 'win_rate', 'max_streak', 'total_games_played'].includes(col.key),
    ) as DataTableColumns<ClubPlayer>
  }

  return allCols as DataTableColumns<ClubPlayer>
})
</script>

<template>
  <n-layout class="club-player-page-layout">
    <n-layout-content
      class="club-player-content"
      :content-style="
        isMobile ? 'padding: 10px;' : 'padding: 20px; max-width: 1200px; margin: 0 auto;'
      "
    >
      <n-space vertical :size="isMobile ? 'medium' : 'large'">
        <n-h1 align-text class="page-title">
          <n-text style="color: var(--neon-cyan)">ExtraPawn Club Top 20</n-text>
        </n-h1>

        <n-card class="info-card" :content-style="isMobile ? { padding: '14px' } : { padding: '20px' }">
          <n-h2 prefix="bar" align-text type="info" :style="isMobile ? { fontSize: '1.2rem' } : {}">
            {{ t('pages.bonus.mostValuablePlayersTitle') || 'Club Top 20 Leaderboard' }}
          </n-h2>
          <n-text depth="2" :style="{ fontSize: isMobile ? '0.9rem' : '1rem', display: 'block', marginBottom: '12px' }">
            {{ t('pages.pricing.bonusInfo.p1') }}
          </n-text>

          <n-button
            tag="a"
            href="https://club.extrapawn.com/xtrapawn/home"
            target="_blank"
            type="primary"
            ghost
            :size="isMobile ? 'medium' : 'large'"
            style="margin-top: 8px"
          >
            {{ t('pages.pricing.bonusInfo.homepageLink') || 'ExtraPawn Club Home' }}
            <template #icon>
              <n-icon><ArrowForwardOutline /></n-icon>
            </template>
          </n-button>
        </n-card>

        <div class="table-wrapper">
          <n-data-table
            :columns="columns"
            :data="leaderboard"
            :loading="loading"
            :bordered="false"
            :single-line="false"
            size="small"
            class="club-table"
          />
        </div>
      </n-space>
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.club-player-page-layout,
.club-player-content {
  background-color: transparent !important;
}

.page-title {
  margin-bottom: 24px !important;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-align: center;
}

.info-card {
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
}

.table-wrapper {
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
  overflow: hidden;
}

:deep(.club-table .n-data-table-th) {
  background-color: rgba(255, 255, 255, 0.03) !important;
  font-weight: 700;
  color: var(--text-color-2);
}

:deep(.club-table .n-data-table-td) {
  background-color: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
}

:deep(.club-table .n-data-table-tr:hover .n-data-table-td) {
  background-color: rgba(255, 255, 255, 0.04) !important;
}
</style>
