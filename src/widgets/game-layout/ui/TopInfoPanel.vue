<script setup lang="ts">
import { NTooltip } from 'naive-ui'
import { useTopInfo } from '../model/useTopInfo'

const { displayInfo } = useTopInfo()
</script>

<template>
  <div class="top-info-panel-container" :class="[`mode-${displayInfo.customType || 'default'}`]">
    <div class="generic-info-layout">
      <!-- Left: Badges (Glued) -->
      <div class="info-left">
        <template v-for="(badge, index) in displayInfo.badges" :key="'b' + index">
          <span class="glued-item badge-text" :style="badge.color ? { color: badge.color } : {}">
            {{ badge.text.toUpperCase() }}
          </span>
          <span v-if="index < displayInfo.badges.length - 1" class="glue">/</span>
        </template>
      </div>

      <!-- Center: Title, MainValue, Secondary (Glued) -->
      <div class="info-center">
        <span v-if="displayInfo.title" class="glued-item info-title">
          {{ displayInfo.title }}
        </span>

        <span
          v-if="
            displayInfo.title && (displayInfo.mainValue !== undefined || displayInfo.secondaryText)
          "
          class="glue"
          >/</span
        >

        <span
          v-if="displayInfo.mainValue !== undefined"
          class="glued-item main-value"
          :style="{ color: displayInfo.mainColor }"
        >
          {{ displayInfo.isValueHidden ? '??' : displayInfo.mainValue }}
        </span>

        <span v-if="displayInfo.mainValue !== undefined && displayInfo.secondaryText" class="glue"
          >/</span
        >

        <span v-if="displayInfo.secondaryText" class="glued-item secondary-text">
          {{ displayInfo.secondaryText }}
        </span>
      </div>

      <!-- Right: Stats (Glued) -->
      <div class="info-right">
        <template v-for="(stat, index) in displayInfo.stats" :key="'s' + index">
          <n-tooltip trigger="hover" v-if="stat.value !== undefined">
            <template #trigger>
              <span class="glued-item stat-value" :style="{ color: stat.color }">
                {{ stat.value }}
              </span>
            </template>
            {{ stat.label || '' }}
          </n-tooltip>
          <span
            v-if="index < displayInfo.stats.length - 1 && displayInfo.stats[index + 1]?.value"
            class="glue"
            >/</span
          >
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.top-info-panel-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  box-sizing: border-box;
}

.generic-info-layout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 8px; /* ->->->-> Spacing */
}

/* --- Columns --- */
.info-left {
  flex: 1;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  white-space: nowrap;
}

.info-center {
  flex: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  white-space: nowrap;
}

.info-right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  white-space: nowrap;
}

/* --- Glued Elements --- */
.glue {
  color: var(--color-text-muted);
  font-weight: 300;
  margin: 0 6px;
  opacity: 0.6;
  font-size: 1.2rem;
}

.glued-item {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  letter-spacing: 0.5px;
  font-size: 1.2rem;
  text-transform: uppercase;
}

.badge-text {
  color: var(--color-text-secondary);
}

.info-title {
  color: var(--color-primary);
}

.secondary-text {
  color: var(--color-text-secondary);
  /* The user wants FinishHim's secondaryText (Complex Endgame) to stay as is.
     We can disable uppercase here or control it via stores.
     Let's disable global uppercase for secondary-text to let the store decide. */
  text-transform: none;
}

.stat-value {
  color: var(--color-accent-info);
}

/* --- Mobile Adaptation --- */
@media (max-width: 768px) {
  .generic-info-layout {
    flex-direction: column;
    gap: 4px;
    justify-content: center;
  }

  .info-left {
    display: none;
  }

  .info-center,
  .info-right {
    flex: none;
    width: 100%;
    justify-content: center;
  }

  .mode-opening-sparring .info-left {
    display: flex;
    flex: none;
    width: 100%;
    justify-content: center;
  }

  .mode-opening-sparring .info-center {
    display: none;
  }

  .glued-item,
  .glue {
    font-size: 0.9rem;
  }

  .glue {
    margin: 0 4px;
  }
}
</style>
