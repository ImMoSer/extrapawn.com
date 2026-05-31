# Handover & Vor-Audit: Technische Schulden und Architektur-Optimierungen

Dieses Dokument dient als Übergabe-Protokoll und Vor-Audit für nachfolgende Entwickler und AI-Agenten. Es beschreibt den aktuellen Zustand des Codes, identifiziert architektonische Überschneidungen (Redundanzen) und skizziert konkrete Pfade zur Konsolidierung im Einklang mit dem **Feature-Sliced Design (FSD)**.

---

## 1. Status Quo nach der letzten Bereinigung

Kürzlich wurden wichtige FSD-Klarstellungen vorgenommen, um Domänengrenzen zu wahren:
*   **`entities/game`**: Beherbergt nun den Partieverlauf (`PgnTree.vue` und `PgnTreeNode.vue`), da dieser eine Kernansicht des Schachspiel-Zustands ist und in mehreren Kontexten (Coach, Analyse, etc.) wiederverwendet wird.
*   **`features/sparring`** (umbenannt von `play-coach`): Enthält nur noch maia-spezifische Sparring-Logik und das neue `SparringControlsPanel.vue` (Brett drehen, FEN laden, Neustart).
*   **`widgets/coach-sidebar`**: Führt die Komposition von Coach-Funktionen (Coach-Tab) und Analyse-Funktionen (PGN Tree + Stockfish Engine Lines) sauber über Slots aus.
*   **`features/analysis`**: Die ungenutzte `EvalBar.vue` wurde restlos entfernt, um das UI zu entschlacken.

---

## 2. Detaillierte Baustellen & Optimierungs-Potenziale

Im aktuellen Codebase-Zustand gibt es mehrere redundante Implementierungen, die zu "architektonischem Chaos" führen können. Nachfolgend sind die dringendsten Konsolidierungsvorschläge aufgeführt.

### A. Taktik & Endspiel: Konsolidierung zu einer Puzzle-Domäne

Taktikrätsel (`tactics`) und Endspielrätsel (`endgames` bzw. `finish_him`) nutzen nahezu identische UI-Muster und Engine-Züge. Aktuell sind diese jedoch strikt getrennt implementiert:

| Bisherige Datei | Vorgeschlagene Konsolidierung | Beschreibung / Ziel |
| :--- | :--- | :--- |
| `src/pages/tactics/ui/TacticsSidebar.vue`<br>`src/pages/endgames/ui/EndgamesSidebar.vue` | **`src/widgets/puzzle-selector`** (oder Feature) | Beide Sidebars listen Lektionen/Themen auf und fordern neue Puzzles an. Ein einziges konfigurierbares Widget spart ~500 Zeilen Code. |
| `src/pages/tactics/ui/Tactics.vue`<br>`src/pages/endgames/ui/Endgames.vue` | **`src/widgets/puzzle-game`** | Beide Seiten koordinieren ein Spiellayout mit Board, Top-Infos und Farbauswahl. Sie sollten ein generisches Puzzle-Widget rendern. |
| `src/features/tactics/model/tactics.store.ts`<br>`src/features/endgames/model/endgames.store.ts` | **`src/features/puzzle/model/puzzle.store.ts`** | Ein einziger Store für aktiven Puzzle-Zustand, Historie und Bewertung. Unterschiede (z. B. Puzzle-Typen) werden über Parameter gesteuert. |
| `src/features/tactics/model/TacticsPuzzleStrategy.ts`<br>`src/features/endgames/model/EndgamePuzzleStrategy.ts` | **`src/features/puzzle/model/PuzzleStrategy.ts`** | Die Zugszenarien-Prüfung folgt demselben Prinzip. Eine gemeinsame Klasse mit Strategy-Pattern (z. B. `playOutOnly` vs. `oneMove`) verhindert Logik-Duplikate. |

---

### B. Eröffnungs-Erkundung & MozerBook: Zusammenführung

Aktuell existieren zwei parallele Systeme zur Eröffnungsanzeige und Wikibook-Theorie:
1.  **`src/features/mozer-book`**: Zeigt Theoriebücher, Wiki-Ressourcen und Züge an.
2.  **`src/features/opening-explorer`**: Zieht Lichess-Eröffnungsdaten heran.
3.  **Mehrfach-Wikibooks**: Render-Logik für Theoriebücher existiert sowohl in `mozer-book` als auch direkt im `CoachSidebar`-Kontext.

#### **Empfehlung:**
*   Zusammenführung beider Features in ein einziges globales Feature **`src/features/opening-explorer`**.
*   Dieses neue Feature übernimmt das moderne Look & Feel und die Services von `mozer-book` (Modernisierung des Theory-Services).
*   Wikibooks sollten als wiederverwendbares Unter-Komponente extrahiert werden, das flexibel im `opening-explorer` oder der `coach-sidebar` eingebunden werden kann, anstatt Code zu duplizieren.

---

### C. Einstiegspunkte (Submodes) in der Navigation & Landing-Page

Aktuell sind die Links zu den einzelnen Trainingsmodi über verschiedene Stellen verstreut oder rufen nicht dedizierte Submodes auf.

#### **Empfehlung:**
*   **Navigationsmenü (`src/widgets/nav-menu/ui/NavMenu.vue`)**: Integration direkter, sauberer Einstiegspunkte für jeden spezifischen Trainings-Submode (z. B. Sparring, Taktik, Endspiele, Speedrun).
*   **Welcome-Seite (`src/pages/welcome/ui/Welcome.vue`)**: Neugestaltung der Landing-Page-Cards, sodass jeder Submode klar benannt und direkt ansteuerbar ist.

---

## 3. Qualitätsrichtlinien für nachfolgende Implementierungen

*   **Kein `any`-Typing**: Bei der Zusammenführung der Stores darf kein implizites oder explizites `any` eingeschleust werden (`@typescript-eslint/no-explicit-any` ist aktiv!).
*   **FSD-Hierarchie beachten**: Features dürfen keine anderen Features importieren (z. B. darf `features/sparring` nicht direkt aus `features/coach` importieren). Kompositionen gehören ausschließlich in die **`widgets/`** oder **`pages/`** Ebene.
*   **Zustand sauber aufräumen (`onUnmounted`)**: Bei jedem Seitenwechsel müssen Engines hart gestoppt und Pfeilzeichnungen zurückgesetzt werden.
*   **Verifizierung**: Jede Änderung muss lokal mit `pnpm type-check && pnpm lint` auf Fehlerfreiheit geprüft werden.
