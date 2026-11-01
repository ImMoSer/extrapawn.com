<script setup lang="ts">
import {
  CashOutline,
  FlameOutline,
  FlashOutline,
  HomeOutline,
  InformationCircleOutline,
  PersonOutline,
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

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

const ParagraphIcon = () =>
  h('span', { style: 'font-weight: bold; font-size: 1.2rem; font-family: serif;' }, '§')

const menuOptions: MenuOption[] = [
  {
    label: () => t('shared.nav.home'),
    key: '/',
    icon: renderIcon(HomeOutline),
  },
  {
    label: () => t('shared.nav.trainingCenter'),
    key: '/training',
    icon: renderIcon(FlashOutline),
  },
  {
    label: () => t('shared.nav.warmup'),
    key: '/warmup',
    icon: renderIcon(FlameOutline),
  },
  {
    label: () => t('shared.nav.userCabinet'),
    key: '/user-cabinet',
    icon: renderIcon(PersonOutline),
  },
  {
    label: () => 'Club Top 20',
    key: '/club-player',
    icon: renderIcon(TrophyOutline),
  },
  {
    label: () => t('shared.nav.pricing'),
    key: '/pricing',
    icon: renderIcon(CashOutline),
  },
  {
    label: () => t('shared.nav.about'),
    key: '/about',
    icon: renderIcon(InformationCircleOutline),
  },
  {
    label: () => t('shared.nav.legal'),
    key: '/legal',
    icon: renderIcon(ParagraphIcon),
  },
]

const activeKey = computed(() => {
  const path = route.path
  if (path === '/') return '/'

  const matched = menuOptions.find(
    (opt) => opt.key && opt.key !== '/' && path.startsWith(opt.key as string),
  )
  if (matched) return matched.key as string

  return path
})

const handleUpdateValue = (key: string) => {
  void router.push(key)
  emit('select', key)
}
</script>

<template>
  <div class="w-full font-display font-medium">
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
