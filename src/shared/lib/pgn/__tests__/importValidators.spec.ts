import { describe, expect, it } from 'vitest'
import {
  validateFenInput,
  validateLichessUrlInput,
  validatePgnInput,
} from '../importValidators'

describe('importValidators', () => {
  describe('validateLichessUrlInput', () => {
    it('accepts all valid Lichess game URL formats and strips 4-char secret suffix', () => {
      expect(validateLichessUrlInput('https://lichess.org/game/igSkLPQB')).toEqual({
        valid: true,
        gameId: 'igSkLPQB',
        urlColor: undefined,
      })
      expect(validateLichessUrlInput('https://lichess.org/game/igSkLPQB/white')).toEqual({
        valid: true,
        gameId: 'igSkLPQB',
        urlColor: 'white',
      })
      expect(validateLichessUrlInput('https://lichess.org/game/igSkLPQB/black')).toEqual({
        valid: true,
        gameId: 'igSkLPQB',
        urlColor: 'black',
      })
      expect(validateLichessUrlInput('https://lichess.org/game/igSkLPQBUdgO')).toEqual({
        valid: true,
        gameId: 'igSkLPQB',
        urlColor: undefined,
      })
      expect(validateLichessUrlInput('https://lichess.org/zuBVAksu1gga?ref=1#14')).toEqual({
        valid: true,
        gameId: 'zuBVAksu',
        urlColor: undefined,
      })
      expect(validateLichessUrlInput('igSkLPQBUdgO')).toEqual({
        valid: true,
        gameId: 'igSkLPQB',
      })
    })

    it('rejects SSRF, studies, and malformed URLs', () => {
      expect(validateLichessUrlInput('')).toMatchObject({ valid: false })
      expect(validateLichessUrlInput('http://127.0.0.1/game/igSkLPQB')).toMatchObject({
        valid: false,
      })
      expect(validateLichessUrlInput('https://lichess.org/study/abcdefgh')).toMatchObject({
        valid: false,
      })
      expect(validateLichessUrlInput('https://evil.org/igSkLPQB')).toMatchObject({ valid: false })
    })
  })

  describe('validatePgnInput', () => {
    it('accepts valid single-game PGN with headers, comments, and variations', () => {
      const pgn = `[White "MO3EP"]
[Black "Rival"]
[Result "1-0"]

1. e4 { center } e5 (1... c5 2. Nf3) 2. Nf3 Nc6 3. Bb5 1-0`
      const res = validatePgnInput(pgn)
      expect(res).toEqual({
        valid: true,
        plies: 5,
        white: 'MO3EP',
        black: 'Rival',
        result: '1-0',
      })
    })

    it('rejects illegal moves, multi-game PGNs, empty PGNs, and invalid FEN headers', () => {
      expect(validatePgnInput('')).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errEmptyPgn',
      })
      expect(validatePgnInput('1. e4 e5 2. Kxe5')).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errIllegalMove',
        errorParams: { move: 'Kxe5', ply: 3 },
      })
      expect(validatePgnInput('1. e4 e5 2. Qh9#')).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errIllegalMove',
      })
      expect(
        validatePgnInput('[White "A"]\n1. e4 e5 *\n\n[White "B"]\n1. d4 d5 *'),
      ).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errMultiGamePgn',
      })
      expect(
        validatePgnInput('[SetUp "1"]\n[FEN "8/8/8/8/8/8/8/8 w - - 0 1"]\n\n1. e4 *'),
      ).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errInvalidFen',
      })
    })
  })

  describe('validateFenInput', () => {
    it('accepts valid FEN and reports side to move', () => {
      expect(
        validateFenInput('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'),
      ).toEqual({
        valid: true,
        turn: 'black',
      })
    })

    it('rejects illegal FEN without throwing', () => {
      expect(validateFenInput('not a fen')).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errInvalidFen',
      })
      expect(validateFenInput('8/8/8/8/8/8/8/8 w - - 0 1')).toMatchObject({
        valid: false,
        errorKey: 'pages.study.errInvalidFen',
      })
    })
  })
})
