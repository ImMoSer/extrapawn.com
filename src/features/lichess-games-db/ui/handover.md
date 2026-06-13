# Handover: Lichess Games Database Statistics Rendering

Dieses Dokument beschreibt den finalen, präzisen Plan zur Integration der Spieldatenbank-Statistiken im User Cabinet. Der Fokus liegt rein auf dem **Statistik-Rendering** unter Verwendung von IndexedDB-Daten.

---

## 1. UI-Aufteilung & Layout

* **User Cabinet Layout (`UserCabinetView.vue`):**
  * Änderung des Spalten-Layouts auf ein ausgeglichenes **50 / 50 Grid** (`grid-template-columns: 1fr 1fr`).
* **Aufteilung der rechten Spalte in zwei Komponenten:**
  1. `LichessGamesStatistics.vue` (Neu): Übernimmt die erweiterte Visualisierung der Spielstatistiken.
  2. `LichessGamesCacheSettings.vue`: Behält exklusiv das Action-Panel (Synchronisierung, Export, Import, Cache leeren) und die Benutzerstatus-Anzeige.

---

## 2. Struktur des neuen Statistik-Dashboards (`LichessGamesStatistics.vue`)

Das neue Element zeigt drei Tabs: **ALL**, **WHITE** und **BLACK**.

In jedem dieser Tabs werden folgende Metriken dargestellt:

### A. WDL-Performance-Tabelle nach Zeitkontrollen
Eine Tabelle/Liste mit 4 Zeilen für die Modi **Bullet**, **Blitz**, **Rapid** und **Classical**.
Jede Zeile enthält:
* Modus-Name (z. B. "Blitz"), Spieleanzahl und durchschnittliches Rating des Users.
* Einen dreigeteilten, farbigen Balken (Grün / Grau / Rot), der das Verhältnis von Siegen (W), Remis (D) und Niederlagen (L) in Prozent darstellt.

### B. Top 5 Eröffnungen (Rose Chart)
Ein ECharts **Rose Chart** (`roseType: 'radius'`) analog zum `ThemeRoseChart.vue` mit 5 Segmenten (für die Top 5 Eröffnungen).
* Beim Klicken auf ein Segment öffnet sich ein **Popup-Fenster** (Teleportiert in den Body) mit folgenden Details:
  * Name der Eröffnung (z. B. "French Defense")
  * Spieleanzahl (Total games)
  * Siege (Win), Remis (Draw) und Niederlagen (Loss)
  * Siegesrate (WinRate) in %
  * **Performance (TPR):** Berechnet auf Basis des durchschnittlichen Gegner-Ratings und der Erfolgsquote.

---

## 3. Berechnungen im Store (`lichess-games-db.store.ts`)

Wir erweitern `loadStats` im Pinia-Store, um ein reaktives `detailedStats` Objekt mit den Aggregationen für alle drei Tabs (`all`, `white`, `black`) zu befüllen.

### Performance-Berechnungsformel (TPR):
Für die Leistungsbewertung (Performance) einer Eröffnung wird das durchschnittliche Gegner-Rating mit dem Score-Faktor (Siege + 0,5 * Remis) / Gesamtspiele verrechnet:
* **Erfolgsquote $P$:** `(wins + 0.5 * draws) / gamesCount`
* **Rating-Differenz $D$:**
  * Wenn $P = 1.0 \Rightarrow D = +400$
  * Wenn $P = 0.0 \Rightarrow D = -400$
  * Sonst (lineare FIDE-Approximation) $\Rightarrow D = (P - 0.5) \cdot 800$
* **Performance Rating:** `avgOpponentRating + D`

---

## 4. Styling & Ästhetik

* **Stil:** Glassmorphic Dark-Gaming-Style, angelehnt an `TaskTodayDashboard.vue`.
* **Farben:**
  * Grün: `#18a058` (Siege)
  * Grau: `rgba(255, 255, 255, 0.2)` (Remis)
  * Rot: `#d03050` (Niederlagen)
