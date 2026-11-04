# DESIGN.md — ExtraPawn Studio (Supabase × Lichess Hybrid)

## Overview

**ExtraPawn Studio** pairs developer-grade analytical interfaces (inspired by **Supabase Studio** and **Linear**) with the ergonomic board-first clarity of **Lichess**. Built for deep calculation, 30-day training courses, and multi-dimensional Glicko-2 diagnostics, the design system eliminates decorative neon noise, glass blurs, and glowing shadows in favor of **quiet technical precision**: matte neutral surfaces, `1px solid` structural hairlines, monochrome navigation chrome, a single signature **Supabase Emerald** primary CTA accent, and a calibrated chess semantic palette across both **Dark Mode** and **Light Mode**.

**Stack context:** Vue 3 + Vite + Tailwind CSS v4 (`@theme` mapped to polarized CSS variables for zero-duplication Dark/Light switching), Naive UI for complex components, Chessground for the chessboard, and ECharts for diagnostic visualizations.

---

## 1. Dual-Theme Color System (Dark & Light)

All tokens are semantic and automatically flip polarity via `html[data-theme="dark"]` (default) and `html[data-theme="light"]`. Never hardcode hex values in `.vue` or `.ts` files outside `src/assets/main.css` and `src/shared/theme/tokens.ts`.

### 1.1. Neutral Surfaces & Typography Ladder

Neutral carbon greys in Dark Mode and soft stone/paper neutrals in Light Mode ensure zero chromatic clash with wooden, green, or stone chessboards.

| Token | Tailwind Utility | Dark Mode (Carbon) | Light Mode (Daylight) | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--color-canvas` | `bg-canvas` | `#121212` | `#F4F4F5` | Outer app background (matte, non-blinding in daylight) |
| `--color-surface` | `bg-surface` | `#1C1C1C` | `#FFFFFF` | Cards, panels, sidebar, data tables |
| `--color-elevated` | `bg-elevated` | `#242424` | `#ECECEE` | Nested containers, active tabs, row hover, inputs |
| `--color-overlay` | `bg-overlay` | `#2E2E2E` | `#FFFFFF` | Modals, dropdown menus, popovers, tooltips |
| `--color-border` | `border-border` | `#2E2E2E` | `#E4E4E7` | `1px solid` structural hairlines and dividers |
| `--color-border-hover` | `border-border-hover` | `#3E3E3E` | `#D4D4D8` | Hover, focus, or selected structural border |
| `--color-text-primary` | `text-text-primary` | `#EDEDED` | `#171717` | Primary text, headings, ratings, key metrics |
| `--color-text-secondary` | `text-text-secondary` | `#9A9A9A` | `#64646B` | Secondary copy, labels, captions, inactive tabs |
| `--color-text-disabled` | `text-text-disabled` | `#525252` | `#A1A1AA` | Disabled controls, subtle separators, placeholders |

### 1.2. Brand & Interactive Accent Tokens

To prevent visual confusion between UI chrome and chess evaluation signals:
- **Navigation, tabs, and discipline selectors stay monochrome** (`bg-elevated`, `text-text-primary`, `border-border-hover`).
- **Brand Emerald (`--color-brand`)** is reserved for primary CTA buttons, active course progress bars, and small status dots.

| Token | Tailwind Utility | Dark Mode | Light Mode | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--color-brand` | `bg-brand`, `text-brand`, `border-brand` | `#3ECF8E` | `#10B981` | Primary CTA fill, active course indicator |
| `--color-brand-deep` | `bg-brand-deep` | `#24B47E` | `#059669` | Primary CTA hover/pressed state |
| `--color-on-brand` | `text-on-brand` | `#171717` | `#FFFFFF` | Text on filled `--color-brand` buttons (near-black on bright emerald in Dark Mode) |
| `--color-accent` | `bg-accent`, `text-accent`, `border-accent` | `#A78BFA` | `#7C3AED` | Secondary accent (WarmUp mode, piece maneuver routes) |
| `--color-accent-deep` | `bg-accent-deep` | `#8B5CF6` | `#6D28D9` | Secondary accent hover/pressed state |

### 1.3. Chess Semantics & Data-Viz Palette (NAGs, Board Shapes, ECharts)

Calibrated for prolonged reading without eye strain in both Dark and Light themes:

| Token | Tailwind Utility | Dark Mode | Light Mode | Chess & UI Semantics |
| :--- | :--- | :--- | :--- | :--- |
| `--color-mint` | `text-mint`, `bg-mint` | `#2DD4BF` | `#0D9488` | Brilliant move (`!!`), novelty, ECharts series |
| `--color-success` | `text-success`, `bg-success` | `#3ECF8E` | `#16A34A` | Best move (`!`), solved puzzle, win, `EMA >= 85%` |
| `--color-success-deep` | `text-success-deep` | `#24B47E` | `#15803D` | Success hover/border emphasis |
| `--color-info` | `text-info`, `bg-info` | `#38BDF8` | `#0284C7` | Interesting move (`!?`), suggested plan `[arrow:]`, info banner |
| `--color-info-deep` | `text-info-deep` | `#0284C7` | `#0369A1` | Info hover/border emphasis |
| `--color-warning` | `text-warning`, `bg-warning` | `#F4BD50` | `#D97706` | Inaccuracy (`?!`), key square `[mark:]`, Woodpecker due |
| `--color-warning-deep` | `text-warning-deep` | `#D99B26` | `#B45309` | Warning hover/border emphasis |
| `--color-orange` | `text-orange`, `bg-orange` | `#FB923C` | `#EA580C` | Mistake (`?`), ECharts categorical series |
| `--color-orange-warm` | `text-orange-warm` | `#F97316` | `#C2410C` | Secondary orange ECharts pair |
| `--color-danger` | `text-danger`, `bg-danger` | `#F66061` | `#DC2626` | Blunder (`??`), threat/check, failed attempt, destructive action |
| `--color-danger-deep` | `text-danger-deep` | `#E11D48` | `#B91C1C` | Danger hover/border emphasis |
| `--color-highlight` | `text-highlight`, `bg-highlight` | `#F472B6` | `#DB2777` | Special badge / highlight marker |
| `--color-amber` | `text-amber`, `bg-amber` | `#FBBF24` | `#D97706` | Trophy / record highlight, ECharts series |

---

## 2. Typography

Self-hosted **Ubuntu** (`--font-display`) and **Ubuntu Condensed** (`--font-condensed`) in compressed `.woff2` format.

- **`font-display` (`Ubuntu`, weights 400, 500, 700):** Used for headings, navigation, buttons, and prose. Headings use medium/bold weight (`500`–`700`) with tight tracking (`-0.02em`), never decorative neon drop-shadows.
- **`font-condensed` (`Ubuntu Condensed`, weight 400, with `font-variant-numeric: tabular-nums`):** Mandatory for PGN move trees, SAN/FEN strings, engine PV lines, Glicko-2 ratings (`1540 ±42`), timers (`02:14`), percentages, and dense diagnostic matrices.

| Role | Utility Class | Family | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Display | `font-display text-2xl font-semibold tracking-tight` | Ubuntu | 24–28px | 600–700 | 1.2 | Page headers, dashboard titles |
| Heading | `font-display text-base font-medium` | Ubuntu | 16–18px | 500–600 | 1.3 | Card titles, section headers |
| Body | `font-display text-sm font-normal` | Ubuntu | 14–15px | 400 | 1.55 | Coaching prose, descriptions, settings |
| Button | `font-display text-sm font-medium` | Ubuntu | 14px | 500 | 1.0 | Action buttons (no wide uppercase letter-spacing) |
| Notation / Data | `font-condensed text-sm` | Ubuntu Condensed | 13–14px | 400 | 1.4 | Move lists, PV lines, ratings, timers, table cells |
| Micro / Badge | `font-condensed text-xs uppercase tracking-wider` | Ubuntu Condensed | 11–12px | 400–700 | 1.3 | Status pills, tier badges, table column headers |

---

## 3. Spacing, Radius & Elevation

### 3.1. Border Radius Scale
Technical, crisp radii inspired by Supabase Studio (never bubbly or pill-shaped for buttons):

| Token | Value | Usage |
| :--- | :--- | :--- |
| `--radius-sm` (`rounded-sm`) | `4px` | Status badges, rating chips, inline tags |
| `--radius-md` (`rounded-md`) | `6px` | Buttons, inputs, selects, inner sub-panels |
| `--radius-lg` (`rounded-lg`) | `8px` | Standard dashboard cards, discipline tiles, modals |
| `--radius-xl` (`rounded-xl`) | `12px` | Major section containers, Diploma frame |

*(Note: Chessground board always retains `border-radius: 0`.)*

### 3.2. Elevation & Borders
Depth is communicated primarily through **surface luminance steps** (`canvas` → `surface` → `elevated`) and **`1px solid var(--color-border)`** hairlines, supplemented by subtle shadows:

- **Cards at rest:** `1px solid var(--color-border)`, flat or subtle `shadow-sm` (`0 1px 2px rgba(0, 0, 0, 0.08)` in Light, `0 1px 3px rgba(0, 0, 0, 0.3)` in Dark).
- **Dropdowns & Popovers:** `1px solid var(--color-border-hover)`, `shadow-md` (`0 4px 16px rgba(0, 0, 0, 0.12)` in Light, `0 4px 16px rgba(0, 0, 0, 0.45)` in Dark).
- **Modals:** `1px solid var(--color-border)`, `shadow-lg` (`0 12px 32px rgba(0, 0, 0, 0.18)` in Light, `0 12px 32px rgba(0, 0, 0, 0.6)` in Dark).
- **Zero Glow Policy:** Never use colored neon `box-shadow` glows or `backdrop-filter: blur()`.

---

## 4. Do's and Don'ts

### Do
- Use semantic classes (`bg-canvas`, `bg-surface`, `bg-elevated`, `border-border`, `text-text-primary`, `text-text-secondary`, `bg-brand`, `text-on-brand`) so components automatically support both Dark and Light themes.
- Keep navigation tabs and selection cards monochrome (`bg-elevated` + `border-border-hover` + `text-text-primary`), using at most a subtle `2px` indicator bar or dot in `bg-brand`.
- Use `font-condensed` for all ratings, timers, move lists, and numeric tables.
- Read theme tokens reactively via `useThemeTokens()` when configuring ECharts or Naive UI overrides.

### Don't
- Never hardcode hex colors (`#1c1c1c`, `#ffffff`, `#3ecf8e`) or `rgba(...)` in Vue templates or TypeScript files.
- Never use `!important` to fight specificity in global CSS.
- Never use `backdrop-filter: blur(...)`, neon `drop-shadow`, or animated background canvases.
- Never use white text on the `#3ECF8E` emerald primary button in Dark Mode — always use `text-on-brand` (`#171717`).
