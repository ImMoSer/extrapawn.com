<script setup lang="ts">
import { BookOutline, OpenOutline } from '@vicons/ionicons5'
import DOMPurify from 'dompurify'
import { NEmpty, NIcon, NScrollbar, NText } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { WikiUrlBuilder } from '../api/WikiBooksService'
import { useWikiBooksStore } from '../index'

const { t } = useI18n()
const store = useWikiBooksStore()
const { wikiData, error, hasTheory, currentSlug } = storeToRefs(store)

const updateTheory = () => {
  store.updateMoves(pgnService.getCurrentSanPath())
}

onMounted(() => {
  updateTheory()
})

watch(pgnTreeVersion, () => {
  updateTheory()
})

const displayTitle = computed(() => {
  if (wikiData.value) {
    // Strip "Chess Opening Theory/" prefix
    return wikiData.value.title.replace('Chess Opening Theory/', '')
  }
  return t('features.analysis.openingTheory') || 'Opening Theory'
})

const externalLink = computed(() => {
  if (!currentSlug.value) return '#'
  return WikiUrlBuilder.getPublicUrl(currentSlug.value)
})

const sanitizedContent = computed(() => {
  if (!wikiData.value?.extract) return ''
  return DOMPurify.sanitize(wikiData.value.extract, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'strong', 'em', 'ul', 'li', 'br', 'h2', 'h3', 'h4'],
    ALLOWED_ATTR: [], // Security: No attributes allowed
  })
})
</script>

<template>
  <div class="wikibooks-panel">
    <div class="panel-header">
      <div class="header-left">
        <n-icon size="20" color="#2e7d32">
          <BookOutline />
        </n-icon>
        <h3 class="title">{{ displayTitle }}</h3>
      </div>
      <a
        v-if="hasTheory"
        :href="externalLink"
        target="_blank"
        rel="noopener noreferrer"
        class="external-link"
        :title="t('features.analysis.viewOnWikibooks') || 'View on Wikibooks'"
      >
        <n-icon size="18">
          <OpenOutline />
        </n-icon>
      </a>
    </div>

    <div class="panel-content-wrapper">
      <n-scrollbar style="max-height: 60vh" trigger="none">
        <div class="panel-content">
          <div v-if="error" class="state-container error">
            <span class="error-icon">⚠</span>
            <p>{{ error }}</p>
          </div>

          <div v-else-if="hasTheory" class="wiki-text" v-html="sanitizedContent"></div>

          <div v-else class="state-container empty">
            <n-empty
              :description="
                t('features.analysis.noTheoryFound') ||
                'No dedicated theory found for this position.'
              "
            >
              <template #extra>
                <n-text depth="3">{{
                  t('features.analysis.noTheorySubtext') || 'Try a more common move order.'
                }}</n-text>
              </template>
            </n-empty>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<style scoped>
.wikibooks-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.external-link {
  color: #2e7d32;
  text-decoration: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  opacity: 0.7;
}

.external-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

.panel-content-wrapper {
  flex: 1;
  overflow: hidden;
}

.panel-content {
  padding: 24px;
  font-size: 15px;
  line-height: 1.6;
  color: #ccc;
}

.wiki-text :deep(h2),
.wiki-text :deep(h3),
.wiki-text :deep(h4) {
  color: #2e7d32;
  margin-top: 2rem;
  margin-bottom: 1rem;
  line-height: 1.2;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
  font-weight: bold;
}

.wiki-text :deep(p) {
  margin-bottom: 1.2rem;
}

.wiki-text :deep(b),
.wiki-text :deep(strong) {
  color: #fff;
  font-weight: 700;
}

.wiki-text :deep(ul) {
  padding-left: 24px;
  margin-bottom: 1.2rem;
}

.wiki-text :deep(li) {
  margin-bottom: 0.6rem;
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  color: #888;
}

.mt-4 {
  margin-top: 16px;
}

.error {
  color: #ff4d4f;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 16px;
}
</style>
