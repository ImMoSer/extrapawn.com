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

// Mobile responsiveness - aligned with reference (600px)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 600)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      windowWidth.value = window.innerWidth
    })
  }
})

const fetchLeaderboard = async () => {
  loading.value = true
  try {
    const response = await fetch(
      'https://club.extrapawn.com/api/stats/xtrapawn/players?period=last_30_days',
    )
    const data = await response.json()
    leaderboard.value = (data || []).slice(0, 20) // Top 20
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
  } finally {
    loading.value = false
  }
}

const getTierInfo = (index: number, vector: number) => {
  if (index === 0) return { label: 'King', color: 'var(--neon-gold)' }
  if (index === 1) return { label: 'Queen', color: 'var(--color-accent-error)' }
  if (index === 2) return { label: 'Rook', color: 'var(--neon-purple)' }
  if (vector >= 500) return { label: 'Bishop', color: 'var(--color-accent-warning)' }
  if (vector >= 250) return { label: 'Knight', color: 'var(--neon-cyan)' }
  return { label: 'Pawn', color: 'var(--text-color-3)' }
}

const renderUsername = (row: ClubPlayer) => {
  const elements = []

  // Title
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

  // Username Link
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

  // Flair
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
      width: isMobile.value ? 25 : 50,
      render: (_: ClubPlayer, index: number) =>
        h('span', { style: { color: 'var(--text-color-3)', fontWeight: 'bold' } }, index + 1),
    },
    {
      title: t('clubPage.table.player'),
      key: 'username',
      minWidth: isMobile.value ? 100 : 150,
      render: (row: ClubPlayer) => renderUsername(row),
    },
    {
      title: t('clubPage.table.vector'),
      key: 'vector',
      align: 'right' as const,
      width: numericWidth,
      render: (row: ClubPlayer) =>
        h('span', { style: { fontWeight: '900', color: 'var(--neon-purple)' } }, row.vector),
    },
    {
      title: 'Bonus',
      key: 'bonus',
      align: 'center' as const,
      width: isMobile.value ? 70 : 100,
      render: (row: ClubPlayer, index: number) => {
        const tier = getTierInfo(index, row.vector)
        if (tier.label === 'Pawn')
          return h('span', { style: { color: 'var(--text-color-3)' } }, '-')
        return h(
          NTag,
          {
            size: 'small',
            ghost: true,
            color: { textColor: tier.color, borderColor: tier.color },
          },
          { default: () => tier.label },
        )
      },
    },
    {
      title: t('clubPage.table.performance'),
      key: 'performance',
      align: 'right' as const,
      width: numericWidth,
    },
    {
      title: t('clubPage.table.gamesPlayed'),
      key: 'total_games_played',
      align: 'right' as const,
      width: numericWidth,
    },
    {
      title: t('clubPage.table.winRate'),
      key: 'win_rate',
      align: 'right' as const,
      width: numericWidth,
      render: (row: ClubPlayer) => `${row.win_rate}%`,
    },
    {
      title: t('clubPage.table.streak'),
      key: 'max_streak',
      align: 'right' as const,
      width: numericWidth,
    },
  ]

  if (isMobile.value) {
    // Hidden on mobile to save space, keeping only essential
    return allCols.filter(
      (col) => !['performance', 'win_rate', 'max_streak', 'total_games_played'].includes(col.key),
    ) as DataTableColumns<ClubPlayer>
  }

  return allCols as DataTableColumns<ClubPlayer>
})

onMounted(() => {
  fetchLeaderboard()
})
</script>

<template>
  <n-layout class="bonus-page-layout">
    <n-layout-content
      class="bonus-content"
      :content-style="
        isMobile ? 'padding: 10px;' : 'padding: 20px; max-width: 1200px; margin: 0 auto;'
      "
    >
      <n-space vertical :size="isMobile ? 'medium' : 'large'">
        <n-h1 align-text class="page-title">
          <n-text style="color: var(--neon-cyan)">{{
            t('features.pricing.bonusInfo.title')
          }}</n-text>
        </n-h1>

        <n-card class="info-card" :content-style="isMobile ? { padding: '12px' } : {}">
          <n-h2 prefix="bar" align-text type="info" :style="isMobile ? { fontSize: '1.2rem' } : {}">
            {{ t('features.pricing.bonusInfo.howItWorks') }}
          </n-h2>

          <n-space vertical size="medium">
            <n-text depth="1" strong :style="{ fontSize: isMobile ? '0.95rem' : '1.1rem' }">
              {{ t('features.pricing.bonusInfo.p1') }}
            </n-text>
            <n-text depth="2" :style="{ fontSize: isMobile ? '0.85rem' : '1rem' }">
              {{ t('features.pricing.bonusInfo.p2') }}
            </n-text>

            <n-space vertical :size="isMobile ? 'small' : 'medium'" style="margin-top: 8px">
              <div class="condition-item">
                <n-tag
                  :bordered="false"
                  size="small"
                  strong
                  style="
                    min-width: 100px;
                    justify-content: center;
                    background: rgba(255, 7, 58, 0.15);
                    color: var(--neon-red);
                  "
                  >TOP 1-3</n-tag
                >
                <n-text>{{ t('features.pricing.bonusInfo.p3') }}</n-text>
              </div>
              <div class="condition-item">
                <n-tag
                  :bordered="false"
                  size="small"
                  strong
                  style="
                    min-width: 100px;
                    justify-content: center;
                    background: rgba(255, 85, 0, 0.15);
                    color: var(--neon-orange);
                  "
                  >VECTOR 500</n-tag
                >
                <n-text>{{ t('features.pricing.bonusInfo.p4a') }}</n-text>
              </div>
              <div class="condition-item">
                <n-tag
                  :bordered="false"
                  size="small"
                  strong
                  style="
                    min-width: 100px;
                    justify-content: center;
                    background: rgba(255, 230, 0, 0.15);
                    color: var(--neon-yellow);
                  "
                  >VECTOR 250</n-tag
                >
                <n-text>{{ t('features.pricing.bonusInfo.p4b') }}</n-text>
              </div>
            </n-space>

            <n-text
              depth="3"
              style="font-style: italic; font-size: 0.85rem; margin-top: 8px; display: block"
            >
              {{ t('features.pricing.bonusInfo.p5') }}
            </n-text>
          </n-space>
        </n-card>

        <n-h2 prefix="bar" align-text type="success" class="table-headline">
          {{ t('clubPage.mostValuablePlayersTitle') || 'Club Top 20 & Bonus Status' }}
        </n-h2>

        <div class="table-wrapper">
          <n-data-table
            :columns="columns"
            :data="leaderboard"
            :loading="loading"
            :bordered="false"
            :single-line="false"
            size="small"
            class="bonus-table"
          />
        </div>

        <div class="footer-actions">
          <n-button
            tag="a"
            href="https://club.extrapawn.com/xtrapawn/home"
            target="_blank"
            type="primary"
            ghost
            :size="isMobile ? 'medium' : 'large'"
            block
          >
            {{ t('features.pricing.bonusInfo.homepageLink') }}
            <template #icon v-if="!isMobile">
              <n-icon><ArrowForwardOutline /></n-icon>
            </template>
          </n-button>
        </div>
      </n-space>
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.bonus-page-layout,
.bonus-content {
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

.condition-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}
.table-headline {
  margin-bottom: 12px !important;
  font-size: 1.4rem;
}

.table-wrapper {
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
  overflow: hidden;
}

.bonus-table :deep(.n-data-table-th) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  text-transform: uppercase;
  font-size: 0.8em;
  letter-spacing: 1px;
}

.bonus-table :deep(.n-data-table-td) {
  background-color: transparent !important;
}

.footer-actions {
  margin: auto;
  text-align: center;
  padding: 5px; /* Prevent button overflow */
  max-width: 300px;
}

@media (max-width: 600px) {
  .page-title {
    font-size: 1.5rem;
    margin-bottom: 16px !important;
  }

  .table-headline {
    font-size: 1.2rem;
    text-align: center;
  }

  /* Matching reference styles */
  :deep(.n-data-table-td),
  :deep(.n-data-table-th) {
    padding: 2px 2px !important;
    font-size: 0.72rem;
  }

  .bonus-table :deep(.n-data-table-th) {
    font-size: 0.7rem;
  }
}
</style>
