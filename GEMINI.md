# GEMINI.md - Entwicklungsrichtlinien

1. **Qualität und Nachhaltigkeit vor Geschwindigkeit**: Nutzung von Feature-Sliced Design (Entities dürfen keine Features importieren). Code muss Production-Grade sein. Absolute Sperre für Quick & Dirty Fixes!
2. **Strikte Typisierung**: Vermeiden von `"warning Unexpected any"`. Immer einen spezifischen Typen definieren (`@typescript-eslint/no-explicit-any`).
3. **Freigabe-Prozess (Workflow Control)**: Wenn die Nachricht mit **"NOK"** endet, bedeutet das: Kein Code und keine Modifikationen im nächsten Schritt. Modifikationen und Code-Generierung werden ausschließlich mit einem **"OK"** freigegeben.
4. **Validierung**: Sicherstellen, dass die Prüfungen `pnpm type-check && pnpm lint` ohne Fehler und Warnungen durchlaufen.
5. **Technische Schulden**: Technische Schulden, Altlasten oder Architektur-Verstöße im bestehenden Code müssen sofort gemeldet werden.
6. **Striktes Fail-Fast-Prinzip**: Keine defensiven Fallbacks, automatischen Typ-Konvertierungen, Standardwerte (Fallback-Values) oder stillschweigenden Fehlerkorrekturen bei unerwarteten, unvollständigen oder unklaren Datenzuständen einbauen. Jede Abweichung vom erwarteten Zustand muss sofort hart per Exception oder Error-Log fehlschlagen, damit Fehler direkt in der Entwicklung sichtbar und behoben werden.
