import { describe, it, expect, beforeEach } from 'vitest'
import { soundService, registerVolumeProvider } from '../sound.service'

describe('soundService', () => {
  beforeEach(() => {
    soundService.stopAll()
  })

  it('handles volume provider registration and volume limits', () => {
    let vol = 0.8
    registerVolumeProvider({
      getVolume: () => vol,
      setVolume: (v) => { vol = v },
    })

    expect(soundService.volume).toBe(0.8)
    soundService.setVolume(0.5)
    expect(soundService.volume).toBe(0.5)
  })

  it('safely handles play calls in headless environment without crashing', async () => {
    await expect(soundService.play('move')).resolves.toBeUndefined()
    await expect(soundService.play('capture')).resolves.toBeUndefined()
    await expect(soundService.play('applause')).resolves.toBeUndefined()
    await expect(soundService.play('checkmate')).resolves.toBeUndefined()
    await expect(soundService.play('stalemate')).resolves.toBeUndefined()
  })

  it('safely handles legacy playSound events', async () => {
    await expect(soundService.playSound('board_move')).resolves.toBeUndefined()
    await expect(soundService.playSound('board_load_position')).resolves.toBeUndefined()
    await expect(soundService.playSound('unknown_event')).resolves.toBeUndefined()
  })
})
