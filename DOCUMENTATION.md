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
- `src/components/todo-list.tsx` - `TodoList`/`TodoItem`: toggle (оптимистичная мутация), delete (стратегия A), плюс серверные функции `toggleTodoServer`/`deleteTodoServer`.
- `src/components/todo-header.tsx` - шапка + бейдж «X / Y done».
- `src/components/todo-form.tsx` - презентационная форма для create/edit: `useForm` + zod; пропсы `defaultName/submitLabel/pendingLabel/onSubmit/icon`.
- `src/components/message-screen.tsx` - общий центрированный экран (`icon/title/description/action`) для 404 / notFound / error.
- `src/components/route-error.tsx` - `errorComponent`: MessageScreen + кнопка Retry (`router.invalidate`).
- `src/components/ui/*` - shadcn (генерятся CLI; после `add` прогонять `npm run format`).
- `src/lib/todos-query.ts` - серверные функции чтения (`getTodosServer`, `getTodoServer` → `null`) + `todosQueryOptions`, `todoQueryOptions(id)`.
- `src/lib/todos.ts` - чистые функции: `countCompleted`, `toggleInList`, `removeFromList` (покрыты юнит-тестами).
- `src/lib/utils.ts` - `cn` (но в компонентах фактически импортится `cn` из npm-пакета `cn`).
- `src/db/schema.ts` - таблица `todos`.
- `src/db/index.ts` - drizzle-клиент (node-postgres, `DATABASE_URL`).
- `src/test/setup.ts` - vitest + jest-dom + cleanup.

## Модель данных

`todos`: `id` (uuid, pk, defaultRandom), `name` (text), `isComplete` (bool), `createdAt`, `updatedAt` (timestamptz).

## Роуты

`/` список · `/new` создать · `/edit/$todoId` редактировать · неизвестный URL → root `notFoundComponent`.

## Сквозные паттерны

- **Данные = серверное состояние в кэше Query.** Лоадеры префетчат через `context.queryClient.query({ ...opts, staleTime: 'static' })` (замена deprecated `ensureQueryData`); компоненты читают `useSuspenseQuery` (или `useLoaderData` на edit).
- **Серверные функции** (`createServerFn`) колокейтятся: чтение в `lib/todos-query.ts`, мутации рядом с использованием (add → new, toggle/delete → todo-list, update → edit).
- **Оптимистичные мутации:** `onMutate` = cancelQueries + snapshot + `setQueryData` (через чистую функцию из `lib`); `onError` = откат + `toast.error`; `onSettled` = invalidate. Дженерики `useMutation<void, Error, Vars, Ctx>` задаём явно (иначе ломается вывод типов).
- **Удаление - стратегия A:** оптимистичное удаление + тост Undo (5с), реальный `DELETE` откладывается до `onAutoClose`/`onDismiss`, флаг `settled` защищает от двойного срабатывания. Ранний уход из окна = «воскрешение» (принято осознанно). Hard delete.
- **Формы:** TanStack Form, валидация zod на `onChange`. Submit в `try/catch`: ошибка → `toast.error` без навигации; успех → `toast.success` + navigate. Валидаторы server fns - вторая линия защиты.
- **Гигиена ввода:** id во всех server fns - `z.uuid()` (отсекает мусор до БД); `name` - `.trim().min(1).max(500)` (сервер + клиентская схема формы).
- **notFound:** `getTodoServer` возвращает `null` (Query запрещает `undefined`); лоадер edit валидирует `z.uuid()` и бросает `notFound()` для кривого/несуществующего id; `TaskNotFound` как `notFoundComponent` роута.
- **Ошибки чтения:** `errorComponent` на дата-роутах → `RouteError` (Retry). Настоящие сбои идут сюда; notFound - отдельный канал роутера.
- **Тосты:** sonner, `<Toaster richColors position="bottom-right" />` в root. success / error / warning (удаление - жёлтый + иконка корзины).
- **Стили:** `cn` из пакета `cn`. Prettier: `semi`, `singleQuote`, `tabWidth: 4`, `trailingComma: all`. Тексты интерфейса - на английском.

## Тесты

Vitest + React Testing Library + jsdom. Сейчас - только юниты чистых функций в `src/lib/todos.test.ts` (`countCompleted`, `toggleInList`, `removeFromList`), 9 тестов. Компонентные тесты сознательно убраны как несостоятельные (слишком много моков из-за колокации server fns); осмысленный UI-охват - через E2E, если понадобится.
