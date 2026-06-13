# Lokalisierungs-Richtlinien (Locales Rules)

Um Wildwuchs und hardcodierte Labels zu vermeiden, folgen die Übersetzungs-Schlüssel der **Feature-Sliced Design (FSD)**-Architektur.

## 1. Grundstruktur

Die JSON-Dateien (`en.json`, `de.json`, `ru.json`) sind in folgende Top-Level-Bereiche unterteilt:

*   `seo` - SEO-Metadaten für Pages (bleiben unverändert).
*   `legal` - Rechtliche Texte, Impressum, AGB (bleiben unverändert).
*   `about` - Über uns, Projekt-Philosophie (bleiben unverändert).
*   `puzzleCategories` - Alle Schach- und Puzzle-Kategorien, Themen, Taktiken, Schwierigkeitsgrade und Typen.
*   `pages` - Seitenspezifische Übersetzungen (z. B. `welcome`, `userCabinet`, `pricing`, `bonus`).
*   `features` - Featurespezifische Übersetzungen (z. B. `settings`, `leaderboards`, `taskToday`, `coach`).
*   `shared` - Globale, wiederverwendbare UI-Elemente, Schaltflächen, Fehler und Navigation.

---

## 2. Benennungsregeln (Naming Conventions)

*   **CamelCase**: Alle Schlüssel verwenden `camelCase`.
*   **Keine generischen Schlüssel**: Schlüssel wie `common.*` vermeiden. Stattdessen `shared.buttons.*` oder `shared.errors.*` verwenden.
*   **Eindeutige Zuordnung**: Wenn ein Label nur auf einer Seite vorkommt, gehört es unter `pages.<pageName>.<key>`. Wenn es in einem wiederverwendbaren Feature vorkommt, unter `features.<featureName>.<key>`.
*   **Keine Hardcodierung**: Es dürfen keine UI-Texte im Code hardcodiert werden. Jeder benutzerseitige Text muss über `$t('...')` geladen werden.

---

## 3. Struktur-Template

```json
{
  "seo": { ... },
  "legal": { ... },
  "about": { ... },
  "puzzleCategories": {
    "themes": {},
    "subThemes": {},
    "tactics": {},
    "difficulties": {},
    "types": {}
  },
  "pages": {
    "welcome": {},
    "userCabinet": {},
    "pricing": {},
    "bonus": {},
    "puzzle": {},
    "recordsPage": {},
    "login": {}
  },
  "features": {
    "lichessGamesDb": {},
    "coach": {},
    "leaderboards": {},
    "taskToday": {},
    "settings": {},
    "autoplay": {},
    "analysis": {},
    "engine": {},
    "profile": {}
  },
  "shared": {
    "nav": {},
    "errors": {},
    "buttons": {},
    "board": {},
    "app": {},
    "gameModes": {}
  }
}
```
