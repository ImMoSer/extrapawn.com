<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NCard, NEmpty, NTab, NTabs } from 'naive-ui'
import { useLichessGamesDbStore } from '../model/lichess-games-db.store'
import { useOpenCheckStore } from '@/features/open-check'
import LichessGamesWdlTable from './LichessGamesWdlTable.vue'
import LichessGamesTopOpenings from './LichessGamesTopOpenings.vue'

const store = useLichessGamesDbStore()
const openCheckStore = useOpenCheckStore()
const username = computed(() => openCheckStore.targetUsername)

const activeTab = ref<'all' | 'white' | 'black'>('all')

onMounted(() => {
  if (username.value) {
    store.loadStats(username.value)
  }
})

watch(username, () => {
  if (username.value) {
    store.loadStats(username.value)
  }
})

const currentStats = computed(() => {
  if (!store.detailedStats) return null
  return store.detailedStats[activeTab.value]
})

const hasData = computed(() => {
  return !!(currentStats.value && currentStats.value.gamesCount > 0)
})
</script>

<template>
  <div class="lichess-games-statistics">
    <NCard class="panel-card stats-dashboard-card" :title="$t('features.lichessGamesDb.statistics.title')" size="small">
      <div class="tabs-container">
        <NTabs type="segment" size="small" v-model:value="activeTab">
          <NTab name="all">{{ $t('features.lichessGamesDb.statistics.tabAll') }}</NTab>
          <NTab name="white">{{ $t('features.lichessGamesDb.statistics.tabWhite') }}</NTab>
          <NTab name="black">{{ $t('features.lichessGamesDb.statistics.tabBlack') }}</NTab>
        </NTabs>
      </div>

      <template v-if="hasData && currentStats && store.detailedStats">
        <div class="stats-overview">
          <!-- WDL horizontal bars table uses the active tab stats -->
          <LichessGamesWdlTable :stats="currentStats" />

          <!-- Top Openings Rose Chart uses white and black stats independently -->
          <LichessGamesTopOpenings
            :username="username"
            :white-stats="store.detailedStats.white"
            :black-stats="store.detailedStats.black"
          />
        </div>
      </template>
      <template v-else>
        <div class="empty-stats">
          <NEmpty :description="$t('features.lichessGamesDb.statistics.noLocalDb')">
          </NEmpty>
        </div>
      </template>
    </NCard>
  </div>
</template>

<style scoped>
.lichess-games-statistics {
  display: flex;
  flex-direction: column;
}

.panel-card {
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  border: 1px solid var(--color-border-hover);
}

.tabs-container {
  margin-bottom: 20px;
}

.empty-stats {
  padding: 40px 0;
  text-align: center;
}
</style>
