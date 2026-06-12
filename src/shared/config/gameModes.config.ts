import {
  BookOutline,
  SkullOutline,
  GridOutline,
  ExtensionPuzzleOutline,
  FlashOutline,
  HardwareChipOutline,
  PersonOutline,
  TrophyOutline,
  SchoolOutline,
  AnalyticsOutline,
} from '@vicons/ionicons5'
import type { Component } from 'vue'

export interface GameModeConfig {
  key: string
  path: string
  icon: Component
  labelKey: string
  color: string
}

export type GameModeKey =
  | 'theory_endings'
  | 'finish_him'
  | 'practical_chess'
  | 'tactics'
  | 'task_today'
  | 'sparring'
  | 'repertoire_training'
  | 'open_check'
  | 'user_cabinet'
  | 'records'

export const GAME_MODES: Record<GameModeKey, GameModeConfig> = {
  theory_endings: {
    key: 'theory_endings',
    path: '/theory-endings',
    icon: BookOutline,
    labelKey: 'shared.nav.theoryEndgames',
    color: 'var(--neon-yellow)',
  },
  finish_him: {
    key: 'finish_him',
    path: '/finish-him',
    icon: SkullOutline,
    labelKey: 'shared.nav.finishHim',
    color: 'var(--neon-purple)',
  },
  practical_chess: {
    key: 'practical_chess',
    path: '/practical-chess',
    icon: GridOutline,
    labelKey: 'shared.nav.practicalChess',
    color: 'var(--neon-blue)',
  },
  tactics: {
    key: 'tactics',
    path: '/tactics',
    icon: ExtensionPuzzleOutline,
    labelKey: 'shared.nav.tactics',
    color: 'var(--neon-pink)',
  },
  task_today: {
    key: 'task_today',
    path: '/task-today',
    icon: FlashOutline,
    labelKey: 'shared.nav.taskToday',
    color: 'var(--neon-cyan)',
  },
  sparring: {
    key: 'sparring',
    path: '/sparring',
    icon: HardwareChipOutline,
    labelKey: 'shared.nav.sparring',
    color: 'var(--neon-lime)',
  },
  repertoire_training: {
    key: 'repertoire_training',
    path: '/repertoire-training',
    icon: SchoolOutline,
    labelKey: 'shared.nav.repertoire',
    color: 'var(--neon-green)',
  },
  open_check: {
    key: 'open_check',
    path: '/open-check',
    icon: AnalyticsOutline,
    labelKey: 'shared.nav.openCheck',
    color: 'var(--neon-teal)',
  },
  user_cabinet: {
    key: 'user_cabinet',
    path: '/user-cabinet',
    icon: PersonOutline,
    labelKey: 'shared.nav.userCabinet',
    color: 'var(--neon-orange)',
  },
  records: {
    key: 'records',
    path: '/records',
    icon: TrophyOutline,
    labelKey: 'shared.nav.leaderboards',
    color: 'var(--neon-bordeaux)',
  },
}
