<script setup lang="ts">
import {
  ThumbsDown,
  ThumbsDownOutline,
  ThumbsUp,
  ThumbsUpOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { PuzzleVoteValue } from '../model/training.types'

const props = withDefaults(
  defineProps<{
    vote?: PuzzleVoteValue
    disabled?: boolean
  }>(),
  {
    vote: 0,
    disabled: false,
  },
)

const emit = defineEmits<{
  vote: [nextVote: PuzzleVoteValue]
}>()

const { t } = useI18n()

function handleVoteClick(clicked: 1 | -1): void {
  if (props.disabled) return
  const next: PuzzleVoteValue = props.vote === clicked ? 0 : clicked
  emit('vote', next)
}
</script>

<template>
  <div class="inline-flex items-center gap-1 shrink-0" @click.stop>
    <button
      type="button"
      :disabled="disabled"
      :title="t('features.puzzleFeedback.vote.likeTooltip')"
      :aria-label="t('features.puzzleFeedback.vote.likeTooltip')"
      :aria-pressed="vote === 1"
      class="w-7 h-7 rounded-sm border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      :class="
        vote === 1
          ? 'bg-success/20 border-success/50 text-success'
          : 'bg-transparent border-transparent text-success/70 hover:bg-success/15 hover:border-success/35 hover:text-success'
      "
      @click.stop="handleVoteClick(1)"
    >
      <NIcon size="15">
        <ThumbsUp v-if="vote === 1" />
        <ThumbsUpOutline v-else />
      </NIcon>
    </button>

    <button
      type="button"
      :disabled="disabled"
      :title="t('features.puzzleFeedback.vote.dislikeTooltip')"
      :aria-label="t('features.puzzleFeedback.vote.dislikeTooltip')"
      :aria-pressed="vote === -1"
      class="w-7 h-7 rounded-sm border flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      :class="
        vote === -1
          ? 'bg-danger/20 border-danger/50 text-danger'
          : 'bg-transparent border-transparent text-danger/70 hover:bg-danger/15 hover:border-danger/35 hover:text-danger'
      "
      @click.stop="handleVoteClick(-1)"
    >
      <NIcon size="15">
        <ThumbsDown v-if="vote === -1" />
        <ThumbsDownOutline v-else />
      </NIcon>
    </button>
  </div>
</template>
