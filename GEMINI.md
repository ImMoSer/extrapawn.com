# GEMINI.md - Entwicklungsrichtlinien

1. **Qualität und Nachhaltigkeit vor Geschwindigkeit**: Nutzung von Feature-Sliced Design (Entities dürfen keine Features importieren). Code muss Production-Grade sein. Absolute Sperre für Quick & Dirty Fixes!
2. **Strikte Typisierung**: Vermeiden von `"warning Unexpected any"`. Immer einen spezifischen Typen definieren (`@typescript-eslint/no-explicit-any`).
3. **Freigabe-Prozess (Workflow Control)**: Wenn die Nachricht mit **"NOK"** endet, bedeutet das: Kein Code und keine Modifikationen im nächsten Schritt. Modifikationen und Code-Generierung werden ausschließlich mit einem **"OK"** freigegeben.
4. **Validierung**: Sicherstellen, dass die Prüfungen `pnpm type-check` und `pnpm lint` ohne Fehler und Warnungen durchlaufen.
5. **Technische Schulden**: Technische Schulden, Altlasten oder Architektur-Verstöße im bestehenden Code müssen sofort gemeldet werden.
6. **Striktes Fail-Fast-Prinzip**: Keine defensiven Fallbacks, automatischen Typ-Konvertierungen, Standardwerte (Fallback-Values) oder stillschweigenden Fehlerkorrekturen bei unerwarteten, unvollständigen oder unklaren Datenzuständen einbauen. Jede Abweichung vom erwarteten Zustand muss sofort hart per Exception oder Error-Log fehlschlagen, damit Fehler direkt in der Entwicklung sichtbar und behoben werden.
7. **Design System & Strikte Farbpalette (`DESIGN.md` / `main.css`)**: Es ist strengstens verboten, Farben frei zu erfinden oder im Code inline zu hardcoden (z. B. Hex-Codes wie `#00ff55` oder `rgba(0, 255, 85, 0.12)`). Alle Farben MÜSSEN aus der festgelegten Farbpalette (`DESIGN.md` / `main.css`) als CSS-Variablen (z. B. `var(--color-success)`, `color-mix(...)`) oder entsprechende Tailwind-Theme-Klassen bezogen werden.

## Bekannte Paket-Blocker / Version Locks

- **TypeScript**: Gesperrt auf Version `6.x` (aktuell `6.0.3`). TypeScript `v7.0.2` führt ein restriktives `exports`-Mapping in seiner `package.json` ein, wodurch `typescript/lib/tsc` nicht mehr exportiert wird. Da `vue-tsc` dieses intern laden muss, führt das Update zu einem Absturz (`ERR_PACKAGE_PATH_NOT_EXPORTED`). Ein Upgrade auf TS 7+ ist erst möglich, wenn eine neuere Version von `vue-tsc` veröffentlicht wird, die mit dem neuen TS-Export-Schema kompatibel ist.
