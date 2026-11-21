<script setup lang="ts">
withDefaults(
  defineProps<{
    verticalCenter?: boolean
  }>(),
  {
    verticalCenter: false,
  },
)
</script>

<template>
  <div class="app-page-scroll">
    <div
      class="app-page-shell"
      :class="{ 'app-page-shell--centered': verticalCenter }"
    >
      <div class="app-page-stage @container">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-page-scroll {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable both-edges;
  box-sizing: border-box;
}

.app-page-shell {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: var(--page-pad-y) var(--layout-pad) var(--page-pad-bottom);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-page-shell--centered {
  justify-content: center;
  padding-top: var(--layout-pad);
  padding-bottom: var(--layout-pad);
}

.app-page-stage {
  width: min(100%, var(--page-stage-w));
  min-width: 0;
}

@media (max-width: 899px), (orientation: portrait) {
  .app-page-scroll {
    scrollbar-gutter: auto;
  }

  .app-page-shell {
    padding: 8px 6px 16px;
  }

  .app-page-shell--centered {
    padding: 10px 6px 16px;
  }

  .app-page-stage {
    width: 100%;
  }
}
</style>
