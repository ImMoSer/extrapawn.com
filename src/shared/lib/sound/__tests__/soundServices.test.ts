import { describe, it, expect, beforeEach } from 'vitest'
import { boardSoundService, registerBoardVolumeProvider } from '../boardSound.service'
import { coachSpeakService, registerCoachVolumeProvider } from '../coachSpeak.service'

describe('boardSoundService', () => {
  beforeEach(() => {
    boardSoundService.stopAll()
  })

  it('handles volume provider registration and volume limits', () => {
    let vol = 0.8
    registerBoardVolumeProvider({
      getBoardVolume: () => vol,
      setBoardVolume: (v) => { vol = v },
    })

    expect(boardSoundService.volume).toBe(0.8)
    boardSoundService.setVolume(0.5)
    expect(boardSoundService.volume).toBe(0.5)
  })

  it('safely handles play calls in headless environment without crashing', async () => {
    await expect(boardSoundService.play('move')).resolves.toBeUndefined()
    await expect(boardSoundService.play('capture')).resolves.toBeUndefined()
    await expect(boardSoundService.play('applause')).resolves.toBeUndefined()
  })
})

describe('coachSpeakService', () => {
  beforeEach(() => {
    coachSpeakService.stop()
  })

  it('handles voice volume provider registration', () => {
    let voiceVol = 0.9
    registerCoachVolumeProvider({
      getVoiceVolume: () => voiceVol,
      setVoiceVolume: (v) => { voiceVol = v },
    })

    expect(coachSpeakService.volume).toBe(0.9)
    coachSpeakService.setVolume(0.7)
    expect(coachSpeakService.volume).toBe(0.7)
  })

  it('handles contextual speech queue and stop() cleanly', async () => {
    expect(coachSpeakService.isSpeaking.value).toBe(false)
    
    await coachSpeakService.speak({
      category: 'entry',
    })

    await coachSpeakService.speak({
      category: 'blunder',
      severity: 'critical',
    })

    coachSpeakService.stop()
    expect(coachSpeakService.isSpeaking.value).toBe(false)
    expect(coachSpeakService.currentSpeechPath.value).toBeNull()
  })
})
