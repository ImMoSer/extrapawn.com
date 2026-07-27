import type { EngineId } from '@/shared/types/api.types'

export const ENGINE_NAMES: Record<EngineId, string> = {
  'bad-gyal-8': 'BadGyal-8',
  'ender-112x9-se': 'Ender-V2',
  'mean-girl-8': 'MeanGirl-8',
  'evilgyal-6': 'EvilGyal-6',
  'maia-2200': 'Maia-2200',
  'maia-1900': 'Maia-1900',
  'maia-1800': 'Maia-1800',
  'maia-1700': 'Maia-1700',
  'maia-1600': 'Maia-1600',
  'maia-1500': 'Maia-1500',
  'maia-1400': 'Maia-1400',
  'maia-1300': 'Maia-1300',
  'maia-1200': 'Maia-1200',
  'maia-1100': 'Maia-1100',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'maia-1100',
  'maia-1300',
  'maia-1500',
  'maia-1700',
  'maia-1900',
  'maia-2200',
  'mean-girl-8',
  'bad-gyal-8',
  'ender-112x9-se',
]
