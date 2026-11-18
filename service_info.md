# `service_info.md` — Архитектура и Правила Сервиса `app_vue`

> **Назначение:** Основное клиентское веб-приложение платформы **ExtraPawn** (`extrapawn.com`) на Vue 3 + Vite + Pinia + Tailwind CSS v4 + Naive UI + Chessground + ECharts, а также умный продакшен-маршрутизатор **Nginx** (`nginx.conf`).  
> **Глобальные стандарты:** [`GEMINI.md`](file:///c:/MY_APPS/CHESS_APP/GEMINI.md) · [`css_info.md`](file:///c:/MY_APPS/CHESS_APP/css_info.md) · [`project_info.md`](file:///c:/MY_APPS/CHESS_APP/project_info.md)

---

## 1. Строгая архитектура Feature-Sliced Design (`src/`)

Импорты разрешены **строго сверху вниз** (`app` → `pages` → `widgets` → `features` → `entities` → `shared`). Обратные импорты (например, `entities` → `features`) категорически запрещены.

- **`src/app/`** — инициализация приложения, роутера, Pinia, Naive UI провайдеров темы (`App.vue`, `LoginApp.vue`) и фонового контроля релизов (`AppUpdateNotifier.vue` / `useVersionUpdate.ts`: опрашивает `/version.json`, выводит модалку обновления без удаления `extrapawn-stockfish-wasm-*` из `Cache Storage`; сама версия `YY.MM.DD-HHMM` в `package.json` проставляется автоматически при каждом `git commit` через `.githooks/pre-commit` → `scripts/bump-version.mjs`).
- **`src/pages/`** — маршрутные экраны:
  - `training-center` (`/training`, `/warmup`), `courses` (`/courses`), `user-cabinet` (`/user-cabinet`), `course-diploma` (`/kursdiplom/:courseId` — публичный диплом без авторизации), `analysis`, `club-player`, `welcome`, `about`, `pricing`, `legal`.
- **`src/widgets/`** — композиционные раскладки экрана:
  - `game-layout/ui/GameLayout.vue` и `ControlCenter.vue` — адаптивный трёхколоночный игровой экран с шахматной доской, верхней инфо-полоской и боковой панелью.
- **`src/features/`** — бизнес-сценарии пользователя:
  - `training-session` — модульная подсистема Тренировочного Центра, Разминки и Классических курсов:
    - `model/`: компактный Pinia-фасад `trainingSession.store.ts` (`~360` строк) + модули единой ответственности `trainingSession.types.ts`, `usePuzzleClock.ts`, `buildSessionReport.ts`, `useHubAndCurriculumActions.ts`, `useGameplayLifecycle.ts`, `useAttemptControls.ts`, `useInspectionAndReplay.ts`, `useCrashTestActions.ts` (каждый строго `< 500` строк).
    - `lib/`: `sessionItemPolicy.ts` (неограниченное число попыток `Restart` до победы или явного `Resign` с обязательной отправкой повторных попыток в Дятла, блокировка анализа `pending`-задач, `Practice Replay`), `sessionPuzzleAdapter.ts`, `buildAutomatCallbacks.ts`, `crashTestReportLogger.ts`.
    - `ui/`: `TrainingHubDashboard.vue` + дочерние секции `TrainingSprintCourseSection.vue` и `TrainingWarmupConfigurator.vue`, а также `TacticsCourseCurriculumView.vue`, `TrainingSessionSidebar.vue`, `TrainingPlayTopInfo.vue`, `EndgameAutomatOverlay.vue`, `TrainingSessionReport.vue`.
  - `profile` — диагностические виджеты и матрицы Кабинета 2.0 (`ECharts`).
  - `coach` — серверный ИИ-тренер (`coach.store.ts`, визуальные команды доски `mark / route / arrow`) и контроллер краштеста (`crashtest.store.ts`).
  - `analysis` — локальный движковый анализ в браузере (`analysis.store.ts`, `MultiPV`).
  - `settings` — меню настроек (`SettingsMenu.vue`, `SettingsBoardPiecesSection.vue`), выбор языка, модалка юридического согласия (`LegalConsentModal.vue`).
- **`src/entities/`** — чистые бизнес-сущности:
  - `game` — `game.store.ts`, `board.store.ts`, `PuzzleStrategy.ts` + `puzzle.types.ts` (`scenarioOnly`, `playOutOnly`, `scenarioPlus`, ничьи по 4 правилам ФИДЕ), `EndgameAutomatController.ts` + `lib/endgameAutomatRules.ts`, `EndgameHopelessController.ts` + `lib/endgameHopelessRules.ts`, `WebChessBoard.vue`, `PgnTree.vue`.
  - `training` — типизированный API-клиент `training.api.ts`, DTO и таксономия `training.types.ts`.
  - `user` — `auth.store.ts` (Lichess OAuth2 сессия), `preferences.store.ts`.
  - `engine` — клиент спарринг-движков `enginePlay.service.ts`.
- **`src/shared/`** — переиспользуемое ядро:
  - `theme/` — реактивные токены Dark/Light (`tokens.ts`, `naive-overrides.ts`),
  - `lib/pgn/` (`PgnService.ts`), `lib/engine/` (`LocalEngineManager.ts`, `engine.loader.ts`, `wasmCache.ts` — персистентное хранение `stockfish-19-single.wasm` `99.2 МБ` в браузерном `Cache Storage API` с валидацией WASM-заголовка `\0asm`, прогрессом загрузки и передачей disk-backed `Blob URL` в Web Worker без повторного скачивания при перезагрузке ПК или смене Lichess-аккаунта),
  - `config/` (`i18n` и автотест целостности словарей `src/shared/config/__tests__/i18n.spec.ts`).

---

## 2. Инварианты надёжности, памяти и UI

1. **Защита от гонок асинхронных запросов:**
   - `game.store.ts`: монотонный `gameSessionToken` отсекает запоздавшие ходы бота при рестарте задачи или переключении позиции.
   - `coach.store.ts`: `AbortController` (`abortInFlightAnalysis()`) отменяет незавершённые запросы к `stockfish_server`.
   - `PgnService.ts`: `disposeTree()` при `reset()` разрывает ссылки дерева ходов.
2. **Дизайн и локализация (`DE / EN / RU`):**
   - Строгое соблюдение [`css_info.md`](file:///c:/MY_APPS/CHESS_APP/css_info.md): нулевой хардкод цветов, `font-condensed` для нотации и цифр, короткие глагольные кнопки (`<= 14–16` символов) с защитой `min-w-0` + `truncate`.
   - Стопроцентный паритет ключей и отсутствие пустых строк (`""`) между [`de.json`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/locales/de.json), [`en.json`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/locales/en.json) и [`ru.json`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/locales/ru.json), контролируемый unit-тестом `i18n.spec.ts`.
3. **Опциональный «Автомат» и перехват безнадёжных `<= 5`-фигурных эндшпилей (`Gaviota-Only`):** в фазе доигрывания на победу (`isPlayoutMode`, `objective === 'win'`, ход игрока) контроллер [`EndgameAutomatController.ts`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/entities/game/model/EndgameAutomatController.ts) проверяет универсальное условие [`endgameAutomatRules.ts`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/entities/game/lib/endgameAutomatRules.ts): на доске `<= 5` фигур, у бота строго одинокий король, у игрока есть хотя бы одна тяжёлая фигура (`Q` или `R`), причём стартовый `EndingFEN` задачи изначально не являлся такой позицией (универсальная защита упражнений на технику матования). При подтверждении мата по 3–5-фигурным таблицам Gaviota (`POST /api/gaviota/automat-line`, `Zero-Fallback`) система действует по настройке `gameplay.endgameAutomat` (`'unknown'` показывает диалог [`EndgameAutomatOverlay.vue`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/features/training-session/ui/EndgameAutomatOverlay.vue) с запоминанием выбора `'on' | 'off'`; при старте автомата таймер ставится на паузу, анимация фиксируется на `200 мс` через `boardStore.animationDurationOverrideMs`, а ходы мата разыгрываются с ускорением `750 мс` → `250 мс`). Симметрично контроллер [`EndgameHopelessController.ts`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/entities/game/model/EndgameHopelessController.ts) ([`endgameHopelessRules.ts`](file:///c:/MY_APPS/CHESS_APP/app_vue/src/entities/game/lib/endgameHopelessRules.ts)) при `3 <= фигур <= 5` в `isPlayoutMode` зондирует `POST /api/gaviota/probe` и, если цель уже математически недостижима (`wdl <= 0` при `win` или `wdl === -1` с `halfmoves + |dtm| < 100` при `hold_draw`), воспроизводит `you_will_never_win.mp3` и выводит модалку «Дальнейшее сопротивление бессмысленно» (`Рестарт / Сдаться / Страдать`).

---

## 3. Продакшен Nginx-маршрутизатор (`nginx.conf`)

В продакшене контейнер `app_vue` (`chess_frontend`) выступает входным HTTP-маршрутизатором за Traefik:
- Проверяет сессию через внутренний подзапрос `auth_request /api/auth/check` к `fastify-app:3000` и прокидывает проверенные `X-User-Id` и `X-User-Role` напрямую в `puzzle-engine:5000`, `stockfish_server:5000`, `engine-hub:5000` и `tableservice:5000` (на публичных маршрутах принудительно очищает `X-User-Id ""` и `X-User-Role ""`).
- Применяет строгий IP-рейтлимит (`api_limit` `15r/s`, `engine_limit` `5r/s` с обходом только для верифицированных ролей `developer` и `owner`), ограничивает `client_max_body_size` до `1M` глобально (`15M` только для `/api/engine-eval/endgame/analyze`), проксирует в `fastify-app` строго белый список `/api/(auth|users|gaviota)/` и отсекает все неизвестные `/api/*` сканы с `404` (`access_log off`) на уровне Nginx.
- При добавлении любых `add_header` внутри `location`-блока обязательно повторно подключать `include /etc/nginx/security-headers.conf;` (из-за правила наследования заголовков в Nginx).

---

## 4. Обязательная валидация после правок

```powershell
cd C:\MY_APPS\CHESS_APP\app_vue
pnpm type-check
pnpm lint
npx vitest run
```
