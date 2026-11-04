# DESIGN_handover.md — ExtraPawn Studio Design System Handover

> **Aktueller Standard:** `src/assets/DESIGN.md` & `big_CSS_refactoring_log.md` (**ExtraPawn Studio — Supabase × Lichess Hybrid**, Dual-Theme Dark & Light).

## 1. Kernregeln für KI-Agenten

1. **Dual-Theme Architektur (Dark & Light Mode)**:
   - Alle Farben in `src/assets/main.css` basieren auf polarisierten CSS-Variablen (`:root` für Dark Mode, `html[data-theme="light"]` für Light Mode), die in Tailwind v4 `@theme` eingebunden sind.
   - Verwende in `.vue`-Templates ausschließlich semantische Tailwind-Klassen: `bg-canvas`, `bg-surface`, `bg-elevated`, `bg-overlay`, `border-border`, `border-border-hover`, `text-text-primary`, `text-text-secondary`, `text-text-disabled`, `bg-brand`, `text-brand`, `text-on-brand`, `bg-accent`, `text-accent`, `text-success`, `text-warning`, `text-danger`, `text-info`.
   - **Verboten:** Harte Hex-Codes (`#1c1c1c`, `#ffffff`, `#3ecf8e`), `rgba(...)` in Templates/TS, `!important`-Hacks, `backdrop-filter: blur(...)` oder Neon-Glows.

2. **Reaktive Tokens für Naive UI & ECharts (`src/shared/theme/tokens.ts`)**:
   - Für JS/TS-Konfigurationen (ECharts, Naive UI Overrides) nutze `useThemeTokens()` oder `tokens` aus `@/shared/theme/tokens`.

3. **Typografie (`src/assets/fonts.css`)**:
   - **`font-display` (`Ubuntu`, `.woff2`)**: Überschriften, Navigation, Buttons, Fließtext.
   - **`font-condensed` (`Ubuntu Condensed`, `.woff2`, `tabular-nums`)**: Schachnotation (SAN/FEN), Engine-PV-Linien, Glicko-2-Ratings, Timer, Prozentwerte und dichte Analysetabellen.

4. **Validierung**:
   - Vor Abschluss jeder Aufgabe müssen `pnpm type-check` und `pnpm lint` mit **0 Fehlern und 0 Warnungen** durchlaufen.
