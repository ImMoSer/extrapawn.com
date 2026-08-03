import type { EngineId } from '@/shared/types/api.types'

export const ENGINE_NAMES: Record<EngineId, string> = {
  'maia-1500': '1500',
  'maia-1700': '1700',
  'maia-1900': '1900',
  'maia-2200': '2200',
  'maia-2400': '2400',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'maia-1500',
  'maia-1700',
  'maia-1900',
  'maia-2200',
  'maia-2400',
]
