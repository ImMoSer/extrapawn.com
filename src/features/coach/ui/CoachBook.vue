<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { BookOutline, OpenOutline } from '@vicons/ionicons5'
import DOMPurify from 'dompurify'
import { NIcon, NScrollbar } from 'naive-ui'
import { computed, ref } from 'vue'
import { useCoachBookStore } from '../model/coach-book.store'

const bookStore = useCoachBookStore()
const boardStore = useBoardStore()

const wikiInfo = computed(() => bookStore.currentWikiInfo)
const hasTheory = computed(() => !!wikiInfo.value)
const isExpanded = ref(false)
const isContinuationsExpanded = ref(true)

function formatMoveName(name: string): string {
  return name.trim()
}

const sanitizedContent = computed(() => {
  if (!wikiInfo.value?.wikibooksContent) return ''
  return DOMPurify.sanitize(wikiInfo.value.wikibooksContent, {
    ALLOWED_TAGS: ['p', 'b', 'i', 'strong', 'em', 'ul', 'li', 'br', 'h2', 'h3', 'h4'],
    ALLOWED_ATTR: [],
  })
})

const formattedUciPath = computed(() => {
  const sanList = wikiInfo.value?.canonicalSanPath || []
  const formatted: string[] = []
  for (let i = 0; i < sanList.length; i++) {
    const move = sanList[i]
    if (!move) continue
    if (i % 2 === 0) {
      formatted.push(`${Math.floor(i / 2) + 1}. ${move}`)
    } else {
      formatted.push(move)
    }
  }
  return formatted.join(' ')
})

function handleContinuationClick(uci: string) {
  boardStore.applyUciMove(uci)
}
</script>

<template>
  <div v-if="!bookStore.isOutOfBook && hasTheory && wikiInfo" class="coach-book">
    <!-- Header -->
    <div class="book-header">
      <div class="title-section">
        <n-icon size="14" class="icon-book"><BookOutline /></n-icon>
        <span class="opening-name">{{ wikiInfo.name }}</span>
        <span v-if="wikiInfo.eco !== '-'" class="eco-badge">{{ wikiInfo.eco }}</span>
      </div>
      <a
        v-if="wikiInfo.wikibooksUrl"
        :href="wikiInfo.wikibooksUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="external-link"
        title="Open Wikibooks opening page"
      >
        <n-icon size="12"><OpenOutline /></n-icon>
      </a>
    </div>

    <!-- Path Info (Transposition proof!) -->
    <div class="wiki-path-box">
      <span class="path-label">Wiki Path</span>
      <span class="path-moves">{{ formattedUciPath }}</span>
    </div>

    <!-- Collapsible Theory Block -->
    <div v-if="sanitizedContent" class="theory-details">
      <button class="expand-btn" @click="isExpanded = !isExpanded">
        <span class="expand-arrow" :class="{ 'is-expanded': isExpanded }">▸</span>
        <span>Theoretical Summary</span>
      </button>

      <div v-if="isExpanded" class="theory-text-wrapper">
        <n-scrollbar style="max-height: 500px" trigger="none">
          <div class="theory-html" v-html="sanitizedContent"></div>
        </n-scrollbar>
      </div>
    </div>

    <!-- Continuation Moves (Strict forward tree) -->
    <div v-if="wikiInfo.forwardMoves.length > 0" class="continuations-section">
      <button class="expand-btn" @click="isContinuationsExpanded = !isContinuationsExpanded">
        <span class="expand-arrow" :class="{ 'is-expanded': isContinuationsExpanded }">▸</span>
        <span>Theoretical Continuations</span>
      </button>

      <div v-if="isContinuationsExpanded" class="moves-grid-wrapper">
        <n-scrollbar style="max-height: 200px" trigger="none">
          <div class="moves-grid">
            <button
              v-for="move in wikiInfo.forwardMoves"
              :key="move.uci"
              class="move-btn"
              @click="handleContinuationClick(move.uci)"
              :title="move.name ? `${move.san} - ${move.name}` : `Play ${move.san}`"
            >
              <span class="move-san">{{ move.san }}</span>
              <span v-if="move.name" class="move-name">
                <span v-if="move.isNearestDescendant" class="arrow-indicator">→</span>
                {{ formatMoveName(move.name) }}
              </span>
            </button>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </div>
  <div v-else-if="!bookStore.isOutOfBook && bookStore.isLoading" class="coach-book-loading">
    <div class="spinner"></div>
    <span>Loading theoretical lines...</span>
  </div>
</template>

<style scoped>
.coach-book {
  padding: 12px 14px;
  border-bottom: 1px solid #27272a;
  background: rgba(46, 125, 50, 0.02);
}

.coach-book-loading {
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #71717a;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(46, 125, 50, 0.2);
  border-top: 2px solid #2e7d32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.book-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.icon-book {
  color: #2e7d32;
  flex-shrink: 0;
}

.opening-name {
  font-size: 13px;
  font-weight: 700;
  color: #fafafa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.eco-badge {
  font-size: 10px;
  font-weight: 700;
  background-color: rgba(46, 125, 50, 0.15);
  color: #4caf50;
  border: 1px solid rgba(46, 125, 50, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.external-link {
  color: #2e7d32;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  opacity: 0.7;
  padding-left: 6px;
}

.external-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

.wiki-path-box {
  margin-top: 4px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.path-label {
  color: #52525b;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin-right: 6px;
  display: block;
}

.path-moves {
  color: #a1a1aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.theory-details {
  margin-top: 8px;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: #71717a;
  font-weight: 600;
  padding: 0;
  outline: none;
}

.expand-arrow {
  display: inline-block;
  transition: transform 120ms ease;
  font-size: 10px;
}

.expand-arrow.is-expanded {
  transform: rotate(90deg);
}

.theory-text-wrapper {
  margin-top: 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.theory-html {
  font-size: 11px;
  line-height: 1.5;
  color: #d4d4d8;
}

.theory-html :deep(p) {
  margin-bottom: 8px;
}
.theory-html :deep(p:last-child) {
  margin-bottom: 0;
}

.theory-html :deep(strong),
.theory-html :deep(b) {
  color: #fff;
  font-weight: 600;
}

.continuations-section {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #52525b;
  margin-bottom: 6px;
}

.moves-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 6px;
}

.move-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  width: 100%;
}

.move-btn:hover {
  background: rgba(46, 125, 50, 0.08);
  border-color: rgba(46, 125, 50, 0.3);
}

.move-san {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
  color: #86efac;
  background: rgba(134, 239, 172, 0.08);
  padding: 1px 6px;
  border-radius: 4px;
  min-width: 42px;
  text-align: center;
}

.move-name {
  font-size: 11px;
  color: #a1a1aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  display: flex;
  align-items: center;
}

.moves-grid-wrapper {
  margin-top: 8px;
}

.arrow-indicator {
  color: #4caf50;
  font-weight: bold;
  margin-right: 4px;
  flex-shrink: 0;
}
</style>
