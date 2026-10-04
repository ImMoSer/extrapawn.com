import type { EngineId } from '@/shared/types/api.types'

export const ENGINE_NAMES: Record<EngineId, string> = {
  'maia-1500': 'Maia 1500',
  'maia-1700': 'Maia 1700',
  'maia-1900': 'Maia 1900',
  'maia-2200': 'Maia 2200',
  badgyal: 'Bad Gyal',
  t1000: 'T1000',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'maia-1500',
  'maia-1700',
  'maia-1900',
  'maia-2200',
  'badgyal',
  't1000',
]
