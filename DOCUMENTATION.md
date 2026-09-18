# tanstack-todo - карта проекта

Учебный/портфолио todo-app. Этот файл - **карта, а не копия кода**: где какая логика и какие сквозные паттерны. Детали (конкретные классы, тексты) не дублируем - для них есть код.

Последняя сверка: 2026-09-18.

## Как поддерживать

- Обновлять после значимых изменений (новый роут/компонент/паттерн, смена подхода).
- Держать коротким, чтобы обновление было дешёвым.
- Claude не может обновлять файл между сессиями; если код меняли мимо Claude - при старте большой задачи попросить сверить карту с кодом.

## Стек

TanStack Start (SSR) + Router + Query · Drizzle ORM + Postgres · shadcn/ui · TanStack Form · sonner (тосты). Windows, npm.

## Команды

- `npm run dev` - vite dev на :3000
- `npm test` / `npm run test:watch` - vitest
- `npm run build`, `npm run generate-routes` (tsr)
- `npm run db:generate|push|pull|studio` (drizzle-kit)
- `npm run format` - prettier + eslint (прогонять после `shadcn add`)

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
- `src/server/todos.ts` - ВСЕ серверные функции над todos (`get/getOne/add/toggle/delete/update`) + тип `Todo` (`typeof todos.$inferSelect`). Каждая: `requireUserId` + скоуп по владельцу; мутации ещё и `checkRateLimit`.
- `src/server/rate-limit.ts` - in-memory sliding-window лимитер (`checkRateLimit`); ограничение: память процесса, для многоинстанса нужен Redis.
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
- `src/db/index.ts` - drizzle-клиент (node-postgres, `DATABASE_URL`).
- `src/test/setup.ts` - vitest + jest-dom + cleanup.

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
- **Rate limit:** мутации над todos зовут `checkRateLimit(userId)` (in-memory). Auth-роуты - встроенный лимитер Better Auth (`rateLimit` в конфиге).
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

Vitest + React Testing Library + jsdom. Сейчас - только юниты чистых функций в `src/lib/todos.test.ts` (`countCompleted`, `toggleInList`, `removeFromList`), 9 тестов. Компонентные тесты сознательно убраны как несостоятельные (слишком много моков из-за колокации server fns); осмысленный UI-охват - через E2E, если понадобится.
