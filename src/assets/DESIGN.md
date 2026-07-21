# DESIGN.md — Cyber Neon / Zen Dark

## Overview

This app lives in two modes at once: a **calm, near-black "Zen" canvas** for long analysis sessions (reading engine lines, reading coaching reports), and **neon accents** that carry meaning — status, semantics, chart series, board annotations. The dark surface is intentionally quiet so that when a neon color appears, it means something. Tailwind v4's CSS-first `@theme` config is the single source of truth for tokens; Naive UI and ECharts read the same hex values so the whole app — board, panels, charts, dialogs — speaks one color language.

**Stack context:** Vue 3 + Vite + Tailwind v4 for layout/utility styling, Naive UI for complex components (forms, modals, tables), Chessground for the board, ECharts for analysis/coaching visualizations. Tailwind owns layout and one-off styling; Naive UI and ECharts get their colors _from_ Tailwind's tokens rather than defining their own palette.

## Colors

### Neutral Palette (Zen Dark surface)

The source palette is neon-only (accents), so a calm neutral scale is proposed here to host it. Cool-tinted near-blacks, not pure gray, so the neons don't clash with a warm undertone.

| Token                  | Hex       | Usage                                                              |
| ---------------------- | --------- | ------------------------------------------------------------------ |
| `color-void`           | `#05060a` | App background, outer canvas                                       |
| `color-surface`        | `#0d0f16` | Cards, panels, sidebar                                             |
| `color-elevated`       | `#151822` | Modals, popovers, dropdowns                                        |
| `color-border`         | `#232838` | Dividers, card outlines                                            |
| `color-border-hover`   | `#333a4f` | Hover/focus border state                                           |
| `color-text-primary`   | `#e8ecf5` | Body text (not pure white — easier on the eyes over long sessions) |
| `color-text-secondary` | `#8b93a8` | Metadata, timestamps, captions                                     |
| `color-text-disabled`  | `#4a5169` | Disabled states                                                    |

### Primary Palette (from your neon set)

Two colors are promoted to **primary/brand** — everything else is reserved for semantics or charts, so the UI doesn't turn into rainbow soup.

| Token               | Hex       | Usage                                                                          |
| ------------------- | --------- | ------------------------------------------------------------------------------ |
| `color-neon-cyan`   | `#00e5ff` | Primary interactive color — links, primary buttons, active states, focus rings |
| `color-cyan-deep`   | `#00b8cc` | Primary hover/pressed state                                                    |
| `color-neon-purple` | `#b000ff` | Brand accent — headers, logo mark, selected/emphasis states                    |
| `color-purple-deep` | `#7a00cc` | Purple hover/pressed state                                                     |

### Semantic Colors

| Token                   | Hex                       | Usage                                      |
| ----------------------- | ------------------------- | ------------------------------------------ |
| `color-success`         | `#00ff55` (neon-lime)     | Success toasts, correct-move confirmation  |
| `color-success-deep`    | `#00cc44` (lime-deep)     | Success hover/pressed                      |
| `color-warning`         | `#ffe600` (neon-yellow)   | Warnings, inaccuracy flags                 |
| `color-warning-deep`    | `#ccb800` (yellow-deep)   | Warning hover/pressed                      |
| `color-danger`          | `#ff073a` (neon-red)      | Errors, blunder flags, destructive actions |
| `color-danger-deep`     | `#d9004c` (neon-bordeaux) | Danger hover/pressed                       |
| `color-info`            | `#0055ff` (neon-blue)     | Informational banners, tooltips            |
| `color-info-deep`       | `#3d8bff` (blue-light)    | Info hover/pressed                         |
| `color-highlight`       | `#ff007a` (neon-pink)     | @mentions, badges, unread indicators       |
| `color-highlight-light` | `#ff4da6` (pink-light)    | Highlight hover/muted variant              |

### Data-Viz Reserve (ECharts categorical set)

These stay **out of UI chrome** entirely and are reserved for chart series, so a chart's color always means "a different data series," never "the same color as a button elsewhere."

| Token                                | Hex                   | Pair      |
| ------------------------------------ | --------------------- | --------- |
| `color-orange` / `color-orange-warm` | `#ff5500` / `#ff8800` | twin pair |
| `color-mint`                         | `#00ffcc`             | single    |
| `color-magenta`                      | `#ff00c8`             | single    |
| `color-amber`                        | `#ff9900`             | single    |
| `color-acid-green`                   | `#39ff14`             | single    |

Reuse the existing twin-pair rose-chart palette as the canonical ECharts theme (`theme/echarts-theme.ts`) rather than redefining series colors per chart.

## Typography

Ubuntu, self-hosted, all weights registered as separate `@font-face` declarations (see Tailwind Setup below). Ubuntu Condensed is treated as its own family — used specifically for dense, numeric, tabular content, which is exactly the situation it exists for (engine lines, move lists, eval scores, coordinates, tablebase DTM values).

| Role            | Family           | Size | Weight              | Line Height | Usage                                               |
| --------------- | ---------------- | ---- | ------------------- | ----------- | --------------------------------------------------- |
| Display         | Ubuntu           | 32px | 700 (Bold)          | 1.2         | Page titles, report headlines                       |
| Heading         | Ubuntu           | 20px | 500 (Medium)        | 1.3         | Section headers, card titles                        |
| Body            | Ubuntu           | 15px | 400 (Regular)       | 1.55        | Coaching report prose, descriptions                 |
| Body Light      | Ubuntu           | 15px | 300 (Light)         | 1.55        | Secondary/de-emphasized paragraph text              |
| Data / Notation | Ubuntu Condensed | 14px | 400                 | 1.4         | Move lists, SAN/FEN strings, eval bars, coordinates |
| Caption         | Ubuntu           | 12px | 400                 | 1.4         | Timestamps, metadata, footnotes                     |
| Emphasis        | Ubuntu           | 15px | 700 (Bold) / Italic | 1.5         | Inline emphasis, key takeaways in reports           |

## Tailwind v4 Setup

Tailwind v4 config lives in CSS via `@theme`, no `tailwind.config.js` needed. Fonts and colors below go in your main stylesheet (e.g. `src/assets/main.css`):

```css
@import 'tailwindcss';

@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-Th.ttf') format('truetype');
  font-weight: 100;
  font-style: normal;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-L.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-LI.ttf') format('truetype');
  font-weight: 300;
  font-style: italic;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-R.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-RI.ttf') format('truetype');
  font-weight: 400;
  font-style: italic;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-M.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-MI.ttf') format('truetype');
  font-weight: 500;
  font-style: italic;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-B.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-BI.ttf') format('truetype');
  font-weight: 700;
  font-style: italic;
}
/* Variable italic (weight + width axes) — covers italic beyond the static cuts above */
@font-face {
  font-family: 'Ubuntu';
  src: url('../fonts/Ubuntu-Italic[wdth,wght].ttf') format('truetype-variations');
  font-weight: 100 700;
  font-stretch: 75% 100%;
  font-style: italic;
}
@font-face {
  font-family: 'Ubuntu Condensed';
  src: url('../fonts/Ubuntu-C.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@theme {
  --font-display: 'Ubuntu', sans-serif;
  --font-condensed: 'Ubuntu Condensed', sans-serif;

  /* Neutrals */
  --color-void: #05060a;
  --color-surface: #0d0f16;
  --color-elevated: #151822;
  --color-border: #232838;
  --color-border-hover: #333a4f;
  --color-text-primary: #e8ecf5;
  --color-text-secondary: #8b93a8;
  --color-text-disabled: #4a5169;

  /* Primary */
  --color-neon-cyan: #00e5ff;
  --color-cyan-deep: #00b8cc;
  --color-neon-purple: #b000ff;
  --color-purple-deep: #7a00cc;

  /* Semantic */
  --color-success: #00ff55;
  --color-success-deep: #00cc44;
  --color-warning: #ffe600;
  --color-warning-deep: #ccb800;
  --color-danger: #ff073a;
  --color-danger-deep: #d9004c;
  --color-info: #0055ff;
  --color-info-deep: #3d8bff;
  --color-highlight: #ff007a;
  --color-highlight-light: #ff4da6;
}
```

Adjust the `url(...)` paths to match where `main.css` sits relative to `src/assets/fonts/`. This automatically generates utilities like `bg-neon-cyan`, `text-neon-cyan`, `border-neon-cyan`, `font-display`, `font-condensed`.

### Naive UI bridge

Naive UI doesn't read Tailwind's CSS variables directly — its `GlobalThemeOverrides` object needs plain hex strings. Keep one `src/theme/tokens.ts` file with the _same_ hex values as the `@theme` block above (this DESIGN.md is the source of truth for both), and pass it into `n-config-provider`:

```ts
// src/theme/tokens.ts
export const tokens = {
  void: '#05060a',
  surface: '#0d0f16',
  elevated: '#151822',
  border: '#232838',
  textPrimary: '#e8ecf5',
  textSecondary: '#8b93a8',
  neonCyan: '#00e5ff',
  cyanDeep: '#00b8cc',
  neonPurple: '#b000ff',
  purpleDeep: '#7a00cc',
  success: '#00ff55',
  warning: '#ffe600',
  danger: '#ff073a',
  info: '#0055ff',
}
```

```ts
// theme/naive-overrides.ts
import { tokens } from './tokens'
export const naiveThemeOverrides = {
  common: {
    primaryColor: tokens.neonCyan,
    primaryColorHover: tokens.cyanDeep,
    bodyColor: tokens.void,
    cardColor: tokens.surface,
    popoverColor: tokens.elevated,
    borderColor: tokens.border,
    textColorBase: tokens.textPrimary,
    successColor: tokens.success,
    warningColor: tokens.warning,
    errorColor: tokens.danger,
    infoColor: tokens.info,
    fontFamily: 'Ubuntu, sans-serif',
  },
}
```

## Spacing

| Token     | Value | Usage                                          |
| --------- | ----- | ---------------------------------------------- |
| `space-1` | 4px   | Icon-to-label gaps                             |
| `space-2` | 8px   | Button padding, chip gaps                      |
| `space-3` | 12px  | Card internal padding (compact)                |
| `space-4` | 16px  | Card internal padding (default), panel gutters |
| `space-6` | 24px  | Section spacing                                |
| `space-8` | 32px  | Page-level vertical rhythm                     |

## Border Radius

| Token       | Value | Usage                         |
| ----------- | ----- | ----------------------------- |
| `radius-sm` | 4px   | Data chips, eval badges, tags |
| `radius-md` | 8px   | Buttons, inputs, cards        |
| `radius-lg` | 14px  | Modals, coaching report cards |

Keep radius modest everywhere — this theme reads "precise HUD," not "soft/bubbly." Chessground's board stays square (`radius: 0`) regardless of the surrounding card radius.

## Elevation

Neon glow replaces Slack's soft drop-shadows — reserved for _interactive/focus_ states only, never on static or large surfaces (large neon-glowing panels cause eye fatigue and drown out real signal).

| Level             | Value                          | Usage                                                    |
| ----------------- | ------------------------------ | -------------------------------------------------------- |
| `shadow-flat`     | `0 1px 2px rgba(0,0,0,0.4)`    | Default card elevation on dark surface                   |
| `shadow-elevated` | `0 8px 24px rgba(0,0,0,0.5)`   | Modals, dropdowns                                        |
| `glow-cyan`       | `0 0 12px rgba(0,229,255,0.5)` | Focus ring, primary button hover, active nav item        |
| `glow-danger`     | `0 0 12px rgba(255,7,58,0.5)`  | Check indicator, blunder flag, destructive confirm hover |

## Components

### Chessboard (Chessground)

- Board itself stays neutral/desaturated (standard chess board look) — the neon system lives in the _chrome around_ the board, not the squares, so the position stays easy to read.
- Board annotation colors are mapped **1:1 to the coaching pipeline's existing tag semantics**, so the color language is learned once and reused everywhere:

| Tag                | Meaning               | Color                                 |
| ------------------ | --------------------- | ------------------------------------- |
| `[arrow:]`         | Suggested move / plan | `color-neon-cyan`                     |
| `[mark:]`          | Key square / weakness | `color-neon-yellow` (`color-warning`) |
| `[route:]`         | Piece maneuver path   | `color-neon-purple`                   |
| Best move (engine) | Top engine choice     | `color-success`                       |
| Threat / blunder   | Danger square         | `color-danger`                        |
| Check              | King in check         | `color-danger` with `glow-danger`     |

- Last-move highlight: `color-neon-cyan` at low opacity (~20%) fill on the two squares.
- Selected square: `color-neon-purple` outline, no fill (keeps the piece legible).

### Analysis / Data Panels

- Card background `color-surface`, border `color-border`, `radius-md`, `shadow-flat`.
- Eval bar and numeric scores use `font-condensed`; positive eval in `color-success`, negative in `color-danger`, drawn/near-zero in `color-text-secondary`.
- Move list rows: hover state lifts to `color-elevated`, active/current move underlined in `color-neon-cyan`.

### Coaching Report Cards

- `radius-lg`, generous `space-6` internal padding — these are read slowly, not scanned, so give body text room (`Body`/`Body Light` roles, 1.55 line height).
- Category dividers (opening/middlegame/endgame) in `color-text-secondary`, not a neon color — dividers are structure, not signal.

### Buttons

- Primary: `color-neon-cyan` background, `color-void` text (dark text on bright cyan reads better than white-on-cyan), `glow-cyan` on hover.
- Secondary: transparent background, `color-border` outline, `color-text-primary` text, border brightens to `color-neon-purple` on hover.
- Destructive: `color-danger` background, follows primary button pattern otherwise.

## Do's and Don'ts

### Do

- Treat `neon-cyan` as _the_ primary color; every other neon carries a specific semantic or chart meaning, never decoration.
- Reuse the same board-annotation color mapping across the live board, coaching reports, and any replay/review UI.
- Use `font-condensed` anywhere numbers or notation get dense (move lists, eval bars, tablebase output).
- Keep the void/surface/elevated neutrals desaturated so neon accents read as signal, not noise.

### Don't

- Don't use more than two neon colors in a single component (e.g. a card shouldn't combine a cyan border, purple text, and a red icon).
- Don't apply `glow-*` shadows to large or static surfaces — glow means "this is interactive or urgent right now."
- Don't repurpose chess-annotation colors (best-move green, check red) for unrelated UI decoration — they're a taught vocabulary, keep it consistent.
- Don't set body text in pure white (`#fff`) — use `color-text-primary` (`#e8ecf5`) for comfortable long-session reading.
