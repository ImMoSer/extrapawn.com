# Repertoire-Training (Study Reply Training) — Konzept & Dokumentation

Dieses Dokument beschreibt die Implementierung, das theoretische Funktionsprinzip sowie die nächsten Schritte (Übergabe an nachfolgende Entwickler-Sitzungen) für das **Repertoire-Training** in ExtraPawn.

---

## 1. Übersicht der heutigen Änderungen

Im Rahmen der Integration des Repertoire-Trainings wurden folgende Komponenten neu implementiert und in die FSD-Architektur (Feature-Sliced Design) eingebunden:

1. **Routing & Menü-Integration**:
   - Registrierung der Route `/repertoire-training` in `src/app/router/index.ts`.
   - Konfiguration des Modus in `src/shared/config/gameModes.config.ts`.
   - Verknüpfung im Navigationsmenü und auf der Willkommensseite (`WelcomeView.vue`).
2. **Benutzeroberfläche (UI)**:
   - Erstellung von `RepertoireTrainingPage.vue` als Hauptseite mit einem responsiven Dreispalten-Layout (Stats-Panel links, WebChessBoard in der Mitte, PgnTree rechts).
   - Implementierung des `StudyImportCard.vue`-Widgets zur Handhabung des PGN-Imports aus Lichess-Studien und zur Steuerung der lokalen Bibliothek.
   - Implementierung des `TrainingStatsPanel.vue`-Widgets zur Live-Anzeige von Trainingsfortschritten (Weed-Pressure-Sauberkeit, gespielte Linien, Genauigkeit).
3. **Core-Gameplay & PgnService-Lifecycle**:
   - Behebung des Konflikts beim Zurücksetzen der PGN beim Spielstart (Nutzung von `keepPgn: true` in `startWithStrategy` und manuelles Aufsetzen des Boards über `boardStore.setupPosition`).
   - Dynamische Synchronisation grafischer Markierungen (Pfeile und Kreise aus den PGN-Kommentaren wie `[%csl ...][%cal ...]`) während des Live-Trainings über die Methode `boardStore.syncVisualCues()`.
   - Einbindung des globalen `PgnTree.vue` in den rechten Sidebar-Bereich im schreibgeschützten Modus (`read-only="true"`), um die Verzweigungen des Kapitels anzuzeigen.
   - Farbige Hervorhebung der Züge (SAN) im PgnTree basierend auf der NAG-Bewertungsqualität (z. B. grün für brillante Züge, rot für Einsteller).

---

## 2. Funktionsprinzip & Logik des Study Reply Trainings

Das Repertoire-Training ermöglicht es Benutzern, ihre eigenen Eröffnungs-Repertoires oder Lichess-Studien aktiv gegen das System zu trainieren. Das System prüft die Züge des Benutzers und antwortet automatisch mit Zügen aus dem geladenen PGN-Baum.

### 2.1 Spaced Repetition System (SRS) & Weed-Pressure-Prinzip
Das Training basiert auf einem Algorithmus zur Simulation von Vergessenskurven (Unkraut-Metapher):

* **Blattknoten (Leaf Nodes)**: Jede eigenständige Variante (Linie) im Kapitel entspricht einem Pfad von der Wurzel des Baumes zu einem Blattknoten (einem Endknoten ohne weitere Kinder).
* **Weed Pressure (Unkrautdruck)**: Jeder Blattknoten hat einen Unkrautwert $W \in [0.0, 1.0]$:
  - Ein noch nie gespielter Pfad startet mit einem Unkrautdruck von `1.0` (maximaler Druck, dringender Trainingsbedarf).
  - Bei erfolgreicher Lösung sinkt das Unkraut (die Mastery steigt).
  - Mit der Zeit wächst das Unkraut wieder an (Simulation des Vergessens, ca. 14 % pro Tag ohne Wiederholung):
    $$W = \text{baseWeed} + \text{daysSinceLast} \times 0.14$$
* **Chapter Cleanliness (Sauberkeit)**: Der Durchschnittswert aller Blattknoten-Unkrautdrücke definiert den Gesamtfortschritt des Kapitels:
  $$\text{Cleanliness} = 1.0 - \text{averageWeed}$$

### 2.2 Auswahl der nächsten Herausforderung (Challenge Selection)
Wenn eine Variante beendet wird oder das Training beginnt, wählt der Algorithmus die nächste zu trainierende Linie aus:
1. Das System prüft an jeder Verzweigung die Nachfolger (Kinder).
2. Es läuft rekursiv die Pfade zu den Blättern ab und ermittelt den **maximalen Unkrautdruck** jeder Verzweigung.
3. Der Zug mit dem höchsten maximalen Unkrautdruck wird ausgewählt (Deepest-Weed-First).
4. **Mainline-Präferenz**: Haben zwei Verzweigungen denselben Unkrautdruck (z. B. beide noch ungespielt), sorgt eine mikroskopische strukturelle Anpassung dafür, dass die Hauptvariante (der erste PGN-Zweig) zuerst geladen wird.

---

## 3. Handover für Nachfolger-Agenten: Technische Schulden & Empfehlungen

Für zukünftige Iterationen des Repertoire-Trainings sollten folgende Punkte berücksichtigt werden:

### 3.1 Technische Schulden (Technical Debts)
* **IndexedDB Serialisierung**:
  - Ganze PGN-Bäume (inkl. aller rekursiven PgnNodes) werden direkt als JSON im `root`-Feld der Tabelle `studies` gespeichert. Bei extrem großen Kapiteln (z. B. >1000 Plies) kann dies zu Performance-Engpässen beim Laden/Speichern führen.
  - *Empfehlung*: Gegebenenfalls eine Normalisierung der Kapitelstruktur oder eine Kompression der PGN-Bäume in Betracht ziehen.
* **Navigation während des Trainings**:
  - Im Trainingsmodus ist der `PgnTree` bewusst im schreibgeschützten Modus (`read-only`), da freies Navigieren das aktive Test-Szenario unterbrechen würde. 
  - *Empfehlung*: Falls der Nutzer während des Trainings navigieren möchte, sollte das Training pausiert werden.

### 3.2 Zukünftige Features & Empfehlungen
* **Cloud-Synchronisation**:
  - Derzeit wird der SRS-Fortschritt (`srs_progress` Tabelle in Dexie) nur lokal in der IndexedDB des Browsers gespeichert. Sobald der Nutzer eingeloggt ist, sollte dieser Fortschritt mit dem Backend synchronisiert werden.
* **Visuelle Fortschritts-Indikatoren im PgnTree**:
  - Es wäre für den Nutzer sehr hilfreich, den Unkrautdruck (Weed Pressure) oder die Mastery jeder Variante direkt als kleinen farbigen Kreis (z. B. grün = gemeistert, gelb = okay, rot = dringend wiederholen) neben den Zügen im `PgnTree` zu sehen (ähnlich wie in Lichess).
* **Auswahl bestimmter Abweichungen**:
  - Dem Benutzer könnte die Möglichkeit gegeben werden, das Training auf bestimmte Untervarianten einzugrenzen, statt immer das gesamte Kapitel nach dem SRS-Prinzip zu trainieren.
