Viewed package.json:1-76
Listed directory src
Listed directory assets
Viewed main.css:1-100

Der Umstieg auf **Tailwind CSS v4** im "alten Schloss" ist **überraschend einfach und risikoarm**, da Tailwind v4 so konzipiert ist, dass es bestehenden CSS-Code nicht kaputtmacht.

---

### 1. Einschätzung des Aufwands

- **Technisches Setup (Vite & CSS):** **15 bis 30 Minuten** (Sehr gering).
- **Komponenten-Migration:** **0 Minuten Frust**, da du **nicht alles auf einmal umstellen musst**.
  - Das bestehende CSS (`src/assets/main.css`), das Cyberpunk-Theme und Naive UI funktionieren sofort weiter.
  - Du kannst Tailwind v4 schrittweise (inkrementell) für neue Features oder bei Überarbeitungen nutzen.

---

### 2. Warum Tailwind v4 perfekt für dieses Projekt passt

1. **Keine `tailwind.config.js` mehr nötig:**
   In Tailwind 4 wird alles direkt in der CSS-Datei via `@theme` konfiguriert.
2. **Vite-native Power (`@tailwindcss/vite`):**
   Extrem schnelles HMR (Hot Module Replacement) dank Lightning CSS – ohne PostCSS-Konfigurationschaos.
3. **Nahtlose Integration mit eurem vorhandenen Design-System:**
   Eure Cyberpunk-CSS-Variablen (`--neon-cyan`, `--bg-0` etc.) lassen sich in Sekunden als Tailwind-Utilities mappen.

---

### 3. Die optimale Vorgehensweise (Schritt-für-Schritt)

#### Schritt 1: Tailwind v4 Pakete installieren

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

#### Schritt 2: Plugin in `vite.config.ts` registrieren

In `vite.config.ts` einfach das Tailwind-Plugin hinzufügen:

```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // ...
  ],
})
```

#### Schritt 3: ExtraPawn-Designsystem in CSS integrieren (`src/assets/main.css`)

Ganz oben in `main.css` `@import "tailwindcss";` einfügen und das Cyberpunk-Farbschema in den `@theme`-Block eintragen:

```css
@import 'tailwindcss';

@theme {
  /* Eure Markenfarben werden sofort zu Tailwind-Klassen! */
  --color-neon-cyan: #00e5ff;
  --color-neon-purple: #b000ff;
  --color-neon-pink: #ff007a;
  --color-neon-lime: #00ff55;

  --color-bg-void: #050508;
  --color-bg-panel: #0a0b14;
  --color-bg-elevated: #12141f;
}
```

Dadurch stehen sofort typisierte Utilities im gesamten Projekt bereit:

- `bg-bg-void` statt `style="background: var(--bg-0)"`
- `text-neon-cyan` statt `color: var(--neon-cyan)`
- `border-neon-purple/30` für transparente Neon-Borders!

#### Schritt 4: Inkrementell "neu tapezieren"

- Neue Komponenten direkt mit Tailwind-Klassen schreiben (`flex items-center gap-4 p-4 bg-bg-panel rounded-xl border border-neon-cyan/20`).
- Alte Scoped-Styles in `.vue`-Dateien nach und nach ersetzen, wenn an diesen Dateien sowieso gearbeitet wird.

---

Edited DESIGN.md
Viewed DESIGN.md:1-20

Отличная работа! `DESIGN.md` составлен великолепно: в нём чётко разграничены токены, шрифты (включая Ubuntu Condensed для нотации и чисел), мост для Naive UI и семантика цветов.

Отвечая на твой главный вопрос: **Как правильнее всего действовать при хаосе в дизайне и переходе на Tailwind v4?**

---

### 1. Золотое правило: Сначала Фундамент (Foundation), затем Постранично (Page-by-Page)

Ни в коем случае нельзя начинать с рефакторинга случайных кнопок или глубоких фич. Самый эффективный и безопасный подход выглядит так:

```
[1. Глобальный фундамент] ➔ [2. Главный Лейаут (Sidebar/Header)] ➔ [3. Постраничная миграция (Page by Page)]
```

---

### 2. Подробная пошаговая стратегия имплементации

#### **Шаг 1: Глобальный фундамент (Foundation Phase)**

_Занимает ~30-45 минут, но сразу дает 50% визуального порядка во всем приложении!_

1. **Подключение Tailwind v4:** Устанавливаем `@tailwindcss/vite` и прописываем `@import "tailwindcss";` в `src/assets/main.css`.
2. **Токены в `@theme`:** Переносим все нейминги из `DESIGN.md` в `@theme` (цвета `--color-void`, `--color-surface`, `--color-neon-cyan`, шрифты `Ubuntu` и `Ubuntu Condensed`).
3. **Мост Naive UI (`tokens.ts`):** Создаем `src/shared/theme/tokens.ts` и передаем тему в `NConfigProvider`.
   > **Результат Шага 1:** Все стандартные компоненты Naive UI (кнопки, диалоги, модалки, таблицы, карточки) по всему приложению **автоматически** переключаются на тему _Zen Dark / Cyber Neon_. Ни одна страница при этом не ломается!

---

#### **Шаг 2: Общая рамка приложения (Layout Shell)**

_Корпус «замка», в котором находятся все страницы._

- Оформляем сайдбар, верхнюю панель навигации (Header) и фоновый контейнер страницы (`bg-void`).
- Настраиваем шрифты `font-display` и переключатели.

---

#### **Шаг 3: Постраничная миграция (Page-by-Page)**

_Да, именно **постранично**, а не по фичам!_

**Почему постранично — это оптимальный выбор?**

1. **Визуальная законченность:** Ты можешь открыть одну страницу (например, Кабинет пользователя), довести её до идеала, проверить в браузере и закоммитить. Она будет выглядеть свежо и цельно.
2. **Изолированный объем работ:** Ты не застреваешь в бесконечном рефакторинге 20 разных файлов. Закончили страницу ➔ протестировали ➔ закоммитили ➔ пошли к следующей.
3. **Быстрое переиспользование:** Компоненты, отрефакторенные на первой странице (карточки статистики, аватары, кнопки), становятся шаблоном для последующих страниц.

---

### 3. Рекомендуемый порядок страниц (Приоритеты)

1. **Страница 1: Профиль пользователя / Дашборд (User Cabinet)**
   - Простая структура, идеальна для обкатки сетки (Grid), карточек статистики и Naive UI компонентов.
2. **Страница 2: Главная панель анализа / Шахматная доска (Analysis / Game View)**
   - Самый важный экран приложения. Настройка Chessground, аннотаций доски, списков ходов (`font-condensed`) и оценочной шкалы (Eval Bar).
3. **Страница 3: Тренировки / Дебюты / Репертуар (Repertoire & Studies)**
4. **Страница 4: Задачи и Рекорды (Puzzles & Leaderboard)**
5. **Страница 5: Настройки (Settings)**

---

### Готов к началу?

В следующей сессии мы можем начать с **Шага 1 (Настройка Tailwind 4 + DESIGN.md токенов + Naive UI Bridge)**.

После этого выберем первую страницу (например, Кабинет пользователя) и полностью приведем её к дизайну из `DESIGN.md`. Как тебе такой план?
