<script setup lang="ts">
import {
  AVAILABLE_BOARDS,
  AVAILABLE_PIECE_SETS,
  useAuthStore,
  usePreferencesStore,
  type UserPreferencesDto,
} from '@/entities/user'
import { changeLang } from '@/shared/config/i18n'
import {
  CRASHTEST_ENGINES,
  CRASHTEST_ENGINE_NAMES,
  type CrashtestEngineId,
} from '@/shared/types/api.types'
import {
  ColorPaletteOutline,
  GameControllerOutline,
  LogInOutline,
  LogOutOutline,
  SettingsOutline,
  VolumeHighOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NCollapse,
  NCollapseItem,
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

const authStore = useAuthStore()
const preferencesStore = usePreferencesStore()

const { isAuthenticated } = storeToRefs(authStore)
const { t } = useI18n()

const isOpen = ref(false)
const boardTabRef = ref<HTMLElement | null>(null)
const expandedCollapseNames = ref<string[]>([])

const crashtestEngineOptions = computed(() =>
  CRASHTEST_ENGINES.map((id) => ({
    label: CRASHTEST_ENGINE_NAMES[id],
    value: id,
  })),
)

const handleCollapseChange = (expandedNames: string[]) => {
  if (expandedNames.includes('board_pieces')) {
    setTimeout(() => {
      boardTabRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 150)
  }
}

const draftPreferences = ref<UserPreferencesDto>(
  JSON.parse(JSON.stringify(preferencesStore.preferences)),
)

const initializeDraft = () => {
  draftPreferences.value = JSON.parse(JSON.stringify(preferencesStore.preferences))
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
      class="p-2 flex items-center justify-center bg-transparent border-0 cursor-pointer transition-transform duration-300 hover:rotate-60 hover:scale-110"
      :title="t('features.settings.title')"
      @click="isOpen = true"
    >
      <NIcon class="text-[1.85rem] text-warning">
        <SettingsOutline />
      </NIcon>
    </button>

    <NDrawer
      v-model:show="isOpen"
      :width="380"
      placement="right"
      resizable
      class="bg-surface!"
    >
      <NDrawerContent
        closable
        :title="t('features.settings.title')"
        class="bg-surface! text-text-primary"
      >
        <div class="flex flex-col h-full gap-4 pb-6">
          <!-- 1. Language Selector -->
          <div class="p-3.5 rounded-lg bg-elevated/50 border border-border transition-colors hover:border-border-hover">
            <div class="text-xs font-display font-bold uppercase tracking-wider text-text-secondary mb-2.5">
              {{ t('features.settings.language') }}
            </div>
            <div class="flex gap-1.5 p-1 rounded-md bg-void/60 border border-border">
              <button
                v-for="lang in ['en', 'de', 'ru'] as const"
                :key="lang"
                type="button"
                class="flex-1 py-2 px-2 rounded-sm font-display font-bold text-xs uppercase transition-all cursor-pointer border"
                :class="
                  draftPreferences.gameplay.language === lang
                    ? 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/50'
                    : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary hover:bg-elevated/60'
                "
                @click="draftPreferences.gameplay.language = lang"
              >
                {{ lang.toUpperCase() }}
              </button>
            </div>
          </div>

          <!-- 2. Sound & Audio Settings -->
          <div class="p-3.5 rounded-lg bg-elevated/50 border border-border transition-colors hover:border-border-hover">
            <div class="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-text-secondary mb-3">
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
              <span class="font-condensed font-bold text-xs text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-sm min-w-13 text-center">
                {{ Math.round(draftPreferences.audio.boardVolume * 100) }}%
              </span>
            </div>
          </div>

          <!-- 3. Animation Duration -->
          <div class="p-3.5 rounded-lg bg-elevated/50 border border-border transition-colors hover:border-border-hover">
            <div class="text-xs font-display font-bold uppercase tracking-wider text-text-secondary mb-2.5">
              {{ t('features.settings.animationDuration') }}
            </div>
            <div class="flex items-center gap-3.5">
              <NSlider
                v-model:value="draftPreferences.theme.animationDuration"
                :min="0"
                :max="500"
                :step="50"
              />
              <span class="font-condensed font-bold text-xs text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-sm min-w-13 text-center">
                {{ draftPreferences.theme.animationDuration }}ms
              </span>
            </div>
          </div>

          <!-- 4. Gameplay & Bot Delays -->
          <div class="p-3.5 rounded-lg bg-elevated/50 border border-border transition-colors hover:border-border-hover flex flex-col gap-3">
            <div class="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-text-secondary">
              <NIcon><GameControllerOutline /></NIcon>
              <span>{{ t('features.settings.gameplayBotDelays') }}</span>
            </div>

            <!-- Bot Thinking Delay -->
            <div>
              <div class="text-[11px] font-display font-bold uppercase tracking-wider text-text-secondary mb-2">
                {{ t('features.settings.botThinkingDelay') }}
              </div>
              <div class="flex items-center gap-3.5">
                <NSlider
                  v-model:value="draftPreferences.delays.botDelayMs"
                  :min="50"
                  :max="5000"
                  :step="50"
                />
                <span class="font-condensed font-bold text-xs text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-sm min-w-13 text-center">
                  {{ draftPreferences.delays.botDelayMs }}ms
                </span>
              </div>
            </div>

            <!-- Developer Crashtest Section (Only for MO3EP) -->
            <div
              v-if="authStore.isMo3ep"
              class="p-3 rounded-md bg-danger/10 border border-dashed border-danger/40 flex flex-col gap-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-display font-bold uppercase tracking-wider text-danger">
                  {{ t('features.settings.devCrashtest') }}
                </span>
                <NSwitch
                  v-model:value="draftPreferences.gameplay.global_crashtest"
                  size="medium"
                />
              </div>

              <!-- Crashtest Engine Selector -->
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-display font-bold uppercase tracking-wider text-danger">
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
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] font-display font-bold uppercase tracking-wider text-danger">
                  {{ t('features.settings.devCrashtestSpeed') }}
                </span>
                <div class="flex items-center gap-3.5">
                  <NSlider
                    v-model:value="draftPreferences.delays.crashtestDelayMs"
                    :min="0"
                    :max="1000"
                    :step="50"
                  />
                  <span class="font-condensed font-bold text-xs text-danger bg-danger/15 border border-danger/40 px-2 py-0.5 rounded-sm min-w-13 text-center">
                    {{ draftPreferences.delays.crashtestDelayMs }}ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Board & Pieces Tab -->
          <div ref="boardTabRef">
            <NCollapse
              v-model:expanded-names="expandedCollapseNames"
              @update:expanded-names="handleCollapseChange"
            >
              <NCollapseItem name="board_pieces">
                <template #header>
                  <div class="flex items-center gap-2.5 font-display font-bold text-sm text-text-primary">
                    <NIcon><ColorPaletteOutline /></NIcon>
                    <span>{{ t('features.settings.selectBoard') }} & {{ t('features.settings.selectPieces') }}</span>
                  </div>
                </template>

                <div class="p-3.5 rounded-lg bg-elevated/50 border border-border mb-3">
                  <div class="text-xs font-display font-bold uppercase tracking-wider text-text-secondary mb-2.5">
                    {{ t('features.settings.board') }}
                  </div>
                  <div class="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto p-0.5">
                    <button
                      v-for="board in AVAILABLE_BOARDS"
                      :key="board.name"
                      type="button"
                      class="p-0.5 rounded-md border-2 bg-void/40 cursor-pointer transition-transform hover:scale-105"
                      :class="
                        board.name === draftPreferences.theme.board
                          ? 'border-neon-cyan'
                          : 'border-transparent hover:border-border-hover'
                      "
                      @click="draftPreferences.theme.board = board.name"
                    >
                      <img
                        :src="`/board/jpg_png/${board.thumbnailFile}`"
                        :alt="board.name"
                        class="w-full h-auto block rounded-sm"
                      />
                    </button>
                  </div>
                </div>

                <div class="p-3.5 rounded-lg bg-elevated/50 border border-border">
                  <div class="text-xs font-display font-bold uppercase tracking-wider text-text-secondary mb-2.5">
                    {{ t('features.settings.pieces') }}
                  </div>
                  <div class="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-0.5">
                    <button
                      v-for="pieceSet in AVAILABLE_PIECE_SETS"
                      :key="pieceSet.name"
                      type="button"
                      class="aspect-square p-1 rounded-md border-2 bg-void/40 cursor-pointer flex items-center justify-center transition-transform hover:scale-105"
                      :class="
                        pieceSet.name === draftPreferences.theme.pieces
                          ? 'border-neon-cyan'
                          : 'border-transparent hover:border-border-hover'
                      "
                      @click="draftPreferences.theme.pieces = pieceSet.name"
                    >
                      <img
                        :src="pieceSet.previewPieceFile"
                        :alt="pieceSet.name"
                        class="max-w-4/5 max-h-4/5"
                      />
                    </button>
                  </div>
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>

          <!-- Footer Actions -->
          <div class="mt-auto pt-4 border-t border-border flex flex-col gap-3">
            <NButton block type="primary" size="large" @click="handleSave">
              {{ t('features.settings.save') }}
            </NButton>

            <NButton
              block
              size="large"
              :type="isAuthenticated ? 'error' : 'success'"
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
