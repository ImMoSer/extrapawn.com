<script setup lang="ts">
import {
  BookOutline,
  BuildOutline,
  CashOutline,
  DiamondOutline,
  FlashOutline,
  HammerOutline,
  HomeOutline,
  InformationCircleOutline,
  PersonOutline,
  SchoolOutline,
  ThunderstormOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NIcon, NMenu, type MenuOption } from 'naive-ui'
import { computed, h, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])

/**
 * Рендерит иконку n-icon
 */
function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

// Custom Icon for Legal (§)
const ParagraphIcon = () =>
  h('span', { style: 'font-weight: bold; font-size: 1.2rem; font-family: serif;' }, '§')

const menuOptions: MenuOption[] = [
  {
    label: () => t('nav.home'),
    key: '/',
    icon: renderIcon(HomeOutline),
  },
  {
    label: () => t('nav.finishHim'),
    key: '/finish-him',
    icon: renderIcon(HammerOutline),
  },
  {
    label: () => t('nav.tornado'),
    key: '/tornado',
    icon: renderIcon(ThunderstormOutline),
  },
  {
    label: () => t('nav.theoryEndgames'),
    key: '/theory-endings',
    icon: renderIcon(BookOutline),
  },
  {
    label: () => t('nav.practicalChess'),
    key: '/practical-chess',
    icon: renderIcon(BuildOutline),
  },
  {
    label: () => t('nav.diamondHunter'),
    key: '/diamond-hunter',
    icon: renderIcon(DiamondOutline),
  },
  {
    label: () => t('nav.openingSparring'),
    key: '/opening-sparring',
    icon: renderIcon(FlashOutline),
  },
  {
    label: () => t('nav.repertoire'),
    key: '/study',
    icon: renderIcon(SchoolOutline),
  },
  {
    label: () => t('nav.leaderboards'),
    key: '/records',
    icon: renderIcon(TrophyOutline),
  },
  {
    label: () => t('nav.userCabinet'),
    key: '/user-cabinet',
    icon: renderIcon(PersonOutline),
  },
  {
    label: () => t('nav.pricing'),
    key: '/pricing',
    icon: renderIcon(CashOutline),
  },
  {
    label: () => t('nav.about'),
    key: '/about',
    icon: renderIcon(InformationCircleOutline),
  },
  {
    label: () => t('nav.legal'),
    key: '/legal',
    icon: renderIcon(ParagraphIcon),
  },
]

// Determine current active key based on route path
const activeKey = computed(() => {
  const path = route.path
  if (path === '/') return '/'

  // Find match
  const matched = menuOptions.find((opt) => opt.key && path.startsWith(opt.key as string))
  if (matched) return matched.key as string

  return path
})

const handleUpdateValue = (key: string) => {
  router.push(key)
  emit('select', key)
}
</script>

<template>
  <div class="nav-menu-wrapper">
    <n-menu
      :value="activeKey"
      :collapsed="collapsed"
      :collapsed-width="64"
      :collapsed-icon-size="22"
      :options="menuOptions"
      @update:value="handleUpdateValue"
    />
  </div>
</template>

<style scoped>
.nav-menu-wrapper {
  width: 100%;
}

:deep(.n-menu-item-content-header) {
  font-family: inherit;
  font-weight: 500;
}
</style>
