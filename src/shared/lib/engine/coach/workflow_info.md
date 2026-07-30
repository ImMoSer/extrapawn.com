#Архитектура и Синтез Данных Модуля Coach Engine (`shared/lib/engine/coach`)

Данный документ содержит исчерпывающее техническое описание архитектуры, потока данных и механизмов синтеза аналитической информации в шахматном движке тренера (Coach Engine). Документ предназначен для быстрой ориентации разработчиков и AI-агентов без необходимости повторного исследования кодовой базы.

---

## 1. Общая Архитектура и Назначение Папки

Папка `src/shared/lib/engine/coach/` — это центральный гибридный аналитический комплекс, сочетающий:
1. **Динамический вариантный анализ (Engine Layer)**: Расчет кандидатских ходов, оценки (cp / mate) и вариантов (PV) через серверный микросервис в Docker (Stockfish).
2. **Статический позиционный и тактический анализ (Rust WASM Layer)**: Высокоскоростной мгновенный разбор геометрии доски, пешечных структур, мотивов ходов и битовых оценок на Rust/WASM.
3. **Синтез и генерацию планов (Synthesis Layer)**: Объединение вариантов движка со статическими мотивами, генерация цепочек планов, текстовых описаний и отладочных источников (`_input_sources`).
4. **Визуализацию и логирование (Visualizer Layer)**: Перевод синтезированных фактов в визуальные команды Chessground (стрелки, подсветка) и структуру `_logs` / `_input_sources` для консоли отладки (`VisualizerConsole.vue`).

---

## 2. Схема Движения Данных (Data Flow)

```
[ Server Engine (Docker Microservice) ]       [ Rust WASM Analyzer (wasm-rs) ]
   POST /multi_eval (/analyze)                   explainPosition(fen) / analyzeMove(fen, uci)
   Returns JSON: structured_moves                         │
                 │                                        │
                 ▼                                        ▼
      [ remote-engine.js ]                         [ analyzer-rs.js ]
  mapRemoteResponseToEngineFormat()                      │
                 │                                        │
                 └───────────────────┬────────────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    full-explanation.js      │
                      │  (buildFullExplanation)     │
                      └──────────────┬──────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │       visualizer.js         │
                      │  (generateVisualCommands)   │
                      └──────────────┬──────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    VisualizerConsole.vue    │
                      │  (copyData / UI Console)    │
                      └─────────────────────────────┘
```

---

## 3. Реестр Модулей и Их Ответственность

| Модуль | Роль и Основные Функции |
| :--- | :--- |
| **[CoachEngineManager.ts](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/CoachEngineManager.ts)** | **Точка входа для UI**: Инициализирует Stockfish Worker и WASM, управляет кэшированием вызовов `getExplanation(fen, options)`. |
| **[full-explanation.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/full-explanation.js)** | **Главный центр синтеза**: Метод `buildFullExplanation(fen, opts)` принимает ответ сервера и WASM, прошагивает вариант `pv`, классифицирует характеры ходов (`classifyCharacter`), генерирует тему и описание плана (`composePlanDescription`), согласует оценки `eval_cp` и вердикты `verdict`. |
| **[remote-engine.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/remote-engine.js)** | **Коннектор к серверному движку**: Отправляет HTTP POST запросы на эндпоинты `/multi_eval`, `/single_eval` или `/analyze` (порты 5004). Функция `mapRemoteResponseToEngineFormat` преобразует массив `structured_moves` в стандартный фронтенд-формат. |
| **[analyzer-rs.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/analyzer-rs.js)** & **`wasm-rs/`** | **Высокоскоростной Rust WASM ядерный модуль**: Содержит `explainPosition` (позиционная оценка HCE, пешки, слабости полей, короли) и `analyzeMove` (тактические мотивы: шахи, вилки, связки, жертвы, подбои). |
| **[explainer.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/explainer.js)** | **Анализатор сыгранного хода**: Функция `explainMove(fenBefore, fenAfter, moveUCI)` вычисляет потерю шансов на победу `winRateLoss` по сигмоиде Lichess, присваивает качество хода (`blunder`, `mistake`, `inaccuracy`, `best`, `brilliant`), находит причины ошибки и формирует текст для секции `Last Move Analysis`. |
| **[taglines.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/taglines.js)** | **Генератор фразовых тегов**: Запрашивает мотивы у WASM или использует Pure-JS fallback на базе `chess.js` для создания коротких заголовков (`Headline`), например: `"Centralizes the knight"`, `"Establishes an outpost on d5"`. |
| **[visualizer.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/visualizer.js)** | **Визуализатор и сборщик отладки**: Переводит факты в графические элементы доски, а также формирует структурированный объект `_input_sources` и массив `_logs`, прикрепляемые к `posExplanation.visual_commands`. |
| **[heatmap.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/heatmap.js)** | **Анализатор тепловых карт**: Вычисляет статическую ценность полей и вклады фигур в оценку позиции (`getPieceValues`, `streamDestinationValues`) для визуального слоя активности. |
| **[fact-extractor.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/fact-extractor.js)** | **Экстрактор фактов**: Преобразует сложный объект `explanation` в чистый массив человекочитаемых фактов (`extractConcreteFacts`) с приоритетами `importance` для UI и LLM-промптов. |
| **[connectors.js](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/connectors.js)** | **Сравнительный модуль изменений**: Выявляет последствия ходов (например, появлении подвисших фигур `hanging_pieces`, ухудшении безопасности короля) при сравнении позиций "До" и "После". |
| **[chess.ts](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/chess.ts)** | **Шахматная геометрия и правила**: Модуль-обертка для манипуляций FEN, генерации ходов, перевода UCI $\leftrightarrow$ SAN и проверки легальности ходов. |
| **[coach.types.ts](file:///c:/APPS/CHESS_APP/chess_frontend/src/shared/lib/engine/coach/coach.types.ts)** | **Типизация TypeScript**: Содержит интерфейсы `CoachExplanation`, `VisualizerInputSources`, `CoachLastMoveAnalysis`, `VisualizerLogItem`. |

---

## 4. Детальный Разбор Выхода Консоли (`VisualizerConsole.vue`)

Текст, выводимый по кнопке "Copy Data" в `VisualizerConsole.vue`, формируется на основе свойства `posExplanation.visual_commands._input_sources`. Ниже приведён детальный разбор происхождения каждого блока.

```text
=== Visualizer Output Commands (0 items) ===
No visualizer commands generated for this position.

=== Visualizer Input Sources ===
FEN: Q4rk1/p1qn1ppp/2p2n2/1N1p1b2/3P4/5NP1/PP2PP1P/2R1KB1R b K - 3 13
Attacking Side: black
```

---

### Блок 1: `--- Position Summary ---`
```text
Eval: -7.22
Phase: middlegame
Verdict: Black is clearly winning (+7.2)
Material: Material is off for White (+6.0)
```
* **Eval (-7.22)**: Из `engineRes.score` (Stockfish Multi-PV), нормализованного к White-POV (`staticBlob.eval_pawns = whitePovScore / 100`) в `full-explanation.js`.
* **Phase (middlegame)**: Оценивается в Rust WASM HCE по количеству не-пешечного материала на доске.
* **Verdict (Black is clearly winning (+7.2))**: Функция `formatVerdictString(evalCp, mate)` в `full-explanation.js`. Преобразует cp в категорию (свыше $\pm 500\,\text{cp} \rightarrow$ *clearly winning*).
* **Material**: Сформировано в `explainPosition` в Rust WASM и проброшено через `blob.material.summary`.

---

### Блок 2: `--- Last Move Analysis ---`
```text
Move: Nb5 (c3b5) [blunder]
Win Rate Loss: 69.08%
Best Move: Nxd5
Summary: A blunder. This loses significant advantage.
Details: Forks the opponent's pawn and queen. Sacrifices the knight for tactical compensation.
Consequence: Leaves White's knight on b5 hanging
```
* **Move & Quality**: Ход из истории (`uci = c3b5`, `san = Nb5`). Качество `[blunder]` вычислено в `classifyMove()` в `explainer.js` по падению шансов или потере выигрыша (`lostWin`).
* **Win Rate Loss (69.08%)**: Рассчитывается в `explainer.js` через сигмоиду Lichess:
  $$\text{WinRate}(cp) = \frac{100}{1 + e^{-0.00368208 \cdot cp}}$$
  $$\text{Loss} = \text{WinRate}(\text{BestMove}) - \text{WinRate}(\text{PlayedMove})$$
* **Best Move (Nxd5)**: `uciToSanSafe(fenBefore, bestMoveUCI)` на первом кандидате Stockfish до сделанного хода.
* **Summary**: Готовая строка из словаря `summaries[quality]` в `explainer.js`.
* **Details**: Склейка результатов работы детекторов в `explainer.js`:
  * `detectFork(...)` $\rightarrow$ *"Forks the opponent's pawn and queen"*
  * `detectSacrificeViaSEE(...)` $\rightarrow$ *"Sacrifices the knight for tactical compensation"*
* **Consequence**: Сгенерировано модулем `connectors.js`, сличившим FEN "до" и "после", зафиксировав появление подвисшего коня на `b5`.

---

### Блок 3: `--- Principal Plan Overview & Plan Steps ---`
```text
--- Principal Plan Overview ---
Theme: kingside_attack_black
Description: Black keeps pressing the white king with a sequence of attacking moves.

--- Plan Steps (5) ---
  1. Qa5+ | Headline: Gives check | Motifs: check, fork
  2. Nd2 | Headline: Threatens back-rank mate | Motifs: back_rank_mate_threat
  3. Rxa8 | Headline: Captures the queen | Motifs: capture, defends, restricts
  4. Nd6 | Headline: Wins the bishop | Motifs: threatens, attacks_king, knight_invasion, activates
  5. Bg4 | Headline: Bishop on g4 now attacks e2 (next to the king) | Motifs: attacks_king, activates
```
* **Theme (`kingside_attack_black`)**: Вычисляется в `full-explanation.js` путем подсчета частоты мотивов (`motifFreq`) на протяжении 5 шагов варианта.
* **Description**: Функция `composePlanDescription(...)` в `full-explanation.js`. При теме `kingside_attack` генерирует на естественном языке фразу по шаблону:
  ```javascript
  return `${sideCap} keeps pressing the ${oppCap.toLowerCase()} king with a sequence of attacking moves.`;
  ```
* **Plan Steps (1–5)**:
  * В `full-explanation.js` берутся первые 5 полуходов из `engineRes.moves[0].pv` (например `["c7a5", "f3d2", "f8a8", "b5d6", "f5g4"]`).
  * Для каждого полухода вызывается **Rust WASM `analyzeMove(curFen, uci)`**:
    * `san` $\rightarrow$ `Qa5+`, `Nd2`, `Rxa8`...
    * `Headline` $\rightarrow$ фраза из `result.motifs[0].phrase`
    * `Motifs` $\rightarrow$ массив мотивов (`check`, `fork`, `back_rank_mate_threat`...).

---

### Блок 4: `--- Pawn Structure ---`
```text
Summary: Black isolated: a7
Dark Squares Weak: white
Passed Pawns: None
Weak Pawns: a7
Isolated Pawns: White: None | Black: a7
Backward Pawns: White: None | Black: c6
```
* Все данные вычисляются битовым анализатором **Rust WASM** в методе `explainPosition(fen)` и упаковываются в объект `blob.pawn_structure`.

---

### Блок 5: `--- Strategic Themes ---`
```text
--- Strategic Themes (6) ---
  1. [material_edge] (white, strength: 100): White is up 6.0 pawns of material
  2. [dark_complex] (black, strength: 50): White's dark squares are weak (no dark-squared bishop, ≥3 pawns on dark squares)
  3. [hanging_pieces] (black, strength: 100): White has hanging material: knight on b5, queen on a8
  4. [hanging_pieces] (white, strength: 100): Black has hanging material: pawn on c6, pawn on a7, queen on c7
  5. [leading_factor] (white, strength: 100): Leading factor: Black has hanging material: pawn on c6, pawn on a7, queen on c7
  6. [engine_plan] (black, strength: 60): Black keeps pressing the white king with a sequence of attacking moves.
```
* **Темы 1–5 (`material_edge`, `dark_complex`, `hanging_pieces`, `leading_factor`)**: Рассчитываются статической оценкой в **Rust WASM** (`explainPosition`).
* **Тема 6 (`engine_plan`)**: Добавляется в **`full-explanation.js`** поверх статического списка тем:
  ```javascript
  if (planTheme) {
    staticBlob.themes.push({
      id: 'engine_plan',
      side: attackingSide,
      strength: 60,
      description: staticBlob.principal_plan.description,
    });
  }
  ```

---

### Блок 6: `--- Candidate Engine Moves ---`
```text
--- Candidate Engine Moves (3) ---
  1. Qa5+ (Eval: +7.22) [Combative] | Headline: Gives check | Brief: Builds Black's attack on the enemy king | Motifs: check, fork
  2. Qb6 (Eval: -5.87) [Quiet] | Brief: Builds Black's attack on the enemy king
  3. Rxa8 (Eval: -6.30) [Solid] | Headline: Captures the queen | Brief: Improves piece activity — better squares for Black's pieces | Motifs: capture, defends, restricts
```
* **Происхождение данных**: В `full-explanation.js` массиву `engineRes.moves` (из ответа сервера) сопоставляется вызов WASM `analyzeMove`.
* **[Character]**: Вычисляется функцией `classifyCharacter(motifIds, m, idx, moves)` в `full-explanation.js`:
  * `[Combative]` — есть острая тактическая угроза (`fork`, `pin`, `skewer`).
  * `[Solid]` — консолидация, развитие или защита (`defends`, `castles`).
  * `[Quiet]` — тихий шаг без явных тактических/структурных мотивов.
* **Brief**: Вычисляется функцией `inferPlanBrief(...)` в `full-explanation.js`. Прошагивает вариант `pv` конкретного кандидата и определяет главную направленность серии ходов (например, `kingside_attack` $\rightarrow$ *"Builds Black's attack on the enemy king"*, `piece_activity` $\rightarrow$ *"Improves piece activity..."*).
* **Headline / Motifs**: Извлекаются из ответа Rust WASM `analyzeMove`.

---

## 5. Важные Практические Замечания

1. **Производительность**: Статический разбор в Rust WASM (`explainPosition` / `analyzeMove`) занимает менее **1 мс**. Основная задержка приходится на сетевой запрос к Docker-микросервису Stockfish.
2. **Согласование оценок**: Stockfish возвращает оценку относительно ходящей стороны (STM-POV). В `full-explanation.js` оценка строго переводится в White-POV для устранения рассинхрона между Eval Bar и текстовым вердиктом.
3. **Совместимость компонентов**: Все структуры и типы синхронизированы в интерфейсе `CoachExplanation` (`coach.types.ts`). Любые изменения в полях `full-explanation.js` должны отражаться в этом файле типов.
