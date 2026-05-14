<script setup lang="ts">
import { useVersionUpdate } from '../lib/useVersionUpdate'

// This component just installs the background version checking
// and it's placed inside the n-dialog-provider in App.vue
useVersionUpdate()
</script>

<template>
  <!-- No visual output, just background logic -->
  <div style="display: none" />
</template>
