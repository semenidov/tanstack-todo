# tanstack-todo - карта проекта

Учебный/портфолио todo-app. Этот файл - **карта, а не копия кода**: где какая логика и какие сквозные паттерны. Детали (конкретные классы, тексты) не дублируем - для них есть код.

Последняя сверка: 2026-09-29.

## Как поддерживать

- Обновлять после значимых изменений (новый роут/компонент/паттерн, смена подхода).
- Держать коротким, чтобы обновление было дешёвым.
- Claude не может обновлять файл между сессиями; если код меняли мимо Claude - при старте большой задачи попросить сверить карту с кодом.

## Стек

TanStack Start (SSR) + Router + Query · Drizzle ORM + Postgres · shadcn/ui · TanStack Form · sonner (тосты). Windows, npm. Прод: Vercel (serverless) + Neon (managed Postgres) - https://todo-semenidov.vercel.app.

Окружения Vercel: **Production** (merge в `master`) - статичный `DATABASE_URL` на Neon `main`; **Preview** (любая другая ветка/PR) - интеграция Neon-Managed подставляет `DATABASE_URL` (+`_UNPOOLED`) в каждый деплой сама (webhook → ветка `preview/<git-ветка>`), руками для Preview его не задавать. Ветка БД - снимок `main` на первом деплое git-ветки (копия прод-данных), дальше живёт отдельно; обновить - Reset from parent в Neon; удаляется после удаления git-ветки (при следующем preview-деплое). Development в Vercel не используем (локально `.env`). Секреты окружений раздельные (`BETTER_AUTH_SECRET` у Preview свой). Сборка идёт через `npm run vercel-build` (`scripts/vercel-build.mjs`): на Preview перед `vite build` катит `drizzle-kit migrate` на свою Neon-ветку, на Production - только `vite build`.

## Команды

- `npm run dev` - vite dev на :3000 (ходит в Neon по `.env`)
- `npm test` - все проекты; `test:unit` (jsdom, офлайн) / `test:integration` (Neon-ветка `test`, по сети) - по отдельности; `test:watch`
- `npm run db:push:test` - синхронизировать схему на тест-ветку (`.env.test`), если она отстала от main (обычно ветка наследует схему при создании)
- `npm run build`, `npm run generate-routes` (tsr)
- Миграции: `db:generate` (сгенерить SQL-диф в `drizzle/`, коммитим) → `db:migrate` (накат на Neon; **direct**-строкой, не pooled). Прод - шагом в CI. `db:push` - только быстрая синхронизация схемы, без истории.
- `npm run format` - prettier + eslint (прогонять после `shadcn add`)
- `npm run typecheck` - `tsc --noEmit`
- Git-хуки (husky): `pre-commit` → lint-staged (prettier+eslint по staged), `pre-push` → typecheck + `test:unit`. Ставятся сами через `prepare` на `npm install`.
- CI (`.github/workflows/ci.yml`): на PR и push в `master`. `quality` (lint+typecheck), `unit`, `integration` (эфемерная Neon-ветка `ci-<run_id>`). `e2e` - `needs` все чеки, ставит Chromium (`playwright install --with-deps`), эфемерная ветка `e2e-<run_id>`, `npm run test:e2e`, при падении - артефакт `playwright-report`. `migrate` - только push в `master`, `needs` все чеки, `db:migrate` на Neon main (direct). Секреты: `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_MAIN_DATABASE_URL` (direct), `BETTER_AUTH_SECRET`. `create-branch-action@v5` требует вход `username` (роль Neon, у нас `neondb_owner`). Vercel деплоит из гита сам, параллельно.

## Структура (файл → ответственность)

- `src/router.tsx` - `getRouter()`: создаёт `QueryClient`, кладёт в context роутера, `setupRouterSsrQueryIntegration`.
- `src/client.tsx` - кастомная клиентская точка входа: первым импортом `instrument.client` (Sentry), затем гидрация `StartClient`.
- `src/server.ts` - кастомная серверная точка входа: первым импортом `instrument.server`, `fetch` обёрнут `wrapFetchWithSentry`.
- `src/start.ts` - `createStart`: глобальные Sentry-middleware (request + function) - ловят ошибки server fns; `createCsrfMiddleware` на все server fns (отбивает cross-site вызовы).
- `src/instrument.client.ts` / `src/instrument.server.ts` - `Sentry.init` (DSN из env, без DSN - no-op; только ошибки). `src/lib/sentry.ts` - общий строгий `dataCollection` (без тел/кук/заголовков/данных БД/переменных стека).
- `src/routes/__root.tsx` - корневой роут: html-shell, head, `<Toaster>`, `notFoundComponent` (404 через MessageScreen), тип контекста `{ queryClient }`.
- `src/routes/index.tsx` - `/`: `redirect` на `/boards`; компонент не рендерится.
- `src/server/debug.ts` - `crashServerFn` (тестовая серверная ошибка для Sentry); на production (`VERCEL_ENV`) отвечает 404 без броска.
- `src/components/message-screen.tsx` - общий центрированный экран (`icon/title/description/action`) для 404 / notFound / error.
- `src/components/route-error.tsx` - `errorComponent`: MessageScreen + кнопка Retry (`router.invalidate`).
- `src/components/ui/*` - shadcn (генерятся CLI; после `add` прогонять `npm run format`).
- `src/lib/seo.ts` - метаданные: `pageMeta(screen)` (title + `og:title` в формате `<Экран> · Todo List`), `siteMeta` (description, OG, twitter card), `siteLinks` (favicon, apple-touch-icon, manifest).
- `src/lib/auth.ts` - инстанс Better Auth (`drizzleAdapter` pg, `emailAndPassword`; секрет из env). `baseURL` динамический: `allowedHosts` - прод-домен всегда, маска `tanstack-todo-*-ssemenidov.vercel.app` только при `VERCEL_ENV=preview`, `localhost:3000`/`127.0.0.1:3100` только вне Vercel; `protocol` https на Vercel, http локально. Хост запроса из списка становится baseURL и доверенным origin - превью логинятся без "Invalid origin". `BETTER_AUTH_URL` больше не используется.
- `src/lib/auth-client.ts` - клиентский `createAuthClient` (`signIn/signUp/signOut`).
- `src/lib/auth-server.ts` - `getSession` и `requireUserId` (server fns над `auth.api.getSession`; `requireUserId` кидает при отсутствии сессии).
- `src/components/auth-form.tsx` - презентационная форма email+password (login/signup).
- `src/routes/login.tsx`, `src/routes/signup.tsx` - экраны входа/регистрации.
- `src/routes/api/auth/$.ts` - catch-all серверный роут, проксирует GET/POST в `auth.handler`.
- `src/db/auth-schema.ts` - таблицы Better Auth (`user/session/account/verification`), сгенерены CLI; ре-экспортятся из `schema.ts`.
- `src/db/schema.ts` - таблицы `boards`, `lists`, `cards` (`cards.description` nullable) + `relations` для `boards/lists/cards` (нужны для relational `getBoard`) + `export * from './auth-schema'`.
- `src/server/boards-repo.ts` - чистый data-слой досок: `listBoards/createBoard/renameBoard/deleteBoard/getBoard/addList/renameList/deleteList/addCard/updateCard/moveCard/deleteCard`, все с явным `userId`. Доступ проверяется самим запросом (join/`inArray`-подзапрос до `boards.owner_id = userId`), отдельной функции проверки нет; для инсертов (`addList/addCard`) - предварительный `findFirst` с проверкой владельца перед `insert`. `moveCard` требует, чтобы целевая колонка была на той же доске, что и текущая. Мутации над чужим/несуществующим id не меняют данные и возвращают `[]`/`null`.
- `src/server/boards-repo.integration.test.ts` - ownership-скоуп для всех репо-функций досок, включая попытку `moveCard` на чужую доску того же владельца.
- `src/server/boards.ts` - server fns над досками (`listBoardsServer/createBoardServer/renameBoardServer/deleteBoardServer/getBoardServer/addListServer/renameListServer/deleteListServer/addCardServer/updateCardServer/moveCardServer/deleteCardServer`). Тонкие обёртки: `requireUserId` → вызов `boards-repo`, валидация zod (`z.uuid()`, название/описание с лимитами).
- `src/lib/boards-query.ts` - `boardQueryOptions(boardId)` (ключ `['boards', boardId]`), `boardsListQueryOptions` (ключ `['boards']`) (импортируют read-fns из `#/server/boards`); экспортит типы `BoardData`/`ListWithCards`/`Card`, выведенные из возврата `getBoardServer`.
- `src/lib/use-drag-scroll.ts` - `useDragScroll()`: callback ref, горизонтальный pan мышью по фону контейнера (только `pointerType === 'mouse'`, `target === currentTarget`, pointer capture; на время drag `select-none cursor-grabbing!` и inline `scroll-snap-type: none` - доска идёт за мышью 1:1; при отпускании плавный `scrollTo` к ближайшей колонке по `scroll-snap-align` детей, затем snap возвращается CSS по `scrollend`); расчёт - чистые `getDragScrollLeft`/`getNearestSnapLeft`.
- `src/lib/boards.ts` - чистые функции над `BoardData`: списки (`addListToBoard`/`renameListInBoard`/`removeListFromBoard`) и карточки (`addCardToList`/`updateCardInBoard`/`moveCardInBoard`/`removeCardFromBoard`/`findCardInBoard`) для оптимистичных правок кэша `['boards', boardId]`.
- `src/routes/b/$boardId/route.tsx` - `/b/$boardId`: доска-layout (папочная конвенция роутера), рендерит `BoardView` + `<Outlet />` для окна карточки. Лоадер - uuid-guard + `boardQueryOptions` (иначе `notFound`), `pendingComponent: BoardSkeleton`, `notFoundComponent: BoardNotFound`, `errorComponent: RouteError`. `head` берёт название доски из `loaderData`.
- `src/routes/b/$boardId/c/$cardId.tsx` - `/b/$boardId/c/$cardId`: дочерний роут, окно карточки. Карточка ищется в кэше `boardQueryOptions` (`findCardInBoard`, без отдельного запроса); не найдена - тост «Card not found» + `navigate` на доску. `head` берёт название карточки из лоадера (читает тот же кэш).
- `src/components/boards/` - страница `/boards`: `boards-view.tsx` (шапка «Boards» + сетка `grid-cols-2 sm:3 lg:4` + пустое состояние `Empty`), `board-tile.tsx` (плитка-`Link` на `/b/$boardId`, название + «N lists», меню `⋯` Rename/Delete…; в режиме rename вместо ссылки неуправляемое поле, Enter/blur - сохранить, Esc - отмена), `create-board-tile.tsx` (плитка с пунктирной рамкой; создание не оптимистичное, после успеха `navigate` на `/b/<новый id>`), `delete-board-dialog.tsx` (`AlertDialog` со счётчиками, фокус на Cancel), `board-mutations.tsx` (`useRenameBoard` (оптимистично над кэшами `['boards']` и `['boards', id]`)/`useDeleteBoard` - оптимистично над кэшем `['boards']`, откат+тост; чистые функции правки - `renameBoardInList`/`removeBoardFromList` в `src/lib/boards.ts`), `boards-skeleton.tsx` (3 плитки).
- `src/components/board/board-view.tsx` - `BoardView`: шапка (`Link` `← Boards` на `/boards` - на мобильном только иконка, `aria-label="Back to boards"`; название через `EditableTitle`, переименование оптимистично через `useRenameBoard` + `router.invalidate()`, чтобы обновился заголовок вкладки; `ThemeToggle`, выход) + горизонтальный ряд `ListColumn` + `AddList`; пустая доска - `Empty` + `AddList`. Ряд колонок листается перетаскиванием фона мышью (`useDragScroll`).
- `src/components/board/list-column.tsx` - `ListColumn`: колонка (`w-[85vw] sm:w-72`, `snap-start`, внутренний скролл), заголовок через `ListTitle`, меню `⋯` (Rename/Delete) через shadcn `DropdownMenu`; тело - `AddCard` (вверху) + список `CardItem`. Мутации: `useRenameList` (оптимистичная, откат+тост, invalidate), `useDeleteList` - `deleteConfirmed` (после `DeleteListDialog`, для непустых колонок) и `deleteEmptyWithUndo` (пустая колонка - как удаление todo: тост Undo 5с, `settled`-флаг).
- `src/components/editable-title.tsx` - `EditableTitle`: общий компонент «кнопка ↔ неуправляемое поле» для колонки, плитки доски и шапки доски (Enter/blur - сохранить непустое и изменённое, Esc - отмена, `disabled`; `children` - доп. содержимое кнопки; классы кнопки и поля - `className`/`inputClassName`, одной высоты).
- `src/components/board/list-title.tsx` - `ListTitle`: `EditableTitle` + счётчик карточек, контролируется родителем (`isEditing` снаружи, чтобы пункт меню Rename тоже мог войти в режим правки).
- `src/components/board/add-list.tsx` - `AddList`: кнопка → поле; Enter сохраняет и оставляет поле открытым (рефокус), Esc/blur закрывают. Оптимистичное добавление с временным `id` (`crypto.randomUUID()`), реальный id приходит через `onSettled` → invalidate (сервер не возвращает созданную запись).
- `src/components/board/delete-list-dialog.tsx` - `DeleteListDialog`: shadcn `AlertDialog`, текст с числом карточек (ед./мн. число), фокус на Cancel (`autoFocus`, он первый в DOM).
- `src/components/board/board-skeleton.tsx` - `BoardSkeleton`: шапка + 3 колонки-скелетона на `ui/skeleton`.
- `src/components/board/add-card.tsx` - `AddCard`: как `AddList`, но в начале колонки; временный `id` через `createTempId()`, Enter сохраняет и оставляет поле открытым, Esc/blur закрывают.
- `src/components/board/card-item.tsx` - `CardItem`: `Link` на `/b/$boardId/c/$cardId`, меню `⋯` (hover на десктопе через `group-hover`, всегда видно на мобильном) - подменю «Move to…» (`DropdownMenuSub`, остальные колонки доски) и «Delete» с Undo (как у колонок). Пока `id` временный (`isTempId`) - ссылка и меню отключены.
- `src/components/board/card-mutations.tsx` - хуки мутаций карточек: `useAddCard`, `useUpdateCard`, `useMoveCard` (оптимистично переносят карточку в начало целевой колонки), `useDeleteCard` (Undo 5с, по образцу `useDeleteList`). Общие для `add-card.tsx`, `card-item.tsx`, `card-dialog.tsx`.
- `src/components/board/card-dialog.tsx` - `CardDialog`: shadcn `Dialog`, инлайн-название (Enter/blur - сохранить, Esc - отмена, как `ListTitle`), `Select` колонки (выбор сразу вызывает `useMoveCard`), описание - `Textarea` + Save/Cancel (кнопки появляются при расхождении с сохранённым значением), «Delete card» с Undo. Закрытие (Esc/✕/клик мимо) - через `onOpenChange` у `Dialog`, `onClose` пробрасывается роутом и делает `navigate` на `/b/$boardId`.
- `src/db/index.ts` - drizzle-клиент на `neon-http` (HTTP-драйвер Neon, работает и локально, и на Vercel). `DATABASE_URL` - pooled-строка Neon. Транзакций не используем.
- `src/test/setup.ts` - unit/component setup (jest-dom + cleanup).
- `src/test/setup.integration.ts` - integration setup: грузит `.env.test` (Neon-ветка `test`), `truncate` в `beforeEach`.
- `src/test/load-test-env.ts` - `dotenv` `.env.test` (импортится первым, до `#/db`).
- `src/test/db.ts` - сид-хелпер `seedUser` (прямой insert).

## Модель данных

`boards`/`lists`/`cards`: `boards` (`ownerId` → `user.id`, cascade, `title`), `lists` (`boardId` → `boards.id`, cascade, `title`), `cards` (`listId` → `lists.id`, cascade, `title`, `description` nullable). Каждая таблица - `id` (uuid, pk, defaultRandom)/`createdAt`/`updatedAt` (timestamptz). Индексы: `boards_owner_id_idx`, `lists_board_id_created_at_idx`, `cards_list_id_created_at_idx`.

Auth (Better Auth): `user` (идентичность), `account` (учётки/провайдеры, 1:N; хеш пароля в `account.password`), `session` (серверные сессии), `verification` (одноразовые токены).

## Роуты

`/` редиректит на `/boards` · `/boards` список досок · `/b/$boardId` доска · `/b/$boardId/c/$cardId` окно карточки (дочерний роут доски) · неизвестный URL → root `notFoundComponent`.

## Сквозные паттерны

- **Данные = серверное состояние в кэше Query.** Лоадеры префетчат через `context.queryClient.query({ ...opts, staleTime: 'static' })` (замена deprecated `ensureQueryData`); компоненты читают `useSuspenseQuery`.
- **Серверные функции** (`createServerFn`) над досками централизованы в `src/server/boards.ts`; компоненты/роуты импортят их оттуда. Gotcha: добавление нового server-fn модуля на лету ломает HMR (`Buffer is not defined` / 500) - нужен рестарт dev-сервера.
- **Оптимистичные мутации:** `onMutate` = cancelQueries + snapshot + `setQueryData` (через чистую функцию из `lib`); `onError` = откат + `toast.error`; `onSettled` = invalidate. Дженерики `useMutation<void, Error, Vars, Ctx>` задаём явно (иначе ломается вывод типов).
- **Удаление - стратегия A:** оптимистичное удаление + тост Undo (5с), реальный `DELETE` откладывается до `onAutoClose`/`onDismiss`, флаг `settled` защищает от двойного срабатывания. Ранний уход из окна = «воскрешение» (принято осознанно). Hard delete.
- **Формы:** TanStack Form. Валидация: per-field `onBlur` и `onSubmit` (`schema.shape.<field>`) + `canSubmitWhenInvalid: true` - ошибка не зажигается с первого символа, не триггерит соседние поля, а пустой сабмит подсвечивает все поля (form-level onSubmit не срабатывал при уже существующей onBlur-ошибке, #57). Кнопка блокируется только на время `isSubmitting`. Так в `auth-form`. Submit в `try/catch`: ошибка → `toast.error` без навигации; успех → `toast.success` + navigate. Валидаторы server fns - вторая линия. На ссылках-переходах внутри форм - `onMouseDown → preventDefault`, чтобы blur не срабатывал и клик не срывался.
- **Rate limit:** только auth-роуты (встроенный лимитер Better Auth, `rateLimit` в конфиге).
- **Гигиена ввода:** id во всех server fns - `z.uuid()` (отсекает мусор до БД); текстовые поля - `.trim().min(1).max(500)` (сервер + клиентская схема формы).
- **notFound:** `getBoardServer` возвращает `undefined`/`null` для чужой или несуществующей доски; лоадер `/b/$boardId` валидирует `z.uuid()` и бросает `notFound()`, `BoardNotFound` - `notFoundComponent` роута.
- **Ошибки чтения:** `errorComponent` на дата-роутах → `RouteError` (Retry). Настоящие сбои идут сюда; notFound - отдельный канал роутера.
- **Observability (Sentry):** ошибки сервера (server fns/SSR через middleware + `wrapFetchWithSentry`) и клиента (`RouteError` → `captureException`). `release` = git SHA, `environment` = `VERCEL_ENV` (клиенту через `define` в `vite.config.ts`). Env: `SENTRY_DSN` (сервер), `VITE_SENTRY_DSN` (клиент, DSN не секрет). Source maps: Vite-плагин `sentryTanstackStart` в `vite.config.ts` подключается только при `SENTRY_AUTH_TOKEN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`) - это env билда на Vercel; генерит hidden-карты, грузит в Sentry и удаляет `.map` из сборки. Локально и в CI токена нет - плагин не работает. Gotcha: не возвращать `external: [/^@sentry\//]` в nitro - Sentry не попадёт в `.output`, прод упадёт на старте.
- **Vercel Web Analytics + Speed Insights:** `<Analytics />` и `<SpeedInsights />` в `__root.tsx` (включены в дашборде Vercel). Без cookies. В dev не шлют. `beforeSend` = `normalizeAnalyticsUrl` (`src/lib/analytics.ts`): `/b/<uuid>` → `/b/[boardId]`, `/c/<uuid>` → `/c/[cardId]` - React-вариант без поддержки роутов, иначе каждая правка отдельной строкой и id уходят в Vercel.
- **Метаданные страниц:** каждый роут задаёт `head: () => ({ meta: pageMeta('<Экран>') })`; общие мета и иконки - в `head` корня. TanStack берёт title и мета с тем же `name`/`property` из самого глубокого матча, поэтому экран переопределяет корень. 404: корень и `/b/$boardId` проверяют `match.status === 'notFound' || match._notFound`. Статика в `public/`: `favicon.svg` (исходник), `favicon.ico` (16+32), `apple-touch-icon.png` (180), `icon-192/512.png`, `manifest.webmanifest`, `og-image.png` (1200×630) - заглушки на цветах токенов, PNG/ICO отрендерены из SVG. `og:image` абсолютный: `VITE_SITE_URL` в `vite.config.ts` из `VERCEL_PROJECT_PRODUCTION_URL` (прод) / `VERCEL_URL` (превью), локально пусто → относительный путь. Новый роут = добавить `head` с `pageMeta`.
- **Тосты:** sonner, `<Toaster richColors position="bottom-right" />` в root. success / error / warning (удаление - жёлтый + иконка корзины).
- **Тема:** `next-themes` `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`) в `__root.tsx` вокруг `children`/`Toaster`/Analytics. Переключатель `ThemeToggle` в `board-view.tsx`, цикл light → dark → system. Выбор хранится в `localStorage` (ключ `theme`).
- **Стили:** `cn` из пакета `cn`. Prettier: `semi`, `singleQuote`, `tabWidth: 4`, `trailingComma: all`. Тексты интерфейса - на английском.

## Auth (Better Auth)

- Метод: email + password. Сессии серверные, кука `better-auth.session_token` (HttpOnly, SameSite=Lax, `Secure` под HTTPS). `requireEmailVerification: false` (dev). CSRF/хеши - из коробки. Включены `session.cookieCache` (getSession реже бьёт в БД) и `rateLimit`.
- Схема таблиц генерится `npx @better-auth/cli generate --output src/db/auth-schema.ts`, применяется `npm run db:push`.
- Эндпоинты под `/api/auth/*` (напр. `POST /api/auth/sign-up/email`, `GET /api/auth/ok`).
- Сессию на сервере читать `auth.api.getSession({ headers })` (обёрнуто в `getSession`).
- **Гварды:** root `beforeLoad` кладёт `session` в контекст роутера; защищённые роуты (`/`, `/b/$boardId`) в `beforeLoad` редиректят на `/login` если нет сессии; `/login` `/signup` редиректят на `/` если сессия есть. Sign out - в `BoardView` (`signOut` + `router.invalidate` + navigate). Гвард - это UX; настоящая проверка владельца - в server fns (см. ниже).
- **Скоупинг по владельцу:** все server fns над досками вызывают `requireUserId()`; `boards-repo.ts` проверяет владельца в каждом запросе (join/`inArray`-подзапрос до `boards.owner_id`) - чужой id не читается и не меняется. `requireUserId` - это **серверная функция** (`createServerFn`), не обычная: обычная функция при импорте в клиентские модули тащит `better-auth` в клиентский бандл (ошибка `Buffer is not defined`); server fn оставляет на клиенте только fetch-стаб.

## Тесты

Vitest + React Testing Library + jsdom. Слои по «трофею»:

- **Unit** - чистые функции над доской (`src/lib/boards.ts`): добавление/переименование/удаление списка и карточки, поиск карточки, временные id.
- **Component** - `add-card.test.tsx`, `card-dialog.test.tsx`, `delete-list-dialog.test.tsx`, `list-title.test.tsx`: рендер, инлайн-редактирование (Enter/blur/Esc), диалоги подтверждения, `auth-form.test.tsx` (см. ниже). Границы мокаются: `@tanstack/react-start` (`useServerFn`), `@tanstack/react-router`, `sonner`. БД не участвует.
- **Component (формы)** - `auth-form.test.tsx`: презентационная, моков нет. Валидация не с первого символа, ошибка по `onBlur`, `onSubmit(value)` при валидных данных, пустой сабмит - ошибки у обоих полей (#57), очистка ошибки только у поля в фокусе. Ошибку ассертим по `role="alert"` / тексту (`FieldError`).
- **Integration** - `src/server/boards-repo.integration.test.ts` (проект `integration`, node + **Neon-ветка `test`**): скоуп/IDOR на настоящем SQL для всех функций `boards-repo` (включая попытку переноса карточки на чужую доску того же владельца); `src/db/backfill-boards.integration.test.ts` - перенос todo → доски, идемпотентность. Требует `.env.test` на ветку `test` (не main - `truncate` в `beforeEach` сотрёт!) + маркер `TEST_DB=1` (предохранитель: без него сетап бросает и тесты не идут). По сети → медленнее и возможны транзиентные `ECONNRESET` → `retry: 2` + таймауты 30с.
- **Не покрыто на этом уровне (→ E2E):** валидация и auth-гейты обёрток `boards.ts` (zod-отказ, `requireUserId`) - живут в `createServerFn`, в vitest напрямую не дёрнуть; проверяются в Playwright через реальный HTTP+сессию.
- **E2E** - Playwright (`e2e/`, только Chromium, `workers: 1`). `webServer` поднимает app на `127.0.0.1:3100` против **Neon-ветки `e2e`** (`.env.e2e`, `DATABASE_URL` через `webServer.env`, не main). `auth.spec`: регистрация → пустой `/boards`, вход/выход, редирект неавторизованного. `isolation.spec`: чужая доска по прямой ссылке → `Board not found`. `boards.spec`: создать доску (открывается новая), переименовать, удалить последнюю (пустое состояние). `board.spec`: карточка - добавить, переименовать (через окно карточки), переместить в другой список, удалить с Undo и без (коммит после окна Undo, переживает reload); список - добавить, переименовать, удалить (пустой, с Undo); окно карточки по прямой ссылке (`/b/$boardId/c/$cardId`). Хелперы `e2e/helpers/*`: `auth.ts` (`gotoHydrated` ждёт `networkidle` перед действиями - иначе клик до гидрации = нативный сабмит формы), `board.ts` (`gotoBoard`, локаторы по доступным именам компонентов доски: «List actions», «Card actions», «List title», «New card title» и т.п.), `db.ts` (`resetDb` - полный сброс для `auth.setup.ts`, `resetBoards` - только доски, для `beforeEach` в `board.spec`, доска создаётся хелпером `seedBoard(email)` через базу; `gotoBoard(page, email)` сидит доску и открывает `/b/<id>`). Запуск `npm run test:e2e` (UI-дебаг `test:e2e:ui`). Gotcha: `localhost` на Windows резолвится в `::1` → готовность webServer не ловится, поэтому `127.0.0.1`. `timeout: CI ? 60с : 30с` - холодный старт webServer+Neon в CI.
- **Ещё не сделано:** P2 E2E (валидация/notFound за пределами изоляции).

Gotcha: vitest иногда падает с `Timeout waiting for worker to respond` (флап пула на старте) - это не падение тестов, повторный прогон проходит.

- Маршруты: `/` -> редирект на `/boards` (для неавторизованных - `/login`); `/boards` (`src/routes/boards/index.tsx`) - страница досок (`BoardsView`, скелетон, `head: pageMeta('Boards')`). Доска по умолчанию и ленивое создание убраны: новый пользователь видит пустой список.
