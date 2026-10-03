import type { EngineId } from '@/shared/types/api.types'

export const ENGINE_NAMES: Record<EngineId, string> = {
  botvinnik: 'Botvinnik',
  capablanca: 'Capablanca',
  alekhine: 'Alekhine',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'botvinnik',
  'capablanca',
  'alekhine',
]
