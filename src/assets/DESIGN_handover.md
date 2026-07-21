# DESIGN_handover.md — Design System & UI Refactoring Handover

Dieses Dokument dient als **Übergabe-Bericht (Handover)** für die Weiterführung des UI- & Design-Refactorings auf **Tailwind CSS v4** im Projekt `chess_frontend`.

---

## 📌 1. Projekt-Kontext & Grundsatz-Regeln

- **Fokus**: Ausschließlich UI, CSS-Styling, Tailwind v4, ECharts-Viz, Typografie und Naive UI Theme-Integration.
- **Design-Philosophie**: **Zen Dark / Cyber Neon System** (Dark Mode `bg-void`, Neon-Cyan `#00e5ff`, Neon-Purple `#b000ff`, Neon-Red `#ff073a`, Accent-Yellow `#ffe600`, Acid-Green `#39ff14`).
- **Null Scoped CSS Ziel**: Keine `<style scoped>`-Blöcke mehr in `.vue`-Dateien belassen. Sämtliche Styles werden in Tailwind v4 Utility-Klassen oder `@theme` aufgelöst.
- **Single Source of Truth**: Niemals harte Hex-Farben (`#9b59b6`, `#3498db` etc.) in JS/TS oder ECharts-Konfigurationen schreiben. Immer `tokens` aus `@/shared/theme/tokens` importieren!

---

## ✅ 2. Bereits vollständig migrierte Bereiche (100% Fertiggestellt)

### 🚀 A. Foundation & Design System Setup
1. **Tailwind v4 Integration**:
   - Paket: `@tailwindcss/vite` in `vite.config.ts` eingebunden.
   - Entry: `src/assets/main.css` enthält `@import 'tailwindcss';` sowie den vollständigen `@theme`-Block.
   - Animationen: Keyframes wie `@keyframes rainbow` und `--animate-rainbow` sind direkt im `@theme`-Block hinterlegt.
2. **Typografie & Schriften**:
   - `src/assets/fonts.css` deklariert `Ubuntu` (`font-display`) und `Ubuntu Condensed` (`font-condensed`).
   - Das Font-Asset `Ubuntu-C.ttf` liegt lokal unter `src/assets/fonts/`.
3. **Design Token Bridge**:
   - `src/shared/theme/tokens.ts`: Exportiert alle Hex-Werte als typisiertes `tokens`-Objekt für TS/Vue/ECharts.
   - `src/shared/theme/naive-overrides.ts`: Weist Naive UI via `GlobalThemeOverrides` in `App.vue` das Zen Dark Schema zu.

---

### 👤 B. Seite 1: User Cabinet (`src/pages/user-cabinet/` & `src/features/profile/`, `src/features/lichess-games-db/`)
- `UserCabinetView.vue`: Layout-Grid auf Tailwind v4.
- `UserProfileHeader.vue`: Profil-Card, Avatar, Username (`font-display text-neon-cyan`), Rating-Badges (`font-condensed`), Pawncoin-Rainbow-Effekt via Pure Tailwind `animate-rainbow`.
- `ThemeRoseChart.vue`: ECharts Categorical Palette via `tokens.ts`, Zoom-Modal, Popups & Scoped CSS eliminiert.
- `LichessGamesStatistics.vue`: Dashboard Card & Tab-Layout.
- `LichessGamesWdlTable.vue`: WDL-Fortschrittsbalken & Ratings (`font-condensed`).
- `LichessGamesTopOpenings.vue`: Rose Chart & Varianten-Umschaltung via `tokens.ts`.
- `LichessGamesOpeningDetailsDashboard.vue`: Varianten-Karten, TPR-Ratings & Lade-Spinner.
- `LichessGamesCacheSettings.vue`: Sync-Balken, Profile-Display & Aktions-Buttons.
- `LichessProfileStatsTable.vue`: Relative Spieleverteilung & Profil-Stats.
- `LichessActivityStatsTabs.vue`: Tages-/Wochen-Stats & WDL-Farben.

---

### 🏆 C. Seite 2: Records / Hall of Fame (`src/pages/records-page/` & `src/features/leaderboards/`)
- `RecordsPageView.vue`: "HALL OF FAME" Titel mit Leucht-Glow & Gradient (`from-neon-cyan via-neon-purple to-highlight`), Sektions-Header.
- `PlanStreakLeaderboardTable.vue`: Table-Card, Header, Tabellen-Render-Spalten mit `tokens.orange` & `tokens.success`.
- `SkillLeaderboardTable.vue`: Legend-Badges & ECharts Stacked Bar Chart mit `tokens.neonPurple`, `tokens.danger`, `tokens.neonCyan`, `tokens.success`.
- `TimedModeLeaderboardTable.vue`: Segment-Tabs, Max-Ratings & Best-Day Spalten (`font-condensed`).
- `SimpleLeaderboardTable.vue`: Challenge-Buttons & Tabellen-Container.
- `SidebarLeaderboard.vue`: Top-10 Mini-Leaderboard mit Transparenz, Hover-Farben & User-Footer.

---

### 🧩 D. Einzelne isolierte Komponenten
- `src/features/analysis/ui/EngineLines.vue`: Engine PV Lines in `font-condensed`, Score-Klassen auf Tailwind v4.
- `src/pages/repertoire-training/ui/RepertoireTrainingPage.vue`: Header & Container.
- `src/shared/ui/ConfirmationModal.vue`: Modal Overlay, Dialog Card & Buttons.

---

## 📋 3. Noch ausstehende Seiten & Komponenten (Roadmap)

Der Nachfolger soll in folgenden Schritten vorgehen:

1. **Seite 3: Analysis / Main Game View** (`src/pages/puzzle/`, `src/features/analysis/`, `src/widgets/game-board/`)
   - Haupt-Schachansicht, Chessground Chrome, Evaluation Bar, Move List, Engine-Control Panel.
2. **Seite 4: Repertoire & Studies** (`src/pages/repertoire-training/`, `src/entities/study/`)
   - Eröffnungsbaum, Repertoire-Listen & Trainings-Cards.
3. **Seite 5: Puzzles & Workout Pages** (`src/pages/task-today/`, `src/pages/bonus/`, `src/pages/sparring/`)
   - Tagesaufgaben-Widgets, Bonus-Seiten, Sparring-Interface.
4. **Seite 6: Settings, Pricing & Modale** (`src/pages/pricing/`, `src/pages/about/`, `src/pages/legal/`)
   - Preistabellen, Legal Pages, Einstellungs-Modale.

---

## 🎯 4. Strikte Guidelines für den Nachfolger (WICHTIG!)

Wenn du (als KI in einer neuen Session) die Arbeit aufnimmst, halte dich **ausnahmslos** an folgende Prinzipien:

1. **Keine Scoped CSS Blöcke**:
   - Wenn du eine `.vue`-Datei refakturierst, lösche den `<style scoped>`-Block vollständig.
   - Übersetze alle bisherigen CSS-Regeln in Tailwind v4 Utility-Klassen.
   - Wenn Naive UI Elemente tief gestylt werden müssen, verwende Arbitrary Child Variants: `class="[&_.disabled-diff]:opacity-45"`.

2. **Zentrale Token-Pflicht (`tokens.ts`)**:
   - **VERBOTEN**: `{ color: '#9b59b6' }` oder inline CSS Variablen wie `'var(--color-accent-success)'`.
   - **PFLICHT**: `import { tokens } from '@/shared/theme/tokens'` und Nutzung von `tokens.neonPurple`, `tokens.success`, `tokens.warning`, `tokens.danger`, `tokens.orange` usw.

3. **Strikte Typografie-Zuordnung**:
   - **`font-display` (`Ubuntu`)**: Für Überschriften, Seitentitel, Haupt-Tabellen-Header, Marken-Elemente.
   - **`font-condensed` (`Ubuntu Condensed`)**: Für Züge (e2e4, Nf3), ELO/Ratings, TPR-Werte, Prozentzahlen, WDL-Zahlen, Ränge, Zeiten (`12:34`) und Tabellenzahlen.

4. **Fail-Fast & Qualitätsprüfung vor jedem Turn-Ende**:
   - Führe **IMMER** nach deinen Änderungen folgende Befehle aus:
     ```bash
     pnpm type-check && pnpm lint
     ```
   - Beide müssen **0 Fehler** aufweisen, bevor du dem User berichtest!

5. **Feature-Sliced Design (FSD)**:
   - Respektiere FSD-Schichten: `shared` < `entities` < `features` < `widgets` < `pages` < `app`.
   - `entities` dürfen niemals `features` importieren!
