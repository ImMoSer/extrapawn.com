<template>
  <svg
    v-if="iconData"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :style="{ color, display: 'block' }"
    aria-hidden="true"
  >
    <g v-if="quality === 'brilliant'">
      <path d="M9.5 4.5h2v9h-2zM12.5 4.5h2v9h-2z" fill="currentColor" />
      <circle cx="10.5" cy="18" r="1.6" fill="currentColor" />
      <circle cx="13.5" cy="18" r="1.6" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="currentColor" opacity="0.7" />
      <circle cx="18" cy="9" r="0.7" fill="currentColor" opacity="0.55" />
      <circle cx="20" cy="17" r="0.6" fill="currentColor" opacity="0.4" />
    </g>

    <g v-else-if="quality === 'great'">
      <path d="M11 4.5h2v9h-2z" fill="currentColor" />
      <circle cx="12" cy="18" r="1.7" fill="currentColor" />
    </g>

    <path
      v-else-if="quality === 'best'"
      d="M12 3l2.6 5.85L21 9.6l-4.8 4.27L17.5 21 12 17.6 6.5 21l1.3-7.13L3 9.6l6.4-.75z"
      fill="currentColor"
    />

    <path
      v-else-if="quality === 'excellent'"
      d="M5 12.5l4 4 10-10"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />

    <g v-else-if="quality === 'inaccuracy'">
      <path
        d="M7 8.5a3.5 3.5 0 116.2 2.3c-.7.7-1.7 1.3-1.7 2.7v.5"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="11.5" cy="18" r="1.5" fill="currentColor" />
      <path d="M17 4.5h1.6v8H17z" fill="currentColor" />
      <circle cx="17.8" cy="15.5" r="1.1" fill="currentColor" />
    </g>

    <g v-else-if="quality === 'mistake'">
      <path
        d="M8 8.5a4 4 0 117.2 2.5c-.8.8-2 1.5-2 3v.7"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="13.2" cy="18.2" r="1.7" fill="currentColor" />
    </g>

    <g v-else-if="quality === 'blunder'">
      <path
        d="M3.5 8.5a3 3 0 015.5-1.6c.7 1 .3 2-.5 2.7-.7.6-1.5 1.2-1.5 2.4v.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="6.5" cy="16" r="1.4" fill="currentColor" />
      <path
        d="M13.5 8.5a3 3 0 015.5-1.6c.7 1 .3 2-.5 2.7-.7.6-1.5 1.2-1.5 2.4v.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="16.5" cy="16" r="1.4" fill="currentColor" />
    </g>

    <g v-else-if="quality === 'missed_mate'">
      <path
        d="M5 5l14 14M19 5L5 19"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  quality: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: 16,
  },
  color: {
    type: String,
    default: 'currentColor',
  },
})

const validQualities = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'inaccuracy',
  'mistake',
  'blunder',
  'missed_mate',
]

const iconData = computed(() => {
  return validQualities.includes(props.quality)
})
</script>
