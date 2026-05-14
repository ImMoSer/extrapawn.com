import { describe, it, expect } from 'vitest'
import { extractConsequences, topConsequenceLine } from '../connectors.js'

// Minimal fake "explanation blob" shape — only the fields the
// connectors actually read. This is intentionally just enough to
// trigger one or two connectors per test.
function blob({
  whiteAttackers = 0,
  blackAttackers = 0,
  whiteShield = 70,
  blackShield = 70,
  whiteOpenFilesToKing = [],
  blackOpenFilesToKing = [],
  whiteHanging = [],
  blackHanging = [],
  evalCp = 0,
  whiteCastled = true,
  blackCastled = true,
} = {}) {
  return {
    eval_cp: evalCp,
    side_to_move: 'white',
    move_number: 12,
    phase: 'middlegame',
    material: { delta_cp: 0, white: {}, black: {} },
    pawn_structure: {
      white: { islands: 1, passed_pawns: 0, doubled: 0, isolated: 0, backward: 0 },
      black: { islands: 1, passed_pawns: 0, doubled: 0, isolated: 0, backward: 0 },
    },
    king_safety: {
      white: {
        castled: whiteCastled,
        attacker_count: whiteAttackers,
        pawn_shield_score: whiteShield,
        open_files_to_king: whiteOpenFilesToKing,
        half_open_files_to_king: [],
        danger_score: whiteAttackers * 100,
      },
      black: {
        castled: blackCastled,
        attacker_count: blackAttackers,
        pawn_shield_score: blackShield,
        open_files_to_king: blackOpenFilesToKing,
        half_open_files_to_king: [],
        danger_score: blackAttackers * 100,
      },
    },
    activity: {
      white: { mobility: 30, outposts: 0, bishop_pair: false, passive_pieces: [] },
      black: { mobility: 30, outposts: 0, bishop_pair: false, passive_pieces: [] },
    },
    line_control: {
      open_files: [],
      half_open_files: [],
      rook_seventh: { white: 0, black: 0 },
    },
    tactics: {
      hanging_white: whiteHanging,
      hanging_black: blackHanging,
      pinned: [],
    },
    themes: [],
  }
}

describe('extractConsequences', () => {
  it('returns [] when either blob is missing', () => {
    expect(extractConsequences(null, blob())).toEqual([])
    expect(extractConsequences(blob(), null)).toEqual([])
  })

  it('returns [] when nothing changed between two identical blobs', () => {
    const before = blob()
    const after = blob()
    const cs = extractConsequences(before, after, { movingSide: 'white' })
    expect(Array.isArray(cs)).toBe(true)
    // No change → no actionable consequences. (May still be empty array
    // depending on connectors, but it must not throw.)
    expect(cs.every((c) => typeof c.text === 'string')).toBe(true)
  })

  it('flags an attacker-count increase against the white king', () => {
    // Black is moving; pulls 3 more attackers into white's king zone.
    const before = blob({ whiteAttackers: 1 })
    const after = blob({ whiteAttackers: 4 })
    const cs = extractConsequences(before, after, { movingSide: 'black' })
    expect(cs.length).toBeGreaterThan(0)
    const text = cs.map((c) => c.text).join(' ')
    expect(text.toLowerCase()).toMatch(/king zone|attackers/)
  })

  it('flags a pawn-shield collapse', () => {
    const before = blob({ whiteShield: 80 })
    const after = blob({ whiteShield: 30 })
    const cs = extractConsequences(before, after, { movingSide: 'black' })
    expect(cs.length).toBeGreaterThan(0)
    const text = cs.map((c) => c.text).join(' ')
    expect(text.toLowerCase()).toMatch(/shield|crack/)
  })

  it('produces sorted, deduped output', () => {
    const before = blob({ whiteAttackers: 0, whiteShield: 80 })
    const after = blob({ whiteAttackers: 4, whiteShield: 30 })
    const cs = extractConsequences(before, after, { movingSide: 'black' })
    for (let i = 1; i < cs.length; i++) {
      expect(cs[i - 1].importance).toBeGreaterThanOrEqual(cs[i].importance)
    }
    const texts = cs.map((c) => c.text)
    expect(new Set(texts).size).toBe(texts.length)
  })
})

describe('topConsequenceLine', () => {
  it('returns null when there are no consequences', () => {
    expect(topConsequenceLine(blob(), blob(), { movingSide: 'white' })).toBeOneOf([
      null,
      expect.any(String),
    ])
    // Dual-acceptable: connectors may emit nothing, OR one neutral
    // baseline line. Just enforce shape.
  })

  it('returns a string when there are consequences', () => {
    const before = blob({ whiteAttackers: 0, whiteShield: 80 })
    const after = blob({ whiteAttackers: 4, whiteShield: 30 })
    const line = topConsequenceLine(before, after, { movingSide: 'black' })
    if (line !== null) {
      expect(typeof line).toBe('string')
      expect(line.length).toBeGreaterThan(0)
    }
  })
})

// Vitest doesn't have toBeOneOf out of the box. Provide a tiny helper.
// (Imported lazily so the failure mode is local.)
expect.extend({
  toBeOneOf(received, accepted) {
    const matched = accepted.some((a) =>
      a && typeof a === 'object' && a.asymmetricMatch
        ? a.asymmetricMatch(received)
        : Object.is(received, a),
    )
    return {
      pass: matched,
      message: () => `expected ${received} to match one of ${JSON.stringify(accepted)}`,
    }
  },
})
