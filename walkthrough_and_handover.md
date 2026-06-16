# Walkthrough & Handover: Endspiel-Performance-Analyse

Dieses Dokument dient als Einstiegshilfe (Walkthrough) und Übergabe-Protokoll (Handover) für nachfolgende Entwickler und AI-Agenten. Es konzentriert sich ausschließlich auf die in der heutigen Sitzung implementierten Features zur Endspiel-Analyse, Fehlererkennung und zukünftige Optimierungspotenziale.

---

## 1. Walkthrough: Was wurde heute umgesetzt?

Wir haben die Lichess-Endspiel-Performance-Analyse auf eine lückenlose Zugs-Historien-Analyse umgestellt und das UI grundlegend überarbeitet:

### A. Backend-Fehlererkennung & Gaviota-State-Machine
* **Rust-Indexer (`end_perf_reporter.rs`):** Erfasst nun ab $\le 5$ Figuren lückenlos jeden Halbzug der Partie und exportiert die FENs sowie die gespielten Züge im Standard-SAN-Format (`played_move`).
* **Python-Analyse (`stockfish_server`):** Ein Zustandsautomat bewertet jeden Halbzug anhand der Gaviota Tablebase (Aus Sicht des Users: $+1$ für Win, $0$ für Draw, $-1$ für Loss) und identifiziert 5 Fehlerklassen:
  1. `dropped_win_to_draw`: Eigene Gewinnstellung zu Remis verpatzt.
  2. `dropped_win_to_loss`: Eigene Gewinnstellung zu Verlust verpatzt.
  3. `dropped_draw_to_loss`: Eigene Remisstellung zu Verlust verpatzt.
  4. `missed_winning_chance`: Gegner-Patzer schenkte Win, aber User verpasste die Bestrafung.
  5. `missed_saving_chance`: Gegner-Patzer schenkte Draw, aber User verpasste die Rettung.

### B. Frontend-Dashboard & UI-Polishing (`LichessEndgameDashboard.vue`)
* **KPI-Bereich (Summary-Card):**
  * Wir zeigen vier kreisförmige `NProgress`-Diagramme nebeneinander: **Zug-Präzision**, **Gewinnstarts** (Realisierungsquote), **Remisstarts** (Haltequote) und **Rettungen** (Abwendungsquote bei theoretischem Verlust).
  * Darunter wird die tabellarische Aufstellung nach Endspiel-Typen über die volle Breite gerendert. Die redundante Spalte *Fehlerquote* wurde entfernt, und *Verluststarts* wurde in *Rettungen* umbenannt.
* **Kompakte 2-Tab-Aufteilung:**
  * **Tab 1: Verpatzt (Dropped):** Fasst alle verpatzten Züge (`dropped_win_to_draw`, `dropped_win_to_loss`, `dropped_draw_to_loss`) zusammen.
  * **Tab 2: Verpasste Chancen (Missed):** Fasst alle ungenutzten gegnerischen Fehler (`missed_winning_chance`, `missed_saving_chance`) zusammen.
* **Die Spalte "Verlauf":**
  * Zeigt direkt farblich visualisiert das Ausgangs- und Endresultat des Fehlers (z. B. `Win ➔ Draw`, `Win ➔ Loss`, `Draw ➔ Loss`, `Win verpasst`, `Draw verpasst`).
* **Prioritätsbasierte Sortierung:**
  * Innerhalb einer Endspiel-Gruppe (z. B. *Pawn Endings*) werden die Züge nach ihrer Kritikalität sortiert (z. B. `Win ➔ Draw` steht vor `Win ➔ Loss` und `Draw ➔ Loss`).

---

## 2. Handover: Zukunfts-Konzepte zur Performance-Optimierung

Bei großen Datenbanken (z. B. >10.000 importierten Spielen) entstehen hohe Datenmengen und Rechenlasten. Folgende Konzepte sind für die nächste Entwicklungsphase vorbereitet:

### A. Gzip-Kompression der API-Responses
* **Problem:** Die HTTP-Payload von `/api/engine-eval/endgame/analyze` wird bei vielen analysierten Spielen extrem groß.
* **Lösung:** Aktivierung der nativen HTTP-Gzip-Kompression im Backend.
  * *FastAPI:* Hinzufügen der `GzipMiddleware` aus `fastapi.middleware.gzip`.
  * *Fastify:* Plugin `@fastify/compress` einbinden.

### B. Inkrementelle Synchronisation (Delta-Analyse)
* **Problem:** Wenn der User nach einer Erst-Analyse von 10.000 Spielen z. B. 10 neue Partien importiert und synchronisiert, ist es ineffizient, die gesamte Datenbank erneut hochzuladen und komplett neu zu analysieren.
* **Lösung:**
  * Das Frontend speichert die Liste bereits analysierter Game-IDs bzw. den Zeitstempel der letzten Analyse.
  * Beim Klick auf Synchronisieren werden **nur die neuen Partien (Deltas)** an das Backend übertragen.
  * Das Backend berechnet die Endspiel-Analyse nur für diese Deltas und **merged** die neu erkannten Fehler in den bestehenden Gesamtbericht des Benutzers.

### C. Komprimierte Speicherung im Backend

Der vom Python-Backend generierte Gesamtbericht des Benutzers sollte serverseitig persistent gespeichert werden, um wiederholte Berechnungen beim Laden des Dashboards zu vermeiden. Hierfür stehen zwei Hauptansätze zur Auswahl:

#### Ansatz 1: Datei-basierte Gzip-Speicherung (Empfohlen für den Start)
* **Wie genau?** Das Backend (FastAPI) speichert das berechnete JSON-Ergebnis für jeden Benutzer in einer separaten Datei (z. B. unter `storage/analyses/{user_id}.json.gz`).
* **Was wird benötigt?** In Python ist dies mit Bordmitteln ohne externe Bibliotheken umsetzbar:
  ```python
  import gzip
  import json

  # Schreiben
  with gzip.open(f"storage/analyses/{user_id}.json.gz", "wt", encoding="utf-8") as f:
      json.dump(analysis_result, f)

  # Lesen
  with gzip.open(f"storage/analyses/{user_id}.json.gz", "rt", encoding="utf-8") as f:
      analysis_result = json.load(f)
  ```
* **Vorteile:**
  * **Extreme Einfachheit:** Keine Datenbank-Infrastruktur, keine Tabellen-Schemata, keine Migrationen notwendig.
  * **Hervorragende Kompression:** Reduziert den Speicherbedarf der textlastigen JSON-Strukturen nativ um ca. 85–90%.
  * **Schnelle sequentielle I/O:** Das Laden und Schreiben eines zusammenhängenden Gzip-Streams ist auf SSDs extrem schnell.
* **Nachteile:**
  * **Keine granularen Abfragen:** Um nur die Fehler eines einzelnen Spiels auszulesen, muss die gesamte Datei dekomprimiert und im RAM geparst werden.
  * **Race Conditions:** Schreiben zwei Client-Sitzungen desselben Users gleichzeitig, droht Datenverlust (benötigt File-Locking).

#### Ansatz 2: Relationale Datenbank (PostgreSQL mit JSONB)
* **Wie genau?** Jede Endspiel-Partie wird als einzelner Zeileneintrag in einer Tabelle `user_endgame_analyses` gespeichert (Spalten: `user_id`, `game_id`, `analysis_data` [Typ: `JSONB`], `updated_at`). Large-Object TOAST-Kompression (LZ4/PGLZ) wird von Postgres automatisch im Hintergrund angewandt.
* **Vorteile:**
  * **Granulare Updates/Queries:** Einzelne Partien können gezielt hinzugefügt, aktualisiert oder gelöscht werden (wichtig für die inkrementelle Delta-Analyse).
  * **Transaktionssicherheit (ACID):** Parallele Schreibzugriffe werden sauber über Zeilensperren (Locks) aufgelöst.
  * **Flexible Queries:** Man kann direkt über SQL-Queries Statistiken über alle User-Analysen hinweg aggregieren.
* **Nachteile:**
  * **Infrastruktur-Overhead:** Erfordert Betrieb, Pflege und Backup eines PostgreSQL-Servers.
  * **Speicher-Overhead:** JSONB-Metadaten und Indizes verbrauchen signifikant mehr Speicherplatz als rohe `.gz`-Dateien.

