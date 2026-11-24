import { describe, expect, it } from 'vitest'
import { parseLichessChapterPgn } from '@/shared/lib/pgn/lichessPgnParser'
import { buildChapterSanPathIndex, renderCoachMarkdown } from '../renderCoachMarkdown'

describe('renderCoachMarkdown', () => {
  it('renders headings, bold, italic, lists, and inline code safely while stripping XSS', () => {
    const md = [
      '### Основная идея',
      '',
      'В мате конём и слоном есть **два типа углов**:',
      '- *безопасный угол* — `h8`',
      '- **матовый угол** — `a8`',
      '',
      '<img src=x onerror="alert(1)"><script>window.pwn=1</script>',
    ].join('\n')

    const html = renderCoachMarkdown(md)
    expect(html).toContain('<h4 class="coach-md-h">Основная идея</h4>')
    expect(html).toContain('<strong>два типа углов</strong>')
    expect(html).toContain('<em>безопасный угол</em>')
    expect(html).toContain('<code class="coach-md-code">h8</code>')
    expect(html).toContain('<ul class="coach-md-ul">')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')

    const container = document.createElement('div')
    container.innerHTML = html
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('converts SAN moves matching the active chapter tree into clickable data-pgn-path chips', () => {
    const pgn = `[Event "Test"]
[FEN "3k4/8/8/8/8/8/3P4/3K4 w - - 0 1"]
[SetUp "1"]

1. Kc2 Kc7 2. Kd3 Kd7 *`
    const parsed = parseLichessChapterPgn(pgn)
    const index = buildChapterSanPathIndex(parsed.rootNode)

    const html = renderCoachMarkdown('Сначала играем **1. Kc2** и после `Kc7` идём **2. Kd3**!', index)
    expect(html).toContain('class="coach-san-chip"')
    expect(html).toContain('data-pgn-path="')
    expect(html).toContain('>1. Kc2</button>')
    expect(html).toContain('>Kc7</button>')
    expect(html).toContain('>2. Kd3</button>')
  })
})
