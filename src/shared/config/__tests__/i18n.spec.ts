import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import de from '@/locales/de.json'
import en from '@/locales/en.json'
import ru from '@/locales/ru.json'
import {
  PRACTICAL_AND_FINISHHIM_DOMAINS,
  PRACTICAL_DOMAIN_CLASSES,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  TACTICS_COGNITIVE_PROFILES,
  TACTICS_CONCEPT_MOTIFS,
  TACTICS_GEOMETRY_MOTIFS,
  TACTICS_GOALS,
  TACTICS_LENGTHS,
  TACTICS_MOTIF_GROUPS,
  TACTICS_OPERATOR_MOTIFS,
  TACTICS_PHASES,
  TACTICS_TRIGGER_MOTIFS,
  THEORETICAL_DOMAIN_CLASSES,
  THEORETICAL_DOMAINS,
  TRAINING_DIFFICULTIES,
  TRAINING_DISCIPLINES,
  type CourseStatus,
  type WoodpeckerAction,
} from '@/entities/training'

type NestedRecord = { [key: string]: string | string[] | NestedRecord }

function flattenMessages(obj: NestedRecord, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      result[fullKey] = value.join('\n')
    } else if (value !== null && typeof value === 'object') {
      Object.assign(result, flattenMessages(value, fullKey))
    } else {
      result[fullKey] = String(value)
    }
  }
  return result
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules' || entry === 'dist') continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(fullPath))
    } else if (fullPath.endsWith('.vue') || fullPath.endsWith('.ts')) {
      results.push(fullPath)
    }
  }
  return results
}

describe('i18n locale dictionaries & codebase key integrity', () => {
  const flatEn = flattenMessages(en as unknown as NestedRecord)
  const flatRu = flattenMessages(ru as unknown as NestedRecord)
  const flatDe = flattenMessages(de as unknown as NestedRecord)

  const enKeys = Object.keys(flatEn).sort()
  const ruKeys = Object.keys(flatRu).sort()
  const deKeys = Object.keys(flatDe).sort()

  it('maintains 100% key parity across en, ru, and de locales with non-empty values', () => {
    const missingInRu = enKeys.filter((k) => !(k in flatRu))
    const extraInRu = ruKeys.filter((k) => !(k in flatEn))
    const missingInDe = enKeys.filter((k) => !(k in flatDe))
    const extraInDe = deKeys.filter((k) => !(k in flatEn))

    expect(missingInRu, `Missing keys in ru.json: ${missingInRu.join(', ')}`).toEqual([])
    expect(extraInRu, `Extra keys in ru.json: ${extraInRu.join(', ')}`).toEqual([])
    expect(missingInDe, `Missing keys in de.json: ${missingInDe.join(', ')}`).toEqual([])
    expect(extraInDe, `Extra keys in de.json: ${extraInDe.join(', ')}`).toEqual([])

    for (const [lang, dict] of [
      ['en', flatEn],
      ['ru', flatRu],
      ['de', flatDe],
    ] as const) {
      const emptyKeys = Object.entries(dict)
        .filter(([, val]) => val.trim().length === 0)
        .map(([k]) => k)
      expect(emptyKeys, `Empty translations in ${lang}.json`).toEqual([])
    }
  })

  it('resolves all static t() calls and namespaced i18n keys in .vue and .ts files', () => {
    const srcDir = resolve(__dirname, '../../..')
    const files = collectSourceFiles(srcDir)
    const topNamespaces = Object.keys(en).map((ns) => `${ns}.`)

    const staticCallRegex = /(?<![a-zA-Z0-9_])\$?t\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*(?:,|\))/g
    const namespacedLiteralRegex = /['"]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)['"]/g

    const missingUsages: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const relPath = file.replace(srcDir, '')

      for (const match of content.matchAll(staticCallRegex)) {
        const key = match[1]
        if (key && !(key in flatEn)) {
          missingUsages.push(`${relPath} -> t('${key}')`)
        }
      }

      for (const match of content.matchAll(namespacedLiteralRegex)) {
        const key = match[1]
        if (
          key &&
          topNamespaces.some((ns) => key.startsWith(ns)) &&
          !key.endsWith('.') &&
          !(key in flatEn)
        ) {
          missingUsages.push(`${relPath} -> '${key}'`)
        }
      }
    }

    expect(missingUsages, `Unresolved i18n keys found in source code`).toEqual([])
  })

  it('resolves all dynamic i18n key families (Woodpecker, CourseStatus, Taxonomy, WarmUp)', () => {
    const woodpeckerActions: Exclude<WoodpeckerAction, 'none'>[] = [
      'queued',
      'progressed',
      'reset',
      'graduated',
    ]
    for (const action of woodpeckerActions) {
      const key = `features.trainingCenter.woodpecker.actions.${action}`
      expect(flatEn[key], `Missing ${key}`).toBeDefined()
    }

    const courseStatuses: CourseStatus[] = ['active', 'completed', 'expired', 'aborted']
    for (const status of courseStatuses) {
      const key = `features.trainingCenter.course.status.${status}`
      expect(flatEn[key], `Missing ${key}`).toBeDefined()
    }

    for (const group of TACTICS_MOTIF_GROUPS) {
      const key = `features.trainingCenter.warmup.motifGroups.${group}`
      expect(flatEn[key], `Missing ${key}`).toBeDefined()
    }

    const tFn = (k: string): string => flatEn[k] ?? k
    const teFn = (k: string): boolean => k in flatEn

    for (const disc of TRAINING_DISCIPLINES) {
      const label = resolveDisciplineLabel(disc, tFn)
      expect(label).not.toBe(`features.trainingCenter.disciplines.${disc}`)
    }

    for (const diff of TRAINING_DIFFICULTIES) {
      const label = resolveDifficultyLabel(diff, tFn)
      expect(label).not.toContain('puzzleCategories.')
    }

    const taxonomyScopes: Array<[string, readonly string[]]> = [
      ['phase', TACTICS_PHASES],
      ['length', TACTICS_LENGTHS],
      ['goal', TACTICS_GOALS],
      ['cognitive', TACTICS_COGNITIVE_PROFILES],
      ['master_game', ['true', 'false']],
      ['motif', TACTICS_GEOMETRY_MOTIFS],
      ['motif', TACTICS_OPERATOR_MOTIFS],
      ['motif', TACTICS_CONCEPT_MOTIFS],
      ['motif', TACTICS_TRIGGER_MOTIFS],
      ['domain', THEORETICAL_DOMAINS],
      ['domain', PRACTICAL_AND_FINISHHIM_DOMAINS],
      ['class', Object.values(THEORETICAL_DOMAIN_CLASSES).flat()],
      ['class', Object.values(PRACTICAL_DOMAIN_CLASSES).flat()],
    ]

    for (const [group, keys] of taxonomyScopes) {
      for (const scopeKey of keys) {
        const resolved = resolveScopeLabel(group, scopeKey, tFn, teFn)
        expect(resolved, `Unresolved taxonomy scope (${group}, ${scopeKey})`).not.toBe(scopeKey)
      }
    }
  })
})

