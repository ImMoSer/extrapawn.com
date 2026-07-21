<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NCard, NEmpty, NTab, NTabs } from 'naive-ui'
import { useLichessGamesDbStore } from '../model/lichess-games-db.store'
import { useAuthStore } from '@/entities/user'
import LichessGamesWdlTable from './LichessGamesWdlTable.vue'
import LichessGamesTopOpenings from './LichessGamesTopOpenings.vue'

const store = useLichessGamesDbStore()
const authStore = useAuthStore()
const username = computed(() => authStore.effectiveLichessUsername)

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
  <div class="flex flex-col w-full">
    <NCard class="bg-surface border border-border rounded-lg shadow-flat" :title="$t('features.lichessGamesDb.statistics.title')" size="small">
      <div class="mb-5">
        <NTabs type="segment" size="small" v-model:value="activeTab">
          <NTab name="all">{{ $t('features.lichessGamesDb.statistics.tabAll') }}</NTab>
          <NTab name="white">{{ $t('features.lichessGamesDb.statistics.tabWhite') }}</NTab>
          <NTab name="black">{{ $t('features.lichessGamesDb.statistics.tabBlack') }}</NTab>
        </NTabs>
      </div>

      <template v-if="hasData && currentStats && store.detailedStats">
        <div class="flex flex-col gap-4">
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
        <div class="py-10 text-center">
          <NEmpty :description="$t('features.lichessGamesDb.statistics.noLocalDb')">
          </NEmpty>
        </div>
      </template>
    </NCard>
  </div>
</template>
