# Handover & Vor-Audit: Detaillierte Analyse und Phasenplanung

Dieses Dokument enthält das vertiefte **Vor-Audit** zur Behebung technischer Schulden und die **Phasenplanung** für die Konsolidierung der Puzzle- und Eröffnungs-Domänen im Frontend. Es dient als Grundlage für die Abstimmung vor der eigentlichen Implementierung.

---

## I. Vor-Audit: Detaillierte Untersuchung

### Bereich A: Puzzle-Domäne (Tactics vs. Endgames)

#### 1. Store-Analyse (`tactics.store.ts` vs. `endgames.store.ts`)

Die beiden Stores weisen eine Duplikationsrate von über **90%** auf. Folgende Kern-Funktionalitäten sind identisch implementiert:

- **State:** `activePuzzle`, `activeParams`, `isDiscoveryMode`, `discoveryQueue`, `feedbackMessage`, `isProcessingGameOver`, `isWaitingForColorGuess`, `isWaitingForColorSelection`, `currentUserColor`.
- **Actions:** `initialize`, `localRestart`, `refillDiscoveryQueue`, `startDiscovery`, `handleRestart`, `handleExit`, `reset`.
- **Getters:** `gamePhase`, `fenFinal`, `topInfoDisplay`.

**Spezifische Unterschiede:**

- **Zusätzliche Dependencies:** `endgames.store.ts` importiert `useBoardStore` und `useAutoplayStore`.
- **Farb-Raten (Color Guess):**
  - `endgames.store.ts` enthält in `loadNewPuzzle` Sonderlogik für `practical_chess` & `materialEquality`, um die Farbe zu raten (`isWaitingForColorGuess.value = true`, Brett-Setup und Ausrichtung auf Weiß setzen). Dies wird übersprungen, falls Autoplay aktiv ist.
  - `tactics.store.ts` hat diese Abfrage nicht und startet das Spiel direkt.
- **Audio-Feedback:**
  - `endgames.store.ts` spielt bei korrekter Farbwahl und neu geladenem Puzzle zusätzlich `soundService.playSound('game_you_move')` ab.
- **Standard-Strategie (Fallback):**
  - Tactics: `puzzle.strategy || 'scenarioOnly'`
  - Endgames: `puzzle.strategy || (type === 'finish_him' ? 'playOutOnly' : 'scenarioPlus')`

#### 2. Strategie-Analyse (`TacticsPuzzleStrategy.ts` vs. `EndgamePuzzleStrategy.ts`)

Beide Klassen implementieren `IGameplayStrategy` und steuern den Zugprüfungs- und Engine-Gegenspiel-Loop.

- **Duplikation:** Die Mechanismen für Szenario-Checks (`onUserMoveExecuted`), Abweichungen (`scenarioPlus`), Engine-Zug-Anforderungen (`requestBotMove`) und Zug-Zurücknahmen (`onUserMoveUndone`) sind identisch.
- **Unterschiede:**
  - Die Feedback-Texte bei Fehlzügen im Szenario-Modus sind unterschiedlich:
    - Tactics: `"Das ist nicht die Taktiklösung! Überleg noch mal."`
    - Endgames: `"Das ist nicht der korrekte Endspiel-Zug! Überleg noch mal."`
  - `TacticsPuzzleStrategy` triggert `useCoachStore().analyzeCurrentPosition()` zusätzlich bei `onBotMoveExecuted()`.

#### 3. UI-Analyse (`Tactics.vue` vs. `Endgames.vue`)

- Die Seitenkomponenten sind strukturell identisch aufgebaut (Slot-Komposition über `GameLayout`). Sie laden lediglich ihre jeweiligen spezifischen Sidebars (`TacticsSidebar.vue` vs. `EndgamesSidebar.vue`) und binden die typspezifischen Stores ein.
- Die Sidebars teilen sich das Layout und die Steuerelemente (Difficulty, Discovery-Mode-Button, `VisualRadioGroup`), nutzen jedoch unterschiedliche Datenquellen für die Themen (Endgames unterstützt 3 Modi mit unterschiedlichen Kategorien, Tactics besitzt eine flache Liste).

---

### Bereich B: Theorie-Domäne (MozerBook vs. OpeningExplorer)

#### 1. Datenquellen & Backend-Entlastung

- **Aktuelle Datenversorgung:** Das Frontend lädt Eröffnungsdaten über zwei parallele Kanäle:
  1. `/opening/mozer_book?fen=...` (Verbindung zu Masters LMDB + serverseitige Anreicherung mit `openings_optimized.json`).
  2. `/opening/player?fen=...` (Verbindung zu Player LMDBs für Lichess-Statistiken).
- **Die Schwachstelle:** Das serverseitige Laden und Halten von `openings_optimized.json` in der `chess-theory-api` (Python) belegt unnötigen Arbeitsspeicher und erfordert ständige API-Kommunikation bei jedem Stellungswechsel.
- **Die Lösung:** `/home/umozer/projekte/CHESS_APP/chess_frontend/public/openings_full_graph/08_opening_wiki.json` ist die qualitativ beste und strukturell sauberste Version der Theorie.
  - Wenn wir dieses JSON direkt statisch im Frontend laden, kann der Client in **O(1)** alle Theorie-Fragen (Wie heißt die Eröffnung? Welcher ECO-Code? Welche Theorie-Züge gibt es?) beantworten.
  - Dadurch kann das Backend entlastet werden: `openings_optimized.json` kann im Python-Service gelöscht werden, und die Routen konzentrieren sich ausschließlich auf die Roh-Partiestatistiken (LMDBs).

#### 2. Datenstruktur-Vergleich der JSON-Dateien

- **Alt (`openings_optimized.json`):**
  - Flache FEN-Map auf Züge. Bietet keine einfache Historien-Rückverfolgung ohne FEN-Kette.
- **Neu (`08_opening_wiki.json`):**
  - Strikte Baumstruktur: Jeder Knoten hat eine eindeutige ID und referenziert seinen Elternknoten via `"p": [parent_id, move_uci]`.
  - Das ermöglicht im Client:
    - Schnelle Namensbestimmung (falls der aktuelle Knoten keinen Namen hat, wandert man im Baum nach oben, bis ein Name gefunden wird -> Kanonischer Eröffnungsname).
    - Bestimmung der gespielten Zugfolge ab Startstellung zur Erzeugung des Wikibook-Pfads.

---

## II. Phasenplanung zur schrittweisen Umsetzung

Um maximale Stabilität zu garantieren und das Risiko von Regressionen zu minimieren, wird das Projekt in 5 Phasen unterteilt. Jede Phase erfordert vor dem Fortfahren eine Validierung.

### Phase 0: Vorprojektierung und Abstimmung (Aktueller Schritt)

- **Ziel:** Besprechung des Vor-Audits, Klärung architektonischer Fragen und Freigabe des Konzepts durch den User.
- **Maßnahmen:**
  1. Diskussion des vorliegenden Berichts.
  2. Festlegung der genauen API-Schnittstellen (ob der `/opening/mozer_book`-Endpunkt serverseitig entschlackt werden soll oder ob wir ihn vorerst unberührt lassen und im Frontend ignorieren).
  3. Freigabe durch den User via **"OK"**.

### Phase 1: Client-Side Eröffnungs-Theorie (Grundsteinlegung)

- **Ziel:** Laden und Nutzen von `08_opening_wiki.json` direkt im Frontend.
- **Maßnahmen:**
  1. Implementierung eines `TheoryGraphService` im Frontend (`src/entities/opening`), der `/openings_full_graph/08_opening_wiki.json` asynchron lädt.
  2. Implementierung von Lookup-Funktionen im Service:
  - `getTheoryNodeForFen(fen: string)`
  - `getOpeningNameAndEco(fen: string)` (inklusive Fallback-Traversierung nach oben).
  - `getTheoryMoves(fen: string)`
  3. Unit-Tests / Manuelle Verifikation der Eröffnungszuordnung direkt im Frontend.

### Phase 2: Zusammenführung der Eröffnungs-Features

- **Ziel:** Konsolidierung von `mozer-book` und `opening-explorer` zu `opening-explorer` unter Nutzung der neuen Client-Theorie.
- **Maßnahmen:**
  1. Erstellung eines wiederverwendbaren UI-Subcomponents für Wikibooks / Theorie-Pfade.
  2. Zusammenführung der Stores (`useOpeningExplorerStore` und `useMozerBookStore` zu einem einzigen Store in `opening-explorer`).
  3. Bereinigung von redundantem Code in `src/features/mozer-book`.
  4. Deaktivierung / Löschung der ungenutzten Backend-Theoriedatei `openings_optimized.json` in `chess-theory` nach Absprache.

### Phase 3: Konsolidierung der Puzzle-Domäne (Tactics + Endgames)

- **Ziel:** Vollständige Beseitigung der Redundanzen bei Taktik- und Endspielaufgaben.
- **Maßnahmen:**
  1. Erstellung des zentralen FSD-Stores: `src/features/puzzle/model/puzzle.store.ts` (vollständig typisiert, konfigurierbar für Tactics, Finish Him, Theory Endings, Practical Chess).
  2. Erstellung einer generischen Klasse `PuzzleStrategy.ts`, welche die Unterschiede (Audio-Flags, Fehlermeldungstexte) über Konfigurationsparameter aufnimmt.
  3. Entwicklung des Widgets `puzzle-game` (Konsolidierung der Vue-Seiten).
  4. Entwicklung des Widgets `puzzle-selector` (Konsolidierung der Sidebar-Logiken).
  5. Löschung der alten Ordner `src/features/tactics`, `src/features/endgames` sowie der Seiten `src/pages/tactics` und `src/pages/endgames` (bzw. Ersetzung durch dünne Router-Wrapper, die das neue Puzzle-Widget laden).

### Phase 4: Qualitätskontrolle & OnUnmounted-Cleanups

- **Ziel:** Absicherung der Codequalität und Behebung von RAM-Leaks.
- **Maßnahmen:**
  1. Implementierung von sauberen Cleanup-Routinen bei Seitenwechseln (Zurücksetzen von Pfeilen, Stoppen der Stockfish-Engine in `onUnmounted`).
  2. Ausführen von `pnpm type-check && pnpm lint`.
  3. Abschließender Funktionstest aller Trainingsmodi.

---

## III. Abstimmungsfragen für die Freigabe

Bitte geben Sie mir Feedback zu folgenden Punkten, bevor wir mit **Phase 1** starten:

1. **Backend-Bereinigung:** Sollen wir die API `/opening/mozer_book` auf dem Fastify-Backend so belassen und lediglich die Theorieanreicherung im Frontend durch den neuen clientseitigen Service ersetzen, oder soll auch der Fastify-Backend-Code direkt vereinfacht werden? (Empfehlung: Erst Frontend-Migration, dann Backend-Cleanup im Nachgang).
2. **Dateinamen & Verzeichnisse:** Sind Sie mit der Namensgebung (`src/features/puzzle/` für den Store und `src/widgets/puzzle-game` bzw. `src/widgets/puzzle-selector`) einverstanden?
3. **Freigabe:** Wenn das Konzept für Sie stimmig ist, antworten Sie bitte mit **"OK"** (und ggf. Kommentaren), damit ich die Vorbereitungen abschließen und Phase 1 starten kann. Wenn Anpassungen nötig sind, antworten Sie mit **"NOK"** und Ihren Wünschen.

================GEMACHT========================Zusammenführung der Puzzle- und Endspiel-Domänen

Ich habe die Zusammenführung der Puzzle- und Endspiel-Domänen unter dem gemeinsamen Dach "PuzzlePlay" erfolgreich abgeschlossen.

Was umgesetzt wurde:
Einheitlicher Store (puzzle.store.ts):

Verwaltet alle vier Submodes (tactics, finish_him, practical_chess, theory_endings) und validiert diese per Fail-Fast.
Strategie-Mappings wurden wie vereinbart definiert:
finish_him $\rightarrow$ scenarioPlus
tactics $\rightarrow$ scenarioOnly
practical_chess & theory_endings $\rightarrow$ playOutOnly
Die Color-Guessing-Mechanik wird ausschließlich für practical_chess in der Kategorie materialEquality getriggert.
Vereinheitlichte Gameplay-Strategie (PuzzleStrategy.ts):

Die Validierungs- und Playout-Logik wurde konsolidiert.
Coach-Feedback & Takeback-Logik: Die gesamte Coach-Interaktion und das Zurücknehmen von Fehlzügen (Takebacks) wurden vollständig erhalten.
Fehler-Feedbacks passen sich dem Modus an (Taktik-Fehlermeldung vs. Endspiel-Fehlermeldung).
Flexibles UI (PuzzlePage.vue & PuzzleSidebar.vue):

Eine einzige Page steuert das Layout.
Die Sidebar passt sich dynamisch an: Sie wählt das passende Layout (3 Spalten für Taktik, 2 Spalten für Endspiele), die richtigen Themen-Listen sowie die Modus-Titel.
Frontend Einstiegspunkte:

Router (src/app/router/index.ts): Mappt die vier Routen /tactics, /finish-him, /practical-chess und /theory-endings direkt auf die neue PuzzlePage.
Navigation (NavMenu.vue): Zeigt die vier Einstiegspunkte einzeln mit passenden Icons an.
Landing Page (WelcomeView.vue): Kacheln wurden aufgeteilt, um dem Nutzer alle vier Submodes als separate Premium-Einstiege anzubieten.
Bereinigung & Validierung:

Die alten, redundanten Ordner (src/features/tactics, src/features/endgames, src/pages/tactics, src/pages/endgames) wurden entfernt.
Die Prüfung mit pnpm type-check && pnpm lint läuft fehler- und warnungsfrei durch.
