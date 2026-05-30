Viewed visualizer.js:203-228

I will search for `PLAN_PLIES` in the frontend codebase to see if it is defined or referenced elsewhere.

Searched for "PLAN_PLIES"

I will search for occurrences of `principal_plan` in the frontend codebase to identify which modules consume this data structure.

Searched for "principal_plan"

I will view the `CoachPositionSummary.vue` file to see how it renders or interacts with the `principal_plan`.

Viewed CoachPositionSummary.vue:1-307

Die Länge des `principal_plan` und die Begrenzung hängen von folgenden Faktoren ab:

### 1. Wovon ist die Länge abhängig und wo wird sie begrenzt?

Die Begrenzung liegt in **[full-explanation.js](file:///home/umozer/projekte/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/full-explanation.js#L32)**:

```javascript
const PLAN_PLIES = 6 // walk the principal variation up to this many plies
```

Und im Loop der PV-Walks:

```javascript
for (let i = 0; i < Math.min(principalPv.length, PLAN_PLIES); i++) {
```

- **`PLAN_PLIES = 6`**: Dies schneidet die Engine-Variante (Principal Variation) standardmäßig bei maximal **6 Halbzügen (Plies)** (d.h. 3 vollen Zügen) ab.
- **Tatsächliche PV-Länge des Engines**: Wenn Stockfish für eine Stellung eine kürzere PV-Sequenz als 6 Halbzüge zurückgibt (z.B. 5 Halbzüge im Fall von `blob_example.json`), bricht die Schleife früher ab, da `principalPv.length` kleiner als `PLAN_PLIES` ist.

---

### 2. Können wir sie hypothetisch länger machen?

**Ja**, wir können den Wert von `PLAN_PLIES` in `full-explanation.js` beliebig erhöhen (z.B. auf `8` oder `10`).

---

### 3. Welche Module wären davon betroffen?

Wenn wir `PLAN_PLIES` erhöhen, hat das Auswirkungen auf folgende Module/Bereiche:

1. **`full-explanation.js` (Plan-Generierung & Performanz)**:
   - Die Schleife führt für jeden zusätzlichen Halbzug einen Aufruf von `analyzeMove()` (WASM/Rust) aus. Dies läuft extrem schnell, erfordert bei sehr langen PVs jedoch minimal mehr Rechenzeit.
   - `composePlanDescription` analysiert längere Pfade, um das Haupt-Manöver und das Thema zu ermitteln.
   - Die Liste der `keySquares` (Felder, die $\ge 2$-mal besucht werden) könnte durch den längeren Pfad wachsen.

2. **`visualizer.js` (Visualisierungs-Befehle)**:
   - **Maneuvers (`mapManeuvers`)**: Längere Pfade führen zu längeren und komplexeren Manöver-Linien (Pfeile mit mehreren Stationen).
   - **Tactics (`mapTactics`)**: Es werden nun auch taktische Motive visualisiert, die sich erst am Ende des längeren PV-Walks ergeben.
   - **Plan Sequence (`mapPlanSequence`)**: Der ermittelte `last_move` wandert weiter nach hinten (da er das Ende des PV-Walks repräsentiert).

3. **`CoachPositionSummary.vue` (UI)**:
   - Im Template unter "Detailed Plan" wird `plan.moves.map(m => m.san).join('  ')` ausgegeben. Ein längerer Plan führt dazu, dass dort mehr Züge (SAN-Notation) hintereinander dargestellt werden (ggf. Zeilenumbruch im UI).

4. **`coach.types.ts`**:
   - Die Schnittstellen-Typen (z. B. `principal_plan` mit einem Array von `moves`) müssen nicht geändert werden, da sie bereits dynamische Arrays verwenden.
