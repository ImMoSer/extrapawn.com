<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePuzzleStore } from '../model/puzzle.store';
import { useDemoplayStore } from '@/features/demoplay';
 
const props = defineProps<{
  submode: string
}>()
 
const puzzleStore = usePuzzleStore()
const demoplayStore = useDemoplayStore()
const { t } = useI18n()
 
const puzzle = computed(() => puzzleStore.activePuzzle)

// Map submode to correct shared.gameModes translation key (camelCase)
const submodeTranslationKey = computed(() => {
  switch (props.submode) {
    case 'finish_him':
      return 'shared.gameModes.finishHim'
    case 'theory_endings':
      return 'shared.gameModes.theoryEndgames'
    case 'practical_chess':
      return 'shared.gameModes.practicalChess'
    case 'tactics':
      return 'shared.gameModes.tactics'
    default:
      return ''
  }
})

// Map puzzle types to distinct highlight styles & gradients
const puzzleMeta = computed(() => {
  const type = props.submode
  switch (type) {
    case 'finish_him':
      return {
        label: submodeTranslationKey.value ? t(submodeTranslationKey.value) : 'Finish Him',
        gradient: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
        glowColor: 'rgba(244, 63, 94, 0.4)',
        borderColor: 'rgba(244, 63, 94, 0.25)'
      }
    case 'theory_endings':
      return {
        label: submodeTranslationKey.value ? t(submodeTranslationKey.value) : 'Theory Endings',
        gradient: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
        glowColor: 'rgba(168, 85, 247, 0.4)',
        borderColor: 'rgba(168, 85, 247, 0.25)'
      }
    case 'practical_chess':
      return {
        label: submodeTranslationKey.value ? t(submodeTranslationKey.value) : 'Practical Chess',
        gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        glowColor: 'rgba(59, 130, 246, 0.4)',
        borderColor: 'rgba(59, 130, 246, 0.25)'
      }
    case 'tactics':
      return {
        label: submodeTranslationKey.value ? t(submodeTranslationKey.value) : 'Tactics',
        gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
        glowColor: 'rgba(245, 158, 11, 0.4)',
        borderColor: 'rgba(245, 158, 11, 0.25)'
      }
    default:
      return {
        label: type.toUpperCase(),
        gradient: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
        glowColor: 'rgba(100, 116, 139, 0.4)',
        borderColor: 'rgba(100, 116, 139, 0.25)'
      }
  }
})

// Extract motifs/categories
const categoriesList = computed(() => {
  if (!puzzle.value || puzzle.value.puzzle_type !== props.submode) return []
  if (puzzle.value.category_comby && puzzle.value.category_comby.length > 0) {
    return puzzle.value.category_comby
  }
  return [puzzle.value.category]
})

// Translate theme/motif name
function formatThemeName(theme: string): string {
  const key = props.submode === 'tactics' ? `puzzleCategories.tactics.${theme}` : `puzzleCategories.themes.${theme}`
  const translation = t(key)
  if (translation && !translation.startsWith('puzzleCategories.')) {
    return translation
  }
  const spaced = theme.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Translate sub_category from puzzleCategories.subThemes
function formatSubTheme(subTheme: string): string {
  const key = `puzzleCategories.subThemes.${subTheme}`
  const translation = t(key)
  if (translation && !translation.startsWith('puzzleCategories.')) {
    return translation
  }
  const spaced = subTheme.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
</script>

<template>
  <div class="hallo-header-container">
    <!-- Large, prominent active puzzle card (styled like a docked modal window) -->
    <div v-if="puzzle && puzzle.puzzle_type === props.submode"
         class="active-puzzle-card"
         :style="{ '--glow-color': puzzleMeta.glowColor, '--border-color': puzzleMeta.borderColor }"
    >
      <div class="card-glow-overlay"></div>

      <!-- Top Title Tag -->
      <div class="card-header-badge" :style="{ background: puzzleMeta.gradient }">
        {{ puzzleMeta.label }}<template v-if="demoplayStore.isDemoplayEnabled"> ({{ demoplayStore.demoplayCount }}/100)</template>
      </div>
 
       <!-- Content Grid -->
       <div class="card-body">
         <div class="meta-row">
           <!-- Rating badge -->
           <span v-if="puzzle.rating" class="rating-badge">
             <span class="star-icon">⭐</span>
             <span class="rating-label">{{ t('features.puzzle.header.rating', 'Rating') }}:</span>
             <span class="rating-num">{{ puzzle.rating }}</span>
           </span>
 
           <!-- Subcategory / Style -->
           <span v-if="puzzle.sub_category" class="style-badge">
             <span class="pawn-icon">♟️</span>
             {{ formatSubTheme(puzzle.sub_category) }}
           </span>
         </div>
 
         <!-- Tactical Motifs / Themes List -->
         <div v-if="categoriesList.length > 0" class="motifs-section">
           <div class="motifs-label">{{ t('features.puzzle.header.motifs', 'Tactical Motifs') }}</div>
           <div class="chips-container">
             <span
               v-for="cat in categoriesList"
               :key="cat"
               class="theme-chip"
             >
               {{ formatThemeName(cat) }}
             </span>
           </div>
         </div>
       </div>
     </div>
 
     <!-- Default Fallback Header Title -->
     <div v-else class="default-title">
       {{ puzzleMeta.label }}
     </div>
   </div>
 </template>
 
 <style scoped>
 .hallo-header-container {
   display: flex;
   flex-direction: column;
   width: 100%;
 }
 
 /* Large Modal-Like Header Card */
 .active-puzzle-card {
   position: relative;
   box-sizing: border-box;
   background: linear-gradient(135deg, rgba(23, 28, 48, 0.95) 0%, rgba(15, 18, 36, 0.98) 100%);
   border: 1px solid var(--border-color);
   border-radius: 10px;
   padding: 24px 12px 16px 12px;
   box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5),
               0 0 12px var(--glow-color),
               inset 0 0 15px rgba(255, 255, 255, 0.02);
   margin-top: 10px;
   overflow: hidden;
   transition: all 0.3s ease;
 }
 
 .card-glow-overlay {
   position: absolute;
   top: 0;
   left: 0;
   right: 0;
   height: 4px;
   background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%);
 }
 
 /* Top Floating Tag */
 .card-header-badge {
   position: absolute;
   top: 0;
   left: 50%;
   transform: translateX(-50%);
   padding: 3px 14px;
   font-size: 15px;
   font-weight: 800;
   letter-spacing: 0.1em;
   text-transform: uppercase;
   color: #ffffff;
   border-radius: 0 0 8px 8px;
   box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
   white-space: nowrap;
 }

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
}

/* Metadata Row */
.meta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  display: none;
}

.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.25);
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.05);
}

.star-icon {
  font-size: 10px;
}

.rating-label {
  color: rgba(245, 158, 11, 0.7);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rating-num {
  font-family: monospace;
}

.style-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
}

.pawn-icon {
  font-size: 11px;
}

/* Motifs section */
.motifs-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 10px;
}

.motifs-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.08em;
  text-align: center;
  display: none;
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.theme-chip {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 30px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.theme-chip:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

/* Fallback default Title */
.default-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.75px;
  color: var(--color-text-primary);
  text-transform: uppercase;
}
</style>
