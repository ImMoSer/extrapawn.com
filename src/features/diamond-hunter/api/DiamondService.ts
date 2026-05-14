import { diamondRepository } from '@/shared/api/storage/repositories/DiamondRepository'

export async function checkDiamondLimit(hash: string): Promise<boolean> {
  const count = await diamondRepository.getDiamondCountForHashToday(hash)
  return count < 2
}

export async function getDiamondsCount(): Promise<number> {
  return await diamondRepository.getDiamondCount()
}

export async function getBrilliantsCount(): Promise<number> {
  return await diamondRepository.getBrilliantCount()
}

export async function recordDiamond(hash: string, fen: string, pgn: string): Promise<void> {
  await diamondRepository.addDiamond({
    hash,
    fen,
    pgn,
    collected_at: Date.now(),
  })
}

export async function recordBrilliant(hash: string, fen: string, pgn: string): Promise<void> {
  await diamondRepository.addBrilliant({
    hash,
    fen,
    pgn,
    collected_at: Date.now(),
  })
}

export async function removeLastBrilliant(): Promise<void> {
  await diamondRepository.removeLastBrilliant()
}
