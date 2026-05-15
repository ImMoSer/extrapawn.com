<script setup lang="ts">
import { useAnalysisEngineStore } from '@/entities/analysis';
import logger from '@/shared/lib/logger';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const isReady = ref(false)
const showLoaderUI = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const progress = ref(0)

const { t } = useI18n({ useScope: 'global' })

// Assets split by priority to follow strict sequential loading

const SECONDARY_ASSETS = [
  '/npm_stockfish/sf_1807_multi_lite/stockfish-18-lite.js',
  '/npm_stockfish/sf_1807_multi_lite/stockfish-18-lite.wasm',
]

// Dynamically discover all sound files to include them in the permanent Cache API
const soundModules = import.meta.glob('/public/sounds/**/*.mp3')
const SOUND_ASSETS = Object.keys(soundModules).map((path) => path.replace('/public', ''))

const CACHE_NAME = 'stockfish-assets-v1'

async function preloadAssets() {
  const tTotalStart = performance.now()
  logger.info('[LoaderProfiler] Starting background asset loading sequence...')
  hasError.value = false
  errorMessage.value = ''

  // Show minimal overlay if loading takes more than 300ms
  const uiTimer = setTimeout(() => {
    if (!isReady.value && !hasError.value) showLoaderUI.value = true
  }, 300)

  try {
    // 1. Multi-Thread Engine (Essential)
    logger.info('[LoaderProfiler] Step 1/3: Loading Multi-Thread Engine...')
    await loadAssetGroup(SECONDARY_ASSETS)
    progress.value = 33

    // 2. Global Database Initialization
    logger.info('[LoaderProfiler] Step 2/3: Initializing Global Database...')
    const { databaseClient } = await import('@/shared/api/storage/DatabaseClient')
    await databaseClient.init()
    progress.value = 66

    // CRITICAL: We are now "Ready" for basic interaction
    isReady.value = true
    clearTimeout(uiTimer)
    emit('ready')
    logger.info(
      `[LoaderProfiler] Cabinet ready after ${(performance.now() - tTotalStart).toFixed(2)}ms.`,
    )

    // 3. Background Audio Assets (Final Step)
    logger.info('[LoaderProfiler] Step 3/3: Triggering background Audio Cache...')
    // We only put them in the Cache API. We do NOT preload all HTMLAudioElements in memory anymore.
    loadAssetGroup(SOUND_ASSETS).catch((e) => logger.warn('Audio cache failed:', e))

    progress.value = 100

    // Background warming
    useAnalysisEngineStore()
      .initialize()
      .catch((e) => logger.warn('Engine warming failed:', e))
  } catch (error) {
    logger.error(`[LoaderProfiler] FATAL ERROR during background boot:`, error)
    hasError.value = true
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function loadAssetGroup(urls: string[]) {
  const cache = await caches.open(CACHE_NAME)
  for (const url of urls) {
    const cachedResponse = await cache.match(url)
    if (cachedResponse) continue

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`)
    await cache.put(url, response.clone())

    const reader = response.body?.getReader()
    if (reader) {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }
  }
}

onMounted(() => {
  preloadAssets()
})
</script>

<template>
  <!-- App content is ALWAYS rendered now to allow background initialization -->
  <slot></slot>

  <!-- Background Progress Modal (only shown if loading takes time) -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="showLoaderUI && progress < 100" class="background-loader-overlay">
        <div class="loader-modal">
          <div class="spinner"></div>
          <div class="loader-info">
            <h3 class="loader-title">EXTRAPAWN</h3>
            <p class="loader-text">{{ t('app.globalLoader.warmingMessage') }}</p>
            <div class="mini-progress-track">
              <div class="mini-progress-bar" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-percent">{{ progress }}%</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Global Error Overlay -->
  <Teleport to="body">
    <div v-if="hasError" class="error-overlay">
      <div class="loader-content webview-blocker">
        <img src="/png/extra_pawn_black.png" alt="Logo" class="loader-logo static" />
        <h2 class="loader-title error-text">{{ t('common.actions.error') }}</h2>
        <p class="loader-text">
          {{ t('app.globalLoader.error') }}
        </p>
        <p v-if="errorMessage" class="loader-hint" style="margin-bottom: 20px; color: #ff4d4f">
          {{ errorMessage }}
        </p>
        <button @click="preloadAssets" class="copy-button">
          {{ t('common.actions.retry') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.background-loader-overlay {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10000;
  pointer-events: none;
}

.loader-modal {
  background: rgba(15, 17, 26, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 242, 255, 0.2);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  width: 300px;
  pointer-events: auto;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(0, 242, 255, 0.1);
  border-top: 2px solid #00f2ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

.loader-info {
  flex-grow: 1;
}

.loader-title {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: #00f2ff;
}

.loader-text {
  margin: 2px 0 8px 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.mini-progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.mini-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #00f2ff, #0088ff);
  transition: width 0.3s ease;
}

.progress-percent {
  display: block;
  text-align: right;
  font-size: 0.65rem;
  color: #00f2ff;
  margin-top: 4px;
}

.error-overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 13, 23, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 11000;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 400px;
  width: 90%;
  text-align: center;
  padding: 40px;
  background: rgba(15, 17, 26, 1);
  border: 1px solid rgba(255, 60, 60, 0.3);
  border-radius: 24px;
}

.copy-button {
  width: 100%;
  padding: 12px 24px;
  background: #00f2ff;
  border: none;
  border-radius: 12px;
  color: #0b0d17;
  font-weight: 700;
  cursor: pointer;
}

.loader-logo {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
}
</style>
