# tanstack-todo - журнал решений (ADR, кратко)

Append-only: решения не переписываем и не удаляем; при смене курса добавляем новую запись и помечаем старую «Отменено №». Логируем только выборы с реальными альтернативами - мелочь не пишем. Формат: № · дата · решение · почему · (альтернатива).

## 1. 2026-09-18 · Серверное состояние на TanStack Query, не на сторе

Todos - это серверные данные; Query даёт кэш, оптимизм и инвалидацию из коробки. Отвергнут zustand (клиентский стор для серверного состояния = ручная синхронизация и рассинхрон).

## 2. 2026-09-18 · Чтение: префетч в лоадере + useSuspenseQuery

Лоадер делает `queryClient.query({ ...opts, staleTime: 'static' })` (замена deprecated `ensureQueryData`), компонент читает `useSuspenseQuery`. Единый источник - кэш.

## 3. 2026-09-18 · Оптимистичные мутации с явными дженериками

`useMutation<void, Error, Vars, Ctx>` задаём явно - инференс ломается на паре onMutate+context (ошибки `TVariables`/`{}`).

## 4. 2026-09-18 · Hard delete

`db.delete` вместо soft-delete (флаг). Проще, по ТЗ. Soft дал бы историю/undo, но тянет миграцию и фильтры везде.

## 5. 2026-09-18 · Удаление - стратегия A (отложенный коммит + Undo-тост)

Оптимистично убираем + тост «Undo» 5с; реальный DELETE по `onAutoClose`/`onDismiss`, флаг `settled`. Минус - «воскрешение» при уходе со страницы в окне ожидания - принят осознанно. Альтернатива B (удалить сразу + пересоздать по Undo) отвергнута как более сложная.

## 6. 2026-09-18 · Обработка ошибок и notFound

`errorComponent` (RouteError) на дата-роутах для реальных сбоев; «не найдено» - через `notFoundComponent` + `throw notFound()`. `getTodoServer` возвращает `null` (Query запрещает undefined); edit-лоадер валидирует `z.uuid()` до запроса. Общий `MessageScreen` для 404/notFound/error.

## 7. 2026-09-18 · Навигация в edit - по клику на текст задачи

Ссылка `flex-1` на середину строки; чекбокс/корзинка - отдельные зоны. Отвергнут stretched-link-оверлей (мисклики по чекбоксу/корзинке) и вариант «только глифы текста» (мёртвые отступы).

## 8. 2026-09-18 · Auth на Better Auth, не руками

Меньше шансов ошибиться в криптографии/куках/CSRF. Руками разобрали для понимания, но в код взяли библиотеку. Метод: email+password; серверные сессии (httpOnly, SameSite=Lax); email-верификация off на dev.

## 9. 2026-09-18 · requireUserId - серверная функция, не обычная

Обычная экспортируемая функция при импорте в клиентские модули тащит better-auth в клиентский бандл (`Buffer is not defined`). `createServerFn` оставляет на клиенте только fetch-стаб.

## 10. 2026-09-18 · Скоуп todos по userId во всех server fns (IDOR)

`todos.userId` FK; чтения `where eq(userId)`, мутации `where and(eq(id), eq(userId))`. Гвард роута - только UX; настоящая проверка владельца - в server fns.

## 11. 2026-09-18 · Server fns централизованы в src/server/todos.ts

Вынесены из компонентов/роутов. Явная граница сервер/клиент, убирает класс багов с client-leak. Gotcha: новый server-fn модуль на лету ломает HMR - нужен рестарт dev.

## 12. 2026-09-18 · Rate limit + cookieCache

Мутации todos - in-memory `checkRateLimit` (ограничение: память процесса); auth-роуты - встроенный `rateLimit` Better Auth. `session.cookieCache` - реже бьём в БД на getSession.

## 13. 2026-09-18 · Валидация форм: per-field onBlur + form onSubmit

Не `onChange` (ошибка с первого символа) и не form-level `onBlur` (уход с одного поля валидирует все). На ссылках-переходах внутри форм - `onMouseDown preventDefault`, чтобы blur не срывал клик.

## 14. 2026-09-18 · Стратегия тестов - «трофей»

Много unit+component (jsdom, мок `#/server/todos`, без БД) → немного integration на скоуп/IDOR (реальная тест-БД, мок не проверит корректность SQL) → мало E2E (Playwright). Тест-БД - отдельная локальная база (не Testcontainers) ради простоты; при нашем объёме прогон ~10-15с.

## 15. 2026-09-18 · Data-слой вынесен в `src/server/todos-repo.ts`

Чистые функции с явным `userId` (`list/get/add/toggle/delete/update`); server fns в `todos.ts` стали тонкими (`requireUserId` + `checkRateLimit` + вызов repo). Причина - тестируемый шов: сами server fns в vitest не дёрнуть (тянут `createServerFn`/auth/headers). Отвергнут мок `db` (не проверит реальный SQL/`where`, а ради этого и делаем integration). Мутации repo возвращают `.returning()` - тесты ассертят no-op по длине 0.

## 16. 2026-09-18 · Инфраструктура integration-тестов

Vitest `projects`: `unit` (jsdom, мок server) и `integration` (node, реальная БД); интеграционные - файлы `*.integration.test.ts`. Отдельная база `todo-test` в том же docker-PG (dev - `todo`; не dev-база - иначе truncate затрёт рабочие данные; не второй контейнер - хватает второй БД в инстансе). Имя базы в коде не зашито - берётся из `DATABASE_URL` в `.env.test`. Env - `.env.test` через `dotenv` (грузится первым импортом до `#/db`). Изоляция - `truncate ... cascade` в `beforeEach`; сиды - прямым `insert` (не через тестируемый `addTodo`). Схему на тест-базу катит `db:push:test` (`drizzle.config.test.ts`).

## 17. 2026-09-19 · Local git hooks (husky + lint-staged)

`pre-commit` - lint-staged (prettier+eslint по staged, быстро); `pre-push` - `typecheck` + `test:unit`. Integration в pre-push не берём: требует поднятый Postgres, падал бы не по вине кода - тяжёлое с БД уходит в CI. Хуки - удобство (обходимы `--no-verify`, локальны), настоящая гарантия будет на рубеже CI.

## 18. 2026-09-19 · Прод-таргет - Vercel + Neon (serverless), не Railway/Render

Для портфолио: бесплатно (Vercel Hobby + Neon free) и отзывчиво, +serverless в резюме. Railway отвергнут (нет free-tier, ~$5/мес), Render free - засыпает при простое (холодный старт 30-60с) и временная БД. Цена выбора Vercel - один архитектурный шаг: serverless-совместимый доступ к БД.

## 19. 2026-09-19 · Драйвер БД по окружению (node-postgres / neon-http)

`src/db/index.ts` выбирает драйвер по `process.env.VERCEL`: локально/CI - `node-postgres` (персистентный TCP-пул, быстрые локальные тесты), на Vercel - `neon-http` (запрос по HTTP, без TCP-сокета - иначе эфемерные serverless-инстансы взрывают число коннектов к Postgres). Тип приведён к `NodePgDatabase` (`as unknown as`) - общий query-API совпадает, транзакций не используем (у neon-http их нет). Альтернатива - pooled-URL Neon + node-postgres везде (тогда нужен pgbouncer-эндпоинт); выбран http-драйвер как минимальный.

## 20. 2026-09-19 · In-memory rate-limit убран

`checkRateLimit`/`rate-limit.ts` удалены: на serverless состояние в памяти процесса бессмысленно (эфемерные инстансы, scale-to-zero). Auth-роуты закрыты встроенным лимитером Better Auth. Общий лимит на мутации - позже через Upstash Redis (serverless-native), если появится нужда. Отменяет часть решения №12.

## 21. 2026-09-19 · Прод-миграции через generate+migrate, dev/test - push

Для прод-базы (Neon) - версионированные SQL-миграции: `drizzle-kit generate` (диф схемы в `drizzle/`, коммитим) + `drizzle-kit migrate` (накат, шагом в CI с `DATABASE_URL` на Neon). `push` для прода отвергнут - он сравнивает схему с живой БД и может дропнуть/переписать без истории и ревью. Локальный dev и тест-база остаются на `push`/`db:push:test` ради скорости (истории не ведут). Gotcha: БД, собранная через `push`, не имеет таблицы истории миграций - `migrate` по ней падает; миграции только для чистой БД (Neon).

## 22. 2026-09-19 · Драйвер БД - neon-http всегда (отменяет №19)

Убран условный выбор драйвера: теперь `src/db/index.ts` всегда `neon-http`. Причина - хотим Neon и локально (без docker-Postgres); HTTP-драйвер ходит и с localhost. node-postgres-путь и связанный каст `$client` убраны. Транзакций не используем - ограничение neon-http некритично.

## 23. 2026-09-19 · Тест-изоляция через Neon-ветку `test` (отменяет часть №16)

Локальная тест-база в docker убрана. Тесты идут на **Neon-ветку `test`** (copy-on-write копия main, отдельная строка в `.env.test`). `truncate` в `beforeEach` чистит ветку, main/прод не трогается - `.env.test` обязан смотреть на ветку `test`, иначе сотрёт прод. Следствия сети: прогон медленнее (~26с против ~5с локально) и возможны транзиентные `ECONNRESET`/`fetch failed` при пробуждении compute Neon → `retry: 2` + `hookTimeout/testTimeout: 30000` в integration-проекте. Локальный docker-Postgres для проекта больше не нужен.

## 24. 2026-09-19 · Connection strings: app - pooled, миграции - direct

`DATABASE_URL` приложения (прод, дев, `.env.test`) - **pooled** строка Neon (безопасный дефолт; с neon-http не мешает, страхует на будущее). `drizzle-kit migrate`/`push` - **direct** (unpooled): миграции спотыкаются о transaction-режим PgBouncer.

## 25. 2026-09-19 · CI на GitHub Actions (три джобы)

`.github/workflows/ci.yml`, триггеры `pull_request` + push в `master`, `concurrency` с отменой старого прогона. Три параллельные джобы = три status-check: `quality` (lint+typecheck), `unit` (`test:unit`), `integration` (`test:integration`). Node 24 (как локально), кэш npm. Integration ходит в **Neon-ветку `test`** через секрет `NEON_TEST_DATABASE_URL` + `TEST_DB=1` (postgres-контейнер в CI не нужен - мы на Neon). Caveat: параллельные прогоны на разных ref делят одну ветку `test` (truncate может пересечься); для соло-режима ок, на будущее - Neon branch-per-run. eslint игнорит билд-выхлоп (`.output`/`.nitro`/`.vercel`/`dist`), иначе линтит собранные js.

## 26. 2026-09-19 · CI integration - эфемерная Neon-ветка на прогон (уточняет №25)

Джоба `integration` создаёт ветку `ci-<run_id>` через `neondatabase/create-branch-action` (наследует схему от main, copy-on-write), гоняет тесты по её pooled-URL (+`TEST_DB=1`), удаляет ветку `delete-branch-action` с `if: always()`. Решает коллизию статичного `test`-бранча (CI и локаль больше не делят одну базу). Секреты: `NEON_API_KEY` + `NEON_PROJECT_ID` (вместо `NEON_TEST_DATABASE_URL`). Вариант с одноразовым Postgres-контейнером отвергнут: `neon-http` (решение №22) не ходит в обычный Postgres, пришлось бы возвращать второй драйвер. Минус - зависимость от Neon API и лимит веток free-tier (поэтому удаление обязательно `always()`). Локальные тесты остаются на статичном `test`-бранче.
