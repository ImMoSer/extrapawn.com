import { describe, expect, it } from 'vitest'
import { parseLichessChapterPgn } from '@/shared/lib/pgn/lichessPgnParser'
import {
  extractLatestStandaloneDrawShapes,
  normalizeDrawTokens,
  parseDrawTokensToShapes,
} from '../coachDrawShapes'
import {
  buildChapterSanPathIndex,
  extractMentionedPathsFromText,
  renderCoachMarkdown,
} from '../renderCoachMarkdown'

describe('renderCoachMarkdown & coachDrawShapes (AI Coach 3.0)', () => {
  it('renders headings, bold (including around backtick SAN!), lists, and strips XSS', () => {
    const md = [
      '### Основная идея',
      '',
      'Оба взятия играбельны, но **`5...dxe6` действительно точнее (+0.32 против +0.64)** после `5...fxe6`.',
      '- *безопасный угол* — `h8`',
      '- **матовый угол** — `a8`',
      '',
      '<img src=x onerror="alert(1)"><script>window.pwn=1</script>',
    ].join('\n')

    const html = renderCoachMarkdown(md)
    expect(html).toContain('<h4 class="coach-md-h">Основная идея</h4>')
    expect(html).toContain('<strong><code class="coach-md-code">5...dxe6</code> действительно точнее')
    expect(html).not.toContain('**')
    expect(html).toContain('<em>безопасный угол</em>')
    expect(html).toContain('<ul class="coach-md-ul">')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
  })

  it('attaches inline [draw: ...] arrows to green SAN chips and extracts standalone shapes', () => {
    const pgn = `[Event "Test"]
[FEN "3k4/8/8/8/8/8/3P4/3K4 w - - 0 1"]
[SetUp "1"]

1. Kc2 Kc7 2. Kd3 Kd7 *`
    const parsed = parseLichessChapterPgn(pgn)
    const index = buildChapterSanPathIndex(parsed.rootNode)

    const md =
      'Сначала **`1. Kc2`[draw: Gc2d3, Rc6, BAD99]** и после `Kc7` идём **2. Kd3**! [draw: Gd3e4, Ye5]'
    const html = renderCoachMarkdown(md, index)

    expect(html).toContain('class="coach-san-chip coach-san-chip--draw"')
    expect(html).toContain('data-draw="Gc2d3,Rc6"')
    expect(html).not.toContain('BAD99')
    expect(html).not.toContain('[draw:')
    expect(html).toContain('class="coach-draw-chip"')
    expect(html).toContain('data-draw="Gd3e4,Ye5"')

    const standalone = extractLatestStandaloneDrawShapes(md)
    expect(standalone).toEqual([
      { orig: 'd3', dest: 'e4', brush: 'green' },
      { orig: 'e5', brush: 'yellow' },
    ])

    // Strict move-number match: numbered `5. Kc2` MUST NOT jump to move `1. Kc2`!
    const htmlWrongNum = renderCoachMarkdown('На `5. Kc2` хода нет в этой главе.', index)
    expect(htmlWrongNum).not.toContain('data-pgn-path')

    // Reverse lookup of discussed moves
    const mentioned = extractMentionedPathsFromText(md, index)
    expect(mentioned.length).toBeGreaterThanOrEqual(3)
  })

  it('validates Lichess G/R/B/Y draw tokens and rejects zero-length or invalid squares', () => {
    expect(normalizeDrawTokens('gc4c7, Rd8d8, Zz9, Ye6, ye6, ba1h8')).toEqual([
      'Gc4c7',
      'Ye6',
      'Ba1h8',
    ])
    expect(parseDrawTokensToShapes('Gc4c7,Ye6')).toEqual([
      { orig: 'c4', dest: 'c7', brush: 'green' },
      { orig: 'e6', brush: 'yellow' },
    ])
  })
})
