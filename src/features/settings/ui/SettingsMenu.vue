<script setup lang="ts">
import {
  useAuthStore,
  usePreferencesStore,
  type EndgameAutomatMode,
  type UserPreferencesDto,
} from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import { colorMode, setColorMode } from '@/shared/theme/tokens'
import {
  CRASHTEST_ENGINES,
  CRASHTEST_ENGINE_NAMES,
  type CrashtestEngineId,
} from '@/shared/types/api.types'
import {
  FlashOutline,
  GameControllerOutline,
  LogInOutline,
  LogOutOutline,
  MoonOutline,
  SettingsOutline,
  SunnyOutline,
  VolumeHighOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NIcon,
  NSelect,
  NSlider,
  NSwitch,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingsBoardPiecesSection from './SettingsBoardPiecesSection.vue'
import SettingsTimingSelector from './SettingsTimingSelector.vue'

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const { isAuthenticated } = storeToRefs(authStore)
const { t } = useI18n()

const isOpen = ref(false)

const automatModes: readonly EndgameAutomatMode[] = ['off', 'unknown', 'on']

const crashtestEngineOptions = computed(() =>
  CRASHTEST_ENGINES.map((id) => ({
    label: CRASHTEST_ENGINE_NAMES[id],
    value: id,
  })),
)

const draftPreferences = ref<UserPreferencesDto>(
  JSON.parse(JSON.stringify(preferencesStore.rawPreferences)),
)

const initializeDraft = () => {
  draftPreferences.value = JSON.parse(JSON.stringify(preferencesStore.rawPreferences))
}

watch(isOpen, (newVal) => {
  if (newVal) {
    initializeDraft()
  }
})

const handleCrashtestEngineChange = (val: CrashtestEngineId) => {
  draftPreferences.value.gameplay.crashtestEngine = val
}

const handleSave = async () => {
  changeLang(draftPreferences.value.gameplay.language)
  await preferencesStore.updatePreferences(draftPreferences.value)
  isOpen.value = false
}

const handleAuthAction = () => {
  if (isAuthenticated.value) {
    authStore.logout()
  } else {
    authStore.login()
  }
  isOpen.value = false
}
</script>

<template>
  <div class="inline-block">
    <button
      type="button"
      class="p-2 rounded-md flex items-center justify-center bg-transparent border border-transparent text-text-secondary hover:text-text-primary hover:bg-elevated hover:border-border cursor-pointer transition-colors"
      :title="t('features.settings.title')"
      :aria-label="t('features.settings.title')"
      @click="isOpen = true"
    >
      <NIcon class="text-[1.25rem]">
        <SettingsOutline />
      </NIcon>
    </button>

    <NDrawer
      v-model:show="isOpen"
      :width="380"
      placement="right"
      resizable
      class="bg-surface"
    >
      <NDrawerContent
        closable
        :title="t('features.settings.title')"
        class="bg-surface text-text-primary"
      >
        <div class="flex flex-col h-full gap-4 pb-6">
          <!-- 0. Color Theme Mode (Dark / Light) -->
          <div class="p-3.5 rounded-lg bg-elevated/40 border border-border">
            <div class="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
              Theme
            </div>
            <div class="grid grid-cols-2 gap-1.5 p-1 rounded-md bg-canvas border border-border">
              <button
                type="button"
                class="min-w-0 overflow-hidden py-1.5 px-3 rounded-sm font-display font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                :class="
                  colorMode === 'dark'
                    ? 'bg-surface text-text-primary border-border-hover shadow-xs'
                    : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                "
                @click="setColorMode('dark')"
              >
                <NIcon class="shrink-0"><MoonOutline /></NIcon>
                <span class="truncate">Dark</span>
              </button>
              <button
                type="button"
                class="min-w-0 overflow-hidden py-1.5 px-3 rounded-sm font-display font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border"
                :class="
                  colorMode === 'light'
                    ? 'bg-surface text-text-primary border-border-hover shadow-xs'
                    : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                "
                @click="setColorMode('light')"
              >
                <NIcon class="shrink-0"><SunnyOutline /></NIcon>
                <span class="truncate">Light</span>
              </button>
            </div>
          </div>

          <!-- 1. Language Selector -->
          <div class="p-3.5 rounded-lg bg-elevated/40 border border-border">
            <div class="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary mb-2.5">
              {{ t('features.settings.language') }}
            </div>
            <div class="flex gap-1.5 p-1 rounded-md bg-canvas border border-border">
              <button
                v-for="lang in ['en', 'de', 'ru'] as const"
                :key="lang"
                type="button"
                class="flex-1 min-w-0 overflow-hidden py-1.5 px-2 rounded-sm font-display font-medium text-xs uppercase transition-colors cursor-pointer border"
                :class="
                  draftPreferences.gameplay.language === lang
                    ? 'bg-surface text-text-primary border-border-hover shadow-xs'
                    : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                "
                @click="draftPreferences.gameplay.language = lang"
              >
                <span class="truncate block">{{ lang.toUpperCase() }}</span>
              </button>
            </div>
          </div>

          <!-- 2. Sound & Audio Settings -->
          <div class="p-3.5 rounded-lg bg-elevated/40 border border-border">
            <div class="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wider text-text-secondary mb-3">
              <NIcon><VolumeHighOutline /></NIcon>
              <span>{{ t('features.settings.sounds.title') }}</span>
            </div>
            <div class="flex items-center gap-3.5">
              <NSlider
                v-model:value="draftPreferences.audio.boardVolume"
                :min="0"
                :max="1"
                :step="0.1"
              />
              <span class="font-condensed font-bold text-xs text-text-primary bg-surface border border-border px-2 py-0.5 rounded-sm min-w-13 text-center">
                {{ Math.round(draftPreferences.audio.boardVolume * 100) }}%
              </span>
            </div>
          </div>

          <!-- 3. Unified Gameplay Settings -->
          <div class="p-3.5 rounded-lg bg-elevated/40 border border-border flex flex-col gap-3">
            <div class="flex items-center gap-1.5 text-xs font-display font-semibold uppercase tracking-wider text-text-secondary">
              <NIcon><GameControllerOutline /></NIcon>
              <span>{{ t('features.settings.gameplaySettings') }}</span>
            </div>

            <SettingsTimingSelector
              v-model="draftPreferences.theme.animationDuration"
              :label="t('features.settings.animationDuration')"
            />

            <SettingsTimingSelector
              v-model="draftPreferences.delays.botDelayMs"
              :label="t('features.settings.botThinkingDelay')"
            />

            <SettingsTimingSelector
              v-model="draftPreferences.delays.nextPuzzleDelayMs"
              :label="t('features.settings.nextPuzzleDelay')"
            />

            <!-- Endgame Automat (Gaviota DTM) -->
            <div class="pt-2 border-t border-border/60 flex flex-col gap-2.5">
              <div class="flex items-center gap-1.5 text-[11px] font-display font-medium uppercase tracking-wider text-text-secondary">
                <NIcon class="text-brand"><FlashOutline /></NIcon>
                <span>{{ t('features.settings.endgameAutomatTitle') }}</span>
              </div>
              <div class="grid grid-cols-3 gap-1 p-1 rounded-md bg-canvas border border-border">
                <button
                  v-for="mode in automatModes"
                  :key="mode"
                  type="button"
                  class="min-w-0 overflow-hidden py-1.5 px-2 rounded-sm font-display font-medium text-xs transition-colors cursor-pointer border text-center"
                  :class="
                    draftPreferences.gameplay.endgameAutomat === mode
                      ? 'bg-surface text-text-primary border-border-hover shadow-xs'
                      : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                  "
                  @click="draftPreferences.gameplay.endgameAutomat = mode"
                >
                  <span class="truncate block">{{ t(`features.settings.endgameAutomatModes.${mode}`) }}</span>
                </button>
              </div>

              <SettingsTimingSelector
                v-model="draftPreferences.delays.automatDelayMs"
                :label="t('features.settings.automatSpeed')"
              />
            </div>

            <!-- Developer Crashtest Section (Restricted to developer / owner roles) -->
            <div
              v-if="authStore.isDeveloper"
              class="p-3 rounded-md bg-danger/10 border border-dashed border-danger/40 flex flex-col gap-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-display font-semibold uppercase tracking-wider text-danger">
                  {{ t('features.settings.devCrashtest') }}
                </span>
                <NSwitch
                  v-model:value="draftPreferences.gameplay.global_crashtest"
                  size="medium"
                />
              </div>

              <!-- Crashtest Engine Selector -->
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-display font-medium uppercase tracking-wider text-danger">
                  {{ t('features.settings.devCrashtestEngine') }}
                </span>
                <NSelect
                  :value="draftPreferences.gameplay.crashtestEngine"
                  :options="crashtestEngineOptions"
                  size="small"
                  @update:value="handleCrashtestEngineChange"
                />
              </div>

              <!-- Crashtest Move Delay -->
              <SettingsTimingSelector
                v-model="draftPreferences.delays.crashtestDelayMs"
                :label="t('features.settings.devCrashtestSpeed')"
                tone="danger"
              />
            </div>
          </div>

          <!-- 4. Board & Pieces Tab -->
          <SettingsBoardPiecesSection
            :board="draftPreferences.theme.board"
            :pieces="draftPreferences.theme.pieces"
            @update:board="(val) => (draftPreferences.theme.board = val)"
            @update:pieces="(val) => (draftPreferences.theme.pieces = val)"
          />

          <!-- Footer Actions -->
          <div class="mt-auto pt-4 border-t border-border flex flex-col gap-2.5">
            <NButton block type="primary" size="large" @click="handleSave">
              {{ t('features.settings.save') }}
            </NButton>

            <NButton
              block
              size="large"
              :type="isAuthenticated ? 'error' : 'default'"
              secondary
              @click="handleAuthAction"
            >
              <template #icon>
                <NIcon v-if="isAuthenticated"><LogOutOutline /></NIcon>
                <NIcon v-else><LogInOutline /></NIcon>
              </template>
              {{ isAuthenticated ? t('shared.nav.logout') : t('shared.nav.login') }}
            </NButton>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
