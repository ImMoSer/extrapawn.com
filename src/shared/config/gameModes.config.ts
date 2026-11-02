import {
  FlameOutline,
  FlashOutline,
  PersonOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import type { Component } from 'vue'

export interface GameModeConfig {
  key: string
  path: string
  icon: Component
  labelKey: string
  color: string
}

export type GameModeKey = 'training_center' | 'warmup' | 'user_cabinet' | 'club_player'

export const GAME_MODES: Record<GameModeKey, GameModeConfig> = {
  training_center: {
    key: 'training_center',
    path: '/training',
    icon: FlashOutline,
    labelKey: 'shared.nav.trainingCenter',
    color: 'var(--color-neon-cyan)',
  },
  warmup: {
    key: 'warmup',
    path: '/warmup',
    icon: FlameOutline,
    labelKey: 'shared.nav.warmup',
    color: 'var(--color-neon-purple)',
  },
  user_cabinet: {
    key: 'user_cabinet',
    path: '/user-cabinet',
    icon: PersonOutline,
    labelKey: 'shared.nav.userCabinet',
    color: 'var(--color-orange)',
  },
  club_player: {
    key: 'club_player',
    path: '/club-player',
    icon: TrophyOutline,
    labelKey: 'pages.pricing.clubBtn',
    color: 'var(--color-danger-deep)',
  },
}
