# Audit-Bericht: Migration von SQLite zu IndexedDB & System-Vereinfachung

## 1. Zusammenfassung des Ist-Zustands

Die aktuelle Implementierung nutzt SQLite (via WASM und OPFS) für den lokalen Cache von Eröffnungstheorie und Wiki-Inhalten. Alle anderen Daten (Settings, User-Profile, Trainingspläne) liegen bereits im **LocalStorage**. Die Nutzung von SQLite erfordert komplexe Infrastruktur-Anpassungen (COOP/COEP Header, Custom Vite-Plugins, WASM-Worker), die die Kompatibilität in "In-App Browsern" (Telegram, Facebook) einschränken können.

## 2. Analyse der Komponenten

### 2.1 DatabaseClient & Repositories

- **SQLite WASM**: Verursacht hohen Overhead beim Laden (ca. 1MB+ WASM-Binary).
- **Verwaiste Strukturen**: Tabellen für `studies`, `chapters` und `node_metadata` werden nicht mehr genutzt.
- **Komplexität**: `DatabaseClient.ts` verwaltet Locks und Worker-Kommunikation, was für einfache Key-Value Lookups überdimensioniert ist.

### 2.2 GlobalAssetLoader.vue

- **Funktion**: Initialisiert die DB und führt ein Pre-Caching von Sounds und Stockfish-Assets durch.
- **Bewertung**: Der Loader ist zu komplex. Die "Wärmephase" (warming) blockiert das UI unnötig lange.
- **Empfehlung**: Den Loader durch einen schlankeren, asynchronen Boot-Flow ersetzen. Die Sound-Assets können "lazy" oder im Hintergrund ohne UI-Blockade geladen werden.

### 2.3 Infrastruktur & Sicherheit

- **COOP/COEP Header**: In `security-headers.conf` und `nginx.conf` sind `same-origin` und `require-corp` zwingend für SQLite/OPFS gesetzt. Dies führt oft zu Problemen mit Cross-Origin Ressourcen (z.B. Lichess-Bilder oder Widgets).
- **Vite Config**: Enthält einen `sqlite-wasm-dev-server` und `viteStaticCopy` für WASM-Files. Diese machen die Build-Pipeline schwerfällig.

## 3. Ziel-Architektur (Option A: IndexedDB)

### 3.1 Datenbank-Layer

- **Tooling**: Einsatz von **Dexie.js** (~20kb gzipped) als Wrapper für IndexedDB.
- **Schema**:
  - `theory_cache`: `fen_key` (Primary Index), `source`, `data`, `expires`.
  - `wiki_cache`: `slug` (Primary Index), `content`, `timestamp`.
- **Migration**: Alle anderen Tabellen werden ersatzlos gestrichen. Bestehende Einstellungen im LocalStorage bleiben dort oder wandern (wie geplant) später ins Postgres-Backend.

### 3.2 System-Bereinigung

- **Entfernen**: `@sqlite.org/sqlite-wasm` aus `package.json`.
- **Sicherheit**: Die COOP/COEP Header können nach der Migration auf IndexedDB gelockert werden (Prüfung nötig, ob Stockfish-Multi-Thread sie noch braucht; Stockfish-Single-Thread braucht sie NICHT). Dies erhöht die Kompatibilität massiv.
- **Build**: Entfernen der SQLite-spezifischen Plugins aus `vite.config.ts`.
- **Nginx**: Vereinfachung der MIME-Typen für `.mjs` und Entfernen der speziellen WASM-Caching Regeln.

## 4. Fahrplan für die Umsetzung (Instruktionen für Nachfolger)

1.  **Phase 1: Database Replacement**
    - `Dexie.js` installieren.
    - `IndexedDbClient.ts` erstellen und das Minimal-Schema definieren.
    - `GlobalCacheRepository.ts` auf den neuen Client umstellen.
    - `DatabaseClient.ts` und `sqlite3-worker1.mjs` löschen.

2.  **Phase 2: App-Boot Flow**
    - `GlobalAssetLoader.vue` refaktoren: DB-Init asynchron ohne UI-Blockade (außer für absolut kritische Daten).
    - Prüfen, ob `isReady` State noch benötigt wird oder ob Vue-Query (`Suspense`) das Handling übernehmen kann.

3.  **Phase 3: Cleanup & Compatibility**
    - `package.json` bereinigen.
    - `vite.config.ts` aufräumen (Plugins & Static Copies entfernen).
    - `nginx.conf` und `security-headers.conf` anpassen (Header lockern, falls möglich).

4.  **Phase 4: Validierung**
    - Test in Telegram In-App Browser (Android/iOS).
    - Performance-Check: Ladezeit der App messen (Ziel: < 500ms bis zum interaktiven Zustand).

---

**Status: Migration erfolgreich abgeschlossen**
**Ergebnisse:**
- Migration von SQLite (OPFS/WASM) zu Dexie/IndexedDB erfolgreich durchgeführt.
- Hinderungsgrund in `src/app/main.ts` behoben (Kompatibilitäts-Checks angepasst, keine OPFS/SharedArrayBuffer-Blockaden mehr).
- Unbenutztes `SettingsRepository.ts` gelöscht und `App.vue` bereinigt.
- Kompatibilität in mobilen In-App-Browsern (z. B. Telegram/Facebook WebViews) auf ein Maximum gesteigert (COOP/COEP-Sicherheitsheader gelockert).
- Cache-Einstellungen in `CoachEngineManager.ts` verifiziert und bereinigt (DEFAULT_CACHE_SIZE = 2).
- Projekt-Build (`pnpm type-check && pnpm lint`) und alle Unit-Tests laufen fehlerfrei durch.
