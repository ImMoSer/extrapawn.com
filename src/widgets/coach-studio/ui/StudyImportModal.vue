<script setup lang="ts">
import { useCoachStudyStore, type StudyLanguage, type StudySideColor } from '@/features/ai-coach'
import {
  validateFenInput,
  validateLichessUrlInput,
  validatePgnInput,
} from '@/shared/lib/pgn/importValidators'
import { CheckmarkCircleOutline, CloudDownloadOutline, SparklesOutline } from '@vicons/ionicons5'
import { NCheckbox, NIcon, NModal } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type ImportTab = 'lichess' | 'pgn' | 'fen'
type OrientationOption = 'auto' | StudySideColor

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const { t, locale } = useI18n()
const studyStore = useCoachStudyStore()

const activeTab = ref<ImportTab>('lichess')
const lichessUrl = ref('')
const pgnText = ref('')
const fenText = ref('')
const customTitle = ref('')
const orientationChoice = ref<OrientationOption>('auto')
const autoReview = ref(true)
const customQuestion = ref('')

const currentLanguage = computed<StudyLanguage>(() => {
  const loc = locale.value
  if (loc === 'en' || loc === 'de') return loc
  return 'ru'
})

const lichessCheck = computed(() =>
  lichessUrl.value.trim() ? validateLichessUrlInput(lichessUrl.value) : null,
)
const pgnCheck = computed(() => (pgnText.value.trim() ? validatePgnInput(pgnText.value) : null))
const fenCheck = computed(() => (fenText.value.trim() ? validateFenInput(fenText.value) : null))

const activeValidationError = computed<string | null>(() => {
  if (activeTab.value === 'lichess' && lichessCheck.value && !lichessCheck.value.valid) {
    return t(lichessCheck.value.errorKey || 'pages.study.errInvalidLichessUrl')
  }
  if (activeTab.value === 'pgn' && pgnCheck.value && !pgnCheck.value.valid) {
    return t(pgnCheck.value.errorKey || 'pages.study.errInvalidPgn', pgnCheck.value.errorParams || {})
  }
  if (activeTab.value === 'fen' && fenCheck.value && !fenCheck.value.valid) {
    return t(fenCheck.value.errorKey || 'pages.study.errInvalidFen')
  }
  return null
})

const canSubmit = computed(() => {
  if (studyStore.isImporting) return false
  if (activeTab.value === 'lichess') return Boolean(lichessCheck.value?.valid)
  if (activeTab.value === 'pgn') return Boolean(pgnCheck.value?.valid)
  return Boolean(fenCheck.value?.valid)
})

const pgnPreviewSummary = computed(() => {
  const chk = pgnCheck.value
  if (!chk?.valid) return ''
  const players = chk.white || chk.black ? `${chk.white || '?'} — ${chk.black || '?'}` : ''
  const pliesText = t('pages.study.importPliesPreview', { count: chk.plies ?? 0 })
  return players ? `${players} · ${pliesText}` : pliesText
})

const fenPreviewSummary = computed(() => {
  const chk = fenCheck.value
  if (!chk?.valid) return ''
  return chk.turn === 'black' ? t('pages.study.turnBlack') : t('pages.study.turnWhite')
})

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      studyStore.clearImportError()
    } else if (studyStore.isImporting) {
      studyStore.abortImport()
    }
  },
)

watch(activeTab, () => {
  studyStore.clearImportError()
})

const resetFields = () => {
  lichessUrl.value = ''
  pgnText.value = ''
  fenText.value = ''
  customTitle.value = ''
  customQuestion.value = ''
  orientationChoice.value = 'auto'
  studyStore.clearImportError()
}

const handleClose = () => {
  if (studyStore.isImporting) {
    studyStore.abortImport()
  }
  emit('update:show', false)
}

const handleSubmit = async () => {
  if (!canSubmit.value) return
  const explicitColor: StudySideColor | null =
    orientationChoice.value === 'auto' ? null : orientationChoice.value

  let result = null
  if (activeTab.value === 'lichess') {
    result = await studyStore.importFromLichess({
      url: lichessUrl.value,
      userColor: explicitColor,
      language: currentLanguage.value,
      autoReview: autoReview.value,
      customQuestion: customQuestion.value,
      defaultReviewPrompt: t('pages.study.importDefaultPrompt'),
    })
  } else if (activeTab.value === 'pgn') {
    result = await studyStore.importFromPgn({
      pgn: pgnText.value,
      title: customTitle.value || null,
      userColor: explicitColor,
      language: currentLanguage.value,
      autoReview: autoReview.value,
      customQuestion: customQuestion.value,
      defaultReviewPrompt: t('pages.study.importDefaultPrompt'),
    })
  } else {
    result = await studyStore.importFromFen({
      fen: fenText.value,
      title: customTitle.value || null,
      orientation: explicitColor,
      language: currentLanguage.value,
      autoReview: autoReview.value,
      customQuestion: customQuestion.value,
      defaultReviewPrompt: t('pages.study.importFenPrompt'),
    })
  }

  if (result) {
    resetFields()
    emit('update:show', false)
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :bordered="true"
    :mask-closable="!studyStore.isImporting"
    :closable="true"
    class="w-[94vw] max-w-[540px]"
    @update:show="(val: boolean) => (!val ? handleClose() : emit('update:show', true))"
  >
    <template #header>
      <div class="flex items-center gap-2 font-display text-sm font-semibold text-text-primary">
        <NIcon :size="17" class="shrink-0 text-brand"><CloudDownloadOutline /></NIcon>
        <span class="truncate">{{ t('pages.study.importTitle') }}</span>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <!-- Segmented 3-Tab Bar: Lichess | PGN | FEN -->
      <div class="grid grid-cols-3 gap-1 rounded-md border border-border bg-canvas p-1">
        <button
          v-for="tab in (['lichess', 'pgn', 'fen'] as const)"
          :key="tab"
          type="button"
          :disabled="studyStore.isImporting"
          class="min-w-0 cursor-pointer overflow-hidden rounded-sm border px-2 py-1.5 font-display text-xs font-semibold transition-colors disabled:opacity-60"
          :class="
            activeTab === tab
              ? 'border-brand/60 bg-elevated text-brand'
              : 'border-transparent bg-transparent text-text-secondary hover:bg-elevated/50 hover:text-text-primary'
          "
          @click="activeTab = tab"
        >
          <span class="block truncate">
            {{
              tab === 'lichess'
                ? t('pages.study.tabLichess')
                : tab === 'pgn'
                  ? t('pages.study.tabPgn')
                  : t('pages.study.tabFen')
            }}
          </span>
        </button>
      </div>

      <!-- Tab 1: Lichess URL -->
      <div v-if="activeTab === 'lichess'" class="flex flex-col gap-1.5">
        <input
          v-model="lichessUrl"
          type="text"
          :disabled="studyStore.isImporting"
          :placeholder="t('pages.study.lichessPlaceholder')"
          class="w-full rounded-md border border-border bg-elevated px-2.5 py-2 font-condensed text-xs text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none disabled:opacity-60"
          @keydown.enter.prevent="handleSubmit"
        />
        <div
          v-if="lichessCheck?.valid"
          class="inline-flex items-center gap-1.5 text-[0.74rem] text-success"
        >
          <NIcon :size="14" class="shrink-0"><CheckmarkCircleOutline /></NIcon>
          <span class="font-condensed">
            ID: {{ lichessCheck.gameId }}
            <template v-if="lichessCheck.urlColor"> · {{ lichessCheck.urlColor }}</template>
          </span>
        </div>
      </div>

      <!-- Tab 2: PGN -->
      <div v-else-if="activeTab === 'pgn'" class="flex flex-col gap-2">
        <input
          v-model="customTitle"
          type="text"
          maxlength="100"
          :disabled="studyStore.isImporting"
          :placeholder="t('pages.study.importTitleOptional')"
          class="w-full rounded-md border border-border bg-elevated px-2.5 py-1.5 font-display text-xs text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none disabled:opacity-60"
        />
        <textarea
          v-model="pgnText"
          rows="6"
          :disabled="studyStore.isImporting"
          :placeholder="t('pages.study.pgnPlaceholder')"
          class="w-full resize-y rounded-md border border-border bg-elevated px-2.5 py-2 font-condensed text-xs text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none disabled:opacity-60"
        />
        <div
          v-if="pgnCheck?.valid"
          class="inline-flex items-center gap-1.5 text-[0.74rem] text-success"
        >
          <NIcon :size="14" class="shrink-0"><CheckmarkCircleOutline /></NIcon>
          <span class="truncate font-condensed">{{ pgnPreviewSummary }}</span>
        </div>
      </div>

      <!-- Tab 3: FEN -->
      <div v-else class="flex flex-col gap-2">
        <input
          v-model="customTitle"
          type="text"
          maxlength="100"
          :disabled="studyStore.isImporting"
          :placeholder="t('pages.study.importTitleOptional')"
          class="w-full rounded-md border border-border bg-elevated px-2.5 py-1.5 font-display text-xs text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none disabled:opacity-60"
        />
        <input
          v-model="fenText"
          type="text"
          :disabled="studyStore.isImporting"
          :placeholder="t('pages.study.fenPlaceholder')"
          class="w-full rounded-md border border-border bg-elevated px-2.5 py-2 font-condensed text-xs text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none disabled:opacity-60"
          @keydown.enter.prevent="handleSubmit"
        />
        <div
          v-if="fenCheck?.valid"
          class="inline-flex items-center gap-1.5 text-[0.74rem] text-success"
        >
          <NIcon :size="14" class="shrink-0"><CheckmarkCircleOutline /></NIcon>
          <span class="font-condensed">{{ fenPreviewSummary }}</span>
        </div>
      </div>

      <!-- Validation / Server Error Banner -->
      <div
        v-if="activeValidationError || studyStore.importError"
        class="rounded-md border border-danger/50 bg-elevated px-2.5 py-1.5 text-xs text-danger"
      >
        {{ activeValidationError || studyStore.importError }}
      </div>

      <!-- Board Perspective / Side Selector -->
      <div class="flex items-center justify-between gap-2">
        <span class="shrink-0 text-xs text-text-secondary">
          {{ t('pages.study.orientationLabel') }}
        </span>
        <div class="grid grid-cols-3 gap-1">
          <button
            v-for="opt in (['auto', 'white', 'black'] as const)"
            :key="opt"
            type="button"
            :disabled="studyStore.isImporting"
            class="min-w-0 cursor-pointer overflow-hidden rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60"
            :class="
              orientationChoice === opt
                ? 'border-brand/60 bg-elevated text-brand'
                : 'border-border bg-canvas text-text-secondary hover:bg-elevated hover:text-text-primary'
            "
            @click="orientationChoice = opt"
          >
            <span class="block truncate">
              {{
                opt === 'auto'
                  ? t('pages.study.sideAuto')
                  : opt === 'white'
                    ? t('pages.study.sideWhite')
                    : t('pages.study.sideBlack')
              }}
            </span>
          </button>
        </div>
      </div>

      <!-- Auto-review toggle + Optional Coach question -->
      <div class="flex flex-col gap-2 rounded-md border border-border bg-canvas/70 p-2.5">
        <NCheckbox v-model:checked="autoReview" :disabled="studyStore.isImporting">
          <span class="text-xs text-text-primary">{{ t('pages.study.importAutoReview') }}</span>
        </NCheckbox>
        <input
          v-if="autoReview"
          v-model="customQuestion"
          type="text"
          maxlength="240"
          :disabled="studyStore.isImporting"
          :placeholder="t('pages.study.importQuestionPlaceholder')"
          class="w-full rounded-md border border-border bg-elevated px-2.5 py-1.5 font-display text-xs text-text-primary placeholder:text-text-disabled focus:border-brand focus:outline-none disabled:opacity-60"
        />
      </div>

      <!-- Live SSE Scan Status Bar -->
      <div
        v-if="studyStore.isImporting"
        class="flex items-center gap-2 rounded-md border border-brand/50 bg-elevated px-2.5 py-2 text-xs text-brand"
      >
        <NIcon :size="15" class="shrink-0 animate-pulse"><SparklesOutline /></NIcon>
        <span class="truncate font-condensed">
          {{ studyStore.importStatusLabel || t('pages.study.importWorking') }}
        </span>
      </div>

      <!-- Footer Action Buttons -->
      <div class="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          class="min-w-0 cursor-pointer overflow-hidden rounded-md border border-border bg-elevated px-3 py-1.5 font-display text-xs font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-overlay"
          @click="handleClose"
        >
          <span class="block truncate">{{ t('shared.buttons.cancel') }}</span>
        </button>

        <button
          type="button"
          :disabled="!canSubmit"
          class="min-w-0 cursor-pointer overflow-hidden rounded-md border-none bg-brand px-3 py-1.5 font-display text-xs font-semibold text-on-brand transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-45"
          @click="handleSubmit"
        >
          <span class="block truncate">{{ t('pages.study.importSubmit') }}</span>
        </button>
      </div>
    </div>
  </NModal>
</template>
