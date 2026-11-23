import { describe, expect, it } from 'vitest'
import { parseLichessChapterPgn, serializeStudyChapterPgn } from '../lichessPgnParser'

const SAMPLE_LICHESS_OPPOSITION_PGN = `[Event "ExtraPawn AI Study"]
[Site "https://extrapawn.com"]
[Date "2026.11.23"]
[Result "*"]
[ChapterName "Оппозиция и ключевые поля"]
[FEN "3k4/8/8/8/8/8/3P4/3K4 w - - 0 1"]
[SetUp "1"]
[Orientation "white"]

{ Белые должны занять оппозицию. [%csl Rc6,Rd6,Re6][%cal Gd1c2,Gc2d3,Bd2d4] } 1. Kc2 $1 { Обходим пешку. } ( 1. d4 $4 { Ничья! [%csl Rd5] } 1... Kd7 ) 1... Kc7 2. Kd3 Kd7 3. Kd4 Kd6 { [%csl Rc5,Rd5,Re5][%cal Gd2d3] } 4. d3 *`

describe('lichessPgnParser', () => {
  it('parses Lichess Study PGN with root shapes, comments, NAGs, and nested variations', () => {
    const parsed = parseLichessChapterPgn(SAMPLE_LICHESS_OPPOSITION_PGN)

    expect(parsed.startFen).toBe('3k4/8/8/8/8/8/3P4/3K4 w - - 0 1')
    expect(parsed.orientation).toBe('white')
    expect(parsed.headers.ChapterName).toBe('Оппозиция и ключевые поля')

    expect(parsed.rootNode.comment).toBe('Белые должны занять оппозицию.')
    expect(parsed.rootNode.shapes).toHaveLength(6)
    expect(parsed.rootNode.shapes?.slice(0, 3)).toEqual([
      { orig: 'c6', brush: 'red' },
      { orig: 'd6', brush: 'red' },
      { orig: 'e6', brush: 'red' },
    ])
    expect(parsed.rootNode.shapes?.[3]).toEqual({
      orig: 'd1',
      dest: 'c2',
      brush: 'green',
    })

    // Mainline 1. Kc2 + Variation 1. d4
    expect(parsed.rootNode.children).toHaveLength(2)
    const kc2 = parsed.rootNode.children[0]
    const d4 = parsed.rootNode.children[1]
    expect(kc2?.san).toBe('Kc2')
    expect(kc2?.nag).toBe(1)
    expect(kc2?.comment).toBe('Обходим пешку.')

    expect(d4?.san).toBe('d4')
    expect(d4?.nag).toBe(4)
    expect(d4?.comment).toBe('Ничья!')
    expect(d4?.shapes).toEqual([{ orig: 'd5', brush: 'red' }])
    expect(d4?.children[0]?.san).toBe('Kd7')

    // Walk to 3... Kd6 and verify per-move shapes
    const kd6 = kc2?.children[0]?.children[0]?.children[0]?.children[0]?.children[0]
    expect(kd6?.san).toBe('Kd6')
    expect(kd6?.shapes).toHaveLength(4)
    expect(kd6?.shapes?.[3]).toEqual({ orig: 'd2', dest: 'd3', brush: 'green' })
  })

  it('roundtrips serialized study PGN preserving root & node [%csl]/[%cal] annotations', () => {
    const parsed = parseLichessChapterPgn(SAMPLE_LICHESS_OPPOSITION_PGN)
    const serialized = serializeStudyChapterPgn(parsed.headers, parsed.rootNode, parsed.result)

    expect(serialized).toContain('[%csl Rc6,Rd6,Re6]')
    expect(serialized).toContain('[%cal Gd1c2,Gc2d3,Bd2d4]')
    expect(serialized).toContain('(1. d4 $4')
    expect(serialized).toContain('[%cal Gd2d3][%csl Rc5,Rd5,Re5]')

    const reparsed = parseLichessChapterPgn(serialized)
    expect(reparsed.rootNode.shapes).toHaveLength(6)
    expect(reparsed.rootNode.children).toHaveLength(2)
    expect(reparsed.rootNode.children[0]?.san).toBe('Kc2')
  })
})
