# tanstack-todo - карта проекта

Учебный/портфолио todo-app. Этот файл - **карта, а не копия кода**: где какая логика и какие сквозные паттерны. Детали (конкретные классы, тексты) не дублируем - для них есть код.

Последняя сверка: 2026-09-18.

## Как поддерживать

- Обновлять после значимых изменений (новый роут/компонент/паттерн, смена подхода).
- Держать коротким, чтобы обновление было дешёвым.
- Claude не может обновлять файл между сессиями; если код меняли мимо Claude - при старте большой задачи попросить сверить карту с кодом.

## Стек

TanStack Start (SSR) + Router + Query · Drizzle ORM + Postgres · shadcn/ui · TanStack Form · sonner (тосты). Windows, npm. Прод-таргет: Vercel (serverless) + Neon (managed Postgres).

## Команды

- `npm run dev` - vite dev на :3000 (ходит в Neon по `.env`)
- `npm test` - все проекты; `test:unit` (jsdom, офлайн) / `test:integration` (Neon-ветка `test`, по сети) - по отдельности; `test:watch`
- `npm run db:push:test` - синхронизировать схему на тест-ветку (`.env.test`), если она отстала от main (обычно ветка наследует схему при создании)
- `npm run build`, `npm run generate-routes` (tsr)
- Миграции: `db:generate` (сгенерить SQL-диф в `drizzle/`, коммитим) → `db:migrate` (накат на Neon; **direct**-строкой, не pooled). Прод - шагом в CI. `db:push` - только быстрая синхронизация схемы, без истории.
- `npm run format` - prettier + eslint (прогонять после `shadcn add`)
- `npm run typecheck` - `tsc --noEmit`
- Git-хуки (husky): `pre-commit` → lint-staged (prettier+eslint по staged), `pre-push` → typecheck + `test:unit`. Ставятся сами через `prepare` на `npm install`.

## Структура (файл → ответственность)

- `src/router.tsx` - `getRouter()`: создаёт `QueryClient`, кладёт в context роутера, `setupRouterSsrQueryIntegration`.
- `src/routes/__root.tsx` - корневой роут: html-shell, head, `<Toaster>`, `notFoundComponent` (404 через MessageScreen), тип контекста `{ queryClient }`.
- `src/routes/index.tsx` - `/`: лоадер префетчит список, `useSuspenseQuery`, `TodoHeader` + `TodoList`/`Empty`, `errorComponent`.
- `src/routes/new.tsx` - `/new`: `addTodoServer` + `TodoForm`, submit → invalidate + navigate + тосты.
- `src/routes/edit.$todoId.tsx` - `/edit/$todoId`: в лоадере uuid-guard + `getTodo` (иначе `notFound`), `updateTodoServer`, `TodoForm`, `TaskNotFound` (notFoundComponent), `errorComponent`.
- `src/components/todo-list.tsx` - `TodoList`/`TodoItem`: toggle (оптимистичная мутация) и delete (стратегия A); server fns берёт из `#/server/todos`, экспортит тип `Todo`.
- `src/components/todo-header.tsx` - шапка + бейдж «X / Y done».
- `src/components/todo-form.tsx` - презентационная форма для create/edit: `useForm` + zod; пропсы `defaultName/submitLabel/pendingLabel/onSubmit/icon`.
- `src/components/message-screen.tsx` - общий центрированный экран (`icon/title/description/action`) для 404 / notFound / error.
- `src/components/route-error.tsx` - `errorComponent`: MessageScreen + кнопка Retry (`router.invalidate`).
- `src/components/ui/*` - shadcn (генерятся CLI; после `add` прогонять `npm run format`).
- `src/server/todos.ts` - server fns над todos (`get/getOne/add/toggle/delete/update`) + тип `Todo`. Тонкие обёртки: `requireUserId` → вызов `todos-repo`.
- `src/server/todos-repo.ts` - чистый data-слой: функции с явным `userId` (`listTodos/getTodo/addTodo/toggleTodo/deleteTodo/updateTodo`), скоуп по владельцу в SQL. Тестируемый шов для integration; мутации возвращают `.returning()`.
- `src/lib/todos-query.ts` - только `todosQueryOptions`, `todoQueryOptions(id)` (импортируют read-fns из `#/server/todos`).
- `src/lib/todos.ts` - чистые функции: `countCompleted`, `toggleInList`, `removeFromList` (покрыты юнит-тестами).
- `src/lib/auth.ts` - инстанс Better Auth (`drizzleAdapter` pg, `emailAndPassword`; секрет/URL из env).
- `src/lib/auth-client.ts` - клиентский `createAuthClient` (`signIn/signUp/signOut`).
- `src/lib/auth-server.ts` - `getSession` и `requireUserId` (server fns над `auth.api.getSession`; `requireUserId` кидает при отсутствии сессии).
- `src/components/auth-form.tsx` - презентационная форма email+password (login/signup).
- `src/routes/login.tsx`, `src/routes/signup.tsx` - экраны входа/регистрации.
- `src/routes/api/auth/$.ts` - catch-all серверный роут, проксирует GET/POST в `auth.handler`.
- `src/db/auth-schema.ts` - таблицы Better Auth (`user/session/account/verification`), сгенерены CLI; ре-экспортятся из `schema.ts`.
- `src/db/schema.ts` - таблица `todos` + `export * from './auth-schema'`.
- `src/db/index.ts` - drizzle-клиент на `neon-http` (HTTP-драйвер Neon, работает и локально, и на Vercel). `DATABASE_URL` - pooled-строка Neon. Транзакций не используем.
- `src/test/setup.ts` - unit/component setup (jest-dom + cleanup).
- `src/test/setup.integration.ts` - integration setup: грузит `.env.test` (Neon-ветка `test`), `truncate` в `beforeEach`.
- `src/test/load-test-env.ts` - `dotenv` `.env.test` (импортится первым, до `#/db`).
- `src/test/db.ts` - сид-хелперы `seedUser`/`seedTodo` (прямой insert).

## Модель данных

`todos`: `id` (uuid, pk, defaultRandom), `name` (text), `isComplete` (bool), `createdAt`, `updatedAt` (timestamptz).

`todos.userId` (text, FK → `user.id`, notNull, cascade) - владелец задачи.

Auth (Better Auth): `user` (идентичность), `account` (учётки/провайдеры, 1:N; хеш пароля в `account.password`), `session` (серверные сессии), `verification` (одноразовые токены).

## Роуты

`/` список · `/new` создать · `/edit/$todoId` редактировать · неизвестный URL → root `notFoundComponent`.

## Сквозные паттерны

- **Данные = серверное состояние в кэше Query.** Лоадеры префетчат через `context.queryClient.query({ ...opts, staleTime: 'static' })` (замена deprecated `ensureQueryData`); компоненты читают `useSuspenseQuery` (или `useLoaderData` на edit).
- **Серверные функции** (`createServerFn`) над todos централизованы в `src/server/todos.ts`; компоненты/роуты импортят их оттуда. Gotcha: добавление нового server-fn модуля на лету ломает HMR (`Buffer is not defined` / 500) - нужен рестарт dev-сервера.
- **Оптимистичные мутации:** `onMutate` = cancelQueries + snapshot + `setQueryData` (через чистую функцию из `lib`); `onError` = откат + `toast.error`; `onSettled` = invalidate. Дженерики `useMutation<void, Error, Vars, Ctx>` задаём явно (иначе ломается вывод типов).
- **Удаление - стратегия A:** оптимистичное удаление + тост Undo (5с), реальный `DELETE` откладывается до `onAutoClose`/`onDismiss`, флаг `settled` защищает от двойного срабатывания. Ранний уход из окна = «воскрешение» (принято осознанно). Hard delete.
- **Формы:** TanStack Form. Валидация: per-field `onBlur` (`schema.shape.<field>`) + form-level `onSubmit` (полная схема) - ошибка не зажигается с первого символа и не триггерит соседние поля. Так в `todo-form` и `auth-form`. Submit в `try/catch`: ошибка → `toast.error` без навигации; успех → `toast.success` + navigate. Валидаторы server fns - вторая линия. На ссылках-переходах внутри форм - `onMouseDown → preventDefault`, чтобы blur не срабатывал и клик не срывался.
- **Rate limit:** только auth-роуты (встроенный лимитер Better Auth, `rateLimit` в конфиге). In-memory лимитер на мутациях todos убран (бесполезен на serverless/многоинстансе); при нужде - Upstash Redis.
- **Гигиена ввода:** id во всех server fns - `z.uuid()` (отсекает мусор до БД); `name` - `.trim().min(1).max(500)` (сервер + клиентская схема формы).
- **notFound:** `getTodoServer` возвращает `null` (Query запрещает `undefined`); лоадер edit валидирует `z.uuid()` и бросает `notFound()` для кривого/несуществующего id; `TaskNotFound` как `notFoundComponent` роута.
- **Ошибки чтения:** `errorComponent` на дата-роутах → `RouteError` (Retry). Настоящие сбои идут сюда; notFound - отдельный канал роутера.
- **Тосты:** sonner, `<Toaster richColors position="bottom-right" />` в root. success / error / warning (удаление - жёлтый + иконка корзины).
- **Стили:** `cn` из пакета `cn`. Prettier: `semi`, `singleQuote`, `tabWidth: 4`, `trailingComma: all`. Тексты интерфейса - на английском.

## Auth (Better Auth)

- Метод: email + password. Сессии серверные, кука `better-auth.session_token` (HttpOnly, SameSite=Lax, `Secure` под HTTPS). `requireEmailVerification: false` (dev). CSRF/хеши - из коробки. Включены `session.cookieCache` (getSession реже бьёт в БД) и `rateLimit`.
- Схема таблиц генерится `npx @better-auth/cli generate --output src/db/auth-schema.ts`, применяется `npm run db:push`.
- Эндпоинты под `/api/auth/*` (напр. `POST /api/auth/sign-up/email`, `GET /api/auth/ok`).
- Сессию на сервере читать `auth.api.getSession({ headers })` (обёрнуто в `getSession`).
- **Гварды:** root `beforeLoad` кладёт `session` в контекст роутера; защищённые роуты (`/`, `/new`, `/edit/$todoId`) в `beforeLoad` редиректят на `/login` если нет сессии; `/login` `/signup` редиректят на `/` если сессия есть. Sign out - в `TodoHeader` (`signOut` + `router.invalidate` + navigate). Гвард - это UX; настоящая проверка владельца будет в server fns (этап 4).
- **Скоупинг по владельцу:** все server fns над `todos` вызывают `requireUserId()` и фильтруют по нему - чтения `where eq(userId)`, мутации `where and(eq(id), eq(userId))` (чужой id = no-op, IDOR закрыт). `requireUserId` - это **серверная функция** (`createServerFn`), не обычная: обычная функция при импорте в клиентские модули тащит `better-auth` в клиентский бандл (ошибка `Buffer is not defined`); server fn оставляет на клиенте только fetch-стаб.

## Тесты

Vitest + React Testing Library + jsdom. Слои по «трофею»:

- **Unit** - чистые функции `src/lib/todos.test.ts` (`countCompleted`, `toggleInList`, `removeFromList`).
- **Component** - `todo-list.test.tsx`, `todo-header.test.tsx`: рендер, `line-through`, edit-ссылка, клик-чек → вызов `toggleTodoServer`, delete → тост Undo + отложенный/отменённый коммит, бейдж, sign out. Границы мокаются: `vi.mock('#/server/todos')` (не тянет db/auth), `@tanstack/react-start` (`useServerFn`), `@tanstack/react-router` (`Link`/`useRouter`), `sonner`. БД не участвует.
- **Component (формы)** - `todo-form.test.tsx`, `auth-form.test.tsx`: презентационные, моков нет. Валидация не с первого символа, ошибка по `onBlur`, `onSubmit(value)` при валидных данных, блокировка сабмита + ошибка при пустых. Ошибку ассертим по `role="alert"` / тексту (`FieldError`). Замечено: пустой сабмит `AuthForm` показывает только ошибку email (form-level onSubmit мапит на первое поле) - тест под фактическое поведение.
- **Integration** - `src/server/todos-repo.integration.test.ts` (проект `integration`, node + **Neon-ветка `test`**): скоуп/IDOR на настоящем SQL - `listTodos` отдаёт только свои; `getTodo`/`toggle`/`delete`/`update` для чужого id = `null`/no-op (0 строк, запись владельца цела); `addTodo` пишет `userId`; свои операции работают. Edge: пустой список, сортировка по `createdAt asc`, `null`/no-op на несуществующий id. Требует `.env.test` на ветку `test` (не main - `truncate` в `beforeEach` сотрёт!) + маркер `TEST_DB=1` (предохранитель: без него сетап бросает и тесты не идут). По сети → медленнее (~26с) и возможны транзиентные `ECONNRESET` → `retry: 2` + таймауты 30с.
- **Не покрыто на этом уровне (→ E2E):** валидация и auth-гейты обёрток `todos.ts` (zod-отказ на пустое/`>500`/не-uuid, `requireUserId`) - живут в `createServerFn`, в vitest напрямую не дёрнуть; проверяются в Playwright через реальный HTTP+сессию.
- **Не покрыто (осознанно):** оркестрация submit в роутах (`new`/`edit`: invalidate+тост+navigate) - живёт внутри роут-компонента, тяжёлый шов; ляжет на вынос в функцию/хук либо на E2E.
- **Ещё не сделано:** E2E (Playwright) на сквозные пути.

Gotcha: vitest иногда падает с `Timeout waiting for worker to respond` (флап пула на старте) - это не падение тестов, повторный прогон проходит.
