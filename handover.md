# 📋 HANDOVER & ARCHITECTURAL ROADMAP: PINIA STORE REFACTORING

---

## 🎯 Контекст и Прогресс Сессии

В этой сессии проведена масштабная очистка архитектуры Pinia-сторов в проекте `chess_frontend`.
Исходное количество сторов: **24**.
Текущее количество сторов: **17** *(сокращено на 7 сторов)*.

### 📜 Что уже выполнено:
1. **Полное удаление `demoplayStore`**:
   - Полностью вырезаны все `demo*` задержки, UI-компоненты демо-режима и серверные свойства.
2. **Очистка базы дебютов и Lichess Explorer**:
   - Удалены `theoryStore`, `mozerBookStore`, `LichessApiService`, `TheoryRepository`, таблица IndexedDB `theory_cache`.
   - `MozerBook.vue` переведен на прямой `mozerBookService.fetchStats()`.
3. **Объединение сторов анализа**:
   - `analysisEngineStore` и `analysisStore` консолидированы в единый `useAnalysisStore` в `features/analysis`.
4. **Миграция выбора движка (бота)**:
   - `engineSelectionStore` удален. Состояние выбора движка перенесено в `preferencesStore` с синхронизацией на Fastify backend (`/users/me/preferences`).
5. **Консолидация сторов ИИ-Тренера**:
   - `coachFeedbackStore` и `coachOrchestratorStore` полностью слиты с `coachStore` (`src/features/coach/model/coach.store.ts`).
   - Удалены зацикленные зависимости в `features/coach`.

---

## 🚀 Задача и Интент на Следующую Сессию

В следующей сессии необходимо проанализировать главный игровой кластер из **6 сторов** (как отдельно каждого, так и с высоты птичьего полёта — Birds-Eye View):

1. ♟️ **`coachStore`** (`src/features/coach/model/coach.store.ts`) — единый стор ИИ-тренера (анализ, фидбек, оркестрация ходов).
2. ♟️ **`boardStore`** (`src/entities/game/model/board.store.ts`) — визуальное состояние шахматной доски (Chessground, FEN, подсветка, NAG).
3. ♟️ **`gameStore`** (`src/entities/game/model/game.store.ts`) — фазы игры (`PLAYING`, `PAUSED`, `FINISHED`) и текущая активная стратегия (`SparringStrategy`, `PuzzleStrategy`).
4. 🎯 **`taskTodayStore`** (`src/features/task-today/model/task-today.store.ts`) — дневной план тренировок пользователя.
5. ⚔️ **`sparringStore`** (`src/features/sparring/model/sparring.store.ts`) — режим спарринга с AI-ботами.
6. 🧩 **`puzzleStore`** (`src/features/puzzle/model/puzzle.store.ts`) — режим решения шахматных задач/пазлов.

---

## 🔍 Вопросы для анализа в следующей сессии (Birds-Eye View):

- **Взаимодействие Entities vs Features**: `boardStore` и `gameStore` находятся в `entities/game`, а `sparringStore`, `puzzleStore`, `taskTodayStore` и `coachStore` — в слоя `features`. Нарушаются ли границы FSD?
- **Дублирование состояния ходов и FEN**: Кто является первоисточником истины для текущей позиции (`boardStore.fen` vs `gameStore` vs `coachStore.fen`)?
- **Паттерн Стратегий**: Как `gameStore.currentStrategy` связывает режимы (`sparringStore` / `puzzleStore`) с проведением ходов на доске и оркестрацией тренера?
- **Потенциал консолидации**: Можно ли упростить или устранить лишнее проксирование состояния между режимами тренировок и `gameStore`?

---

## ⚠️ Строгие Правила Проекта (Mandatory Directives)

1. **Zero Quick Fixes Policy (Architectural Veto)**: Категорический запрет на симптоматические костыли, "быстрые фиксы" и дублирование логики. Если чистый архитектурный путь требует рефакторинга — объявлять Architectural Veto и предлагать системное решение.
2. **Языковой регламент**: Вся коммуникация, отчеты, plans и walkthroughs **СТРОГО на русском или немецком языке**. Английский запрещен.
3. **Mandatory Confirmation Protocol**: В самом первом сообщении новой сессии **ОБЯЗАТЕЛЬНО явно подтвердить** знание правил "Zero Quick Fixes Policy" и согласие строго следовать им.
4. **Валидация**: Каждое изменение должно проверяться через `pnpm type-check` (0 ошибок) и `pnpm lint` (0 предупреждений/ошибок).
