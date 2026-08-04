<script setup lang="ts">
import { useTelegramPrompt } from '@/features/access-control'

// Installs background logic for proactive Telegram link offer
useTelegramPrompt()
</script>

<template>
  <!-- No visual output, triggers uiStore confirmation modal when appropriate -->
  <div style="display: none" />
</template>
