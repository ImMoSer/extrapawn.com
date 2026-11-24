import { describe, expect, it } from 'vitest'
import {
  estimateTurnCostUsd,
  formatDisplayChapterTitle,
  mapPlayerTablebaseToSignal,
} from '../model/coachStudy.types'

describe('coachStudy v2 helpers', () => {
  it('strips redundant leading chapter numbers across RU/EN/DE titles', () => {
    expect(formatDisplayChapterTitle('Глава 1: Оппозиция и ключевые поля')).toBe(
      'Оппозиция и ключевые поля',
    )
    expect(formatDisplayChapterTitle('1. Глава 2 — Ладейный эндшпиль')).toBe('Ладейный эндшпиль')
    expect(formatDisplayChapterTitle('Chapter 3: Lucena Bridge')).toBe('Lucena Bridge')
    expect(formatDisplayChapterTitle('Kapitel 4: Philidor')).toBe('Philidor')
    expect(formatDisplayChapterTitle('W-манёвр коня')).toBe('W-манёвр коня')
  })

  it('estimates per-turn USD cost accurately for Hydrogen and Flash-Lite with cache discount', () => {
    const lite = estimateTurnCostUsd('gemini-3.5-flash-lite', 1000, 0, 100)
    expect(lite).toBeCloseTo(0.00055, 6)

    const cachedHydrogen = estimateTurnCostUsd('gemini-4-hydrogen', 5000, 4000, 200)
    // uncached 1000 * 1.5 + cached 4000 * 0.075 + out 200 * 7.5 = 1500 + 300 + 1500 = 3300 / 1e6
    expect(cachedHydrogen).toBeCloseTo(0.0033, 6)
  })

  it('maps PlayerTablebaseDTO preserving camelCase fideLost for coach_ai backend', () => {
    const sig = mapPlayerTablebaseToSignal({
      wdl: -1,
      dtm: -14,
      fideLost: true,
      source: 'gaviota',
    })
    expect(sig).toEqual({
      wdl: -1,
      dtm: -14,
      fideLost: true,
      source: 'gaviota',
    })
    expect(mapPlayerTablebaseToSignal(null)).toBeUndefined()
  })
})
