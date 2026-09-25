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

## 27. 2026-09-19 · Авто-миграции на прод в CI

Джоба `migrate`: только на push в `master`, `needs: [quality, unit, integration]` (не катим на красных), `drizzle-kit migrate` на Neon main через секрет `NEON_MAIN_DATABASE_URL` (**direct**, не pooled - решение №24). Идемпотентна: нет новых миграций - no-op. Закрывает разрыв «код на Vercel уехал, схема осталась старой». Нюанс: Vercel деплоит по git-событию параллельно с этой джобой (не координируем таймингом) - безопасно при обратно-совместимых (expand/contract) миграциях; разрушительные разбиваем на два релиза. Альтернатива (деплой внутри Actions с `needs: migrate`) отвергнута как лишняя работа для нашего масштаба.

## 28. 2026-09-23 · E2E на Playwright (P0: auth/гварды/изоляция)

Отдельная папка `e2e/`, только Chromium, `workers: 1` (тесты делят одну Neon-ветку `e2e` → последовательно). `webServer` сам поднимает app на `127.0.0.1:3100` (не `localhost` - иначе Node-проверка готовности стучит в `::1`, а vite слушает `127.0.0.1` → таймаут; Windows). `DATABASE_URL` в `webServer.env` нацелен на ветку `e2e` (не main!), `BETTER_AUTH_URL` = тестовый origin. `.env.e2e` (+`TEST_DB` не нужен - это не vitest). Gotcha: клик по сабмиту ДО гидрации = нативная отправка формы (креды в URL, API не зовётся) → в хелперах `gotoHydrated` ждёт `networkidle` перед действиями. `trace: 'retain-on-failure'`.

## 29. 2026-09-23 · method="post" на формах (минимум против утечки в URL)

Форма без `method` дефолтит в GET → до-гидрационный нативный сабмит уносит поля (в т.ч. пароль) в query-строку URL (логи/история/Referer). `method="post"` кладёт их в тело - утечки в URL нет даже до гидрации. Полный progressive enhancement (реальный серверный action, работающий без JS) отложен как избыточный для учебного; `method="post"` - обязательный минимум.

## 30. 2026-09-23 · E2E: логин один раз через setup-проект + storageState

Отдельный проект `setup` (`auth.setup.ts`) один раз чистит БД, регистрирует юзера и сохраняет сессию в `e2e/.auth/user.json`. Проект `crud` (`todos.spec`) переиспользует её (`storageState`, `dependencies: ['setup']`) - не логинится в каждом тесте; между тестами чистит только `todos` (не юзеров - иначе сессия из setup протухнет). Проект `auth-flows` (`auth`/`isolation.spec`) - без storageState (тестируют сам вход) и БЕЗ reset: уникальные email + скоуп по userId изолируют тесты сами. Причина - E2E дорогой, повтор регистрации в каждом тесте = основная трата; setup+storageState даёт «атомарность без платы за setup». Journey-в-один-тест отвергнут: fail-fast маскирует, какой шаг сломался.

## 31. 2026-09-23 · E2E-джоба в CI (эфемерная ветка + браузер)

Джоба `e2e`: `needs: [quality, unit, integration]` (не жечь браузер на битом коде), на PR и master. Ставит Chromium (`playwright install --with-deps`), создаёт эфемерную ветку `e2e-<run_id>` (схема от main, удаление `if: always()`), гонит `test:e2e` с `DATABASE_URL` ветки + `BETTER_AUTH_SECRET` из GitHub-секрета (не литерал - гигиена для публичного репо). Gotcha: `create-branch-action@v5` объявляет вход `username` как required (роль Neon, `--role-name`) - без него линтер ругается (в рантайме GitHub composite-required не форсит, но добавили явно `username: neondb_owner`). При падении - артефакт `playwright-report` (в CI reporter = `github` + `html`, иначе HTML не генерится). E2E на каждый PR (гейт до мержа), не только master - PR-ов мало, 5 мин не жалко. Контейнер Postgres не нужен (neon-http + ветка).

## 32. 2026-09-24 · Observability: Sentry для ошибок (Фаза 1)

`@sentry/tanstackstart-react` (v11, бета). Только ошибки: `tracesSampleRate: 0`, без replay/feedback (квота + приватность). Точки входа: `src/instrument.client.ts` (импортится первым в `src/client.tsx`), `src/instrument.server.ts` (первым в `src/server.ts`, fetch обёрнут `wrapFetchWithSentry` - Vercel-вариант без `--import`), глобальные middleware в `src/start.ts` (ловят ошибки server fns), `captureException` в `RouteError`. DSN из env; без DSN SDK - no-op (dev/тесты/CI ничего не шлют). `release` = `VERCEL_GIT_COMMIT_SHA`, `environment` = `VERCEL_ENV`; клиенту прокинуты через `define` в `vite.config.ts` (Vercel отдаёт их только в env билда). PII: в v11 `sendDefaultPii` заменён на `dataCollection`, и дефолты шире (тела запросов, куки, заголовки, данные DB-запросов, локальные переменные стек-фреймов) - для нас это пароли/токены сессии, поэтому явно всё выключено (`src/lib/sentry.ts`). Gotcha: шаблонный `nitro({ rollupConfig: { external: [/^@sentry\//] } })` оставлял Sentry внешним, но Nitro не трассировал его в `.output` → на Vercel `Cannot find module` и лёг бы весь прод; `external` убран (он нужен только для режима `--import`). Отложено (Фаза 2): source maps (Vite-плагин + `SENTRY_AUTH_TOKEN`), `setUser({ id })`.

## 33. 2026-09-24 · Проверки после правок не гоняем

Claude не запускает тесты/typecheck/lint после каждого изменения - пользователь прогоняет их сам на commit/push (husky pre-commit/pre-push + CI). Запуск - только по явной просьбе или для диагностики конкретной ошибки. Причина - лишние прогоны тратят время; гарантию и так дают хуки и CI.

## 34. 2026-09-25 · CSRF-middleware на server fns

В `src/start.ts` добавлен `createCsrfMiddleware({ filter: handlerType === 'serverFn' })` - server fns это same-origin RPC-эндпоинты, cross-site вызовы отбиваются. Раньше полагались только на куку сессии `SameSite=Lax` (она не уходит с cross-site POST) - это защищает, но одним слоем; middleware даёт второй, не зависящий от поведения браузера и настроек кук. Альтернатива - выключить предупреждение Start (`disableCsrfMiddlewareWarning`) - отвергнута: дешёвая защита, причин отказываться нет. Порядок: Sentry-middleware первым, чтобы оборачивать и CSRF-отказы.

## 35. 2026-09-25 · Source maps в Sentry через Vite-плагин (Фаза 2)

`sentryTanstackStart` в `vite.config.ts`: сам включает `build.sourcemap: 'hidden'`, после билда грузит карты в Sentry и удаляет `.map` из сборки - исходники не публикуются, а стеки в Sentry читаемые (`todo-list.tsx:42` вместо `index-x7f.js:1`). Плагин подключается только при наличии `SENTRY_AUTH_TOKEN` (секрет, env билда на Vercel вместе с `SENTRY_ORG`/`SENTRY_PROJECT`) - локально и в CI (там не собираем прод) ничего не грузится и сборка не ломается без токена. `autoInstrumentMiddleware: false` - плагин иначе переписывает массивы middleware в `start.ts` ради перф-трейсинга, а трейсинг выключен (`tracesSampleRate: 0`). Альтернатива - заливать карты из GitHub Actions через `sentry-cli` - отвергнута: прод собирает Vercel, грузить надо из того же билда.

## 36. 2026-09-25 · Динамический baseURL Better Auth для деплоев Vercel

Статичный `BETTER_AUTH_URL` = прод давал "Invalid origin" на preview-деплоях (у каждого свой хост) и уводил ссылки/редиректы на прод. Теперь `baseURL: { allowedHosts, fallback, protocol }` (Better Auth 1.7): хост запроса из списка становится baseURL, а все allowedHosts - доверенными origin. Хосты: прод `todo-semenidov.vercel.app` всегда; `tanstack-todo-*-ssemenidov.vercel.app` (деплои и ветки, адреса от имени проекта + scope `ssemenidov`) - только при `VERCEL_ENV=preview`; `localhost:3000`/`127.0.0.1:3100` (dev/E2E) - только вне Vercel. `protocol` явно: https на Vercel, http локально (`'https'` ломал бы localhost, `'auto'` зависит от `request.url` за прокси). Маска не пускается в прод, потому что её обходит команда со слагом `*-ssemenidov` - CSRF это не даёт (`vercel.app` в Public Suffix List, Lax-кука не уйдёт), но даёт доверенный редирект после логина на чужой сайт. Отвергнуто: `*.vercel.app` (пример из доков Better Auth - доверие любому деплою Vercel); только `trustedOrigins` (не чинит ссылки/редиректы на прод); `BETTER_AUTH_URL` из `VERCEL_URL` (у деплоя два адреса - хеш и ветка, подхватится один). Связано: у Preview в Vercel должен быть свой `DATABASE_URL`, иначе превью пишут в прод-базу.

## 37. 2026-09-25 · БД для превью - интеграция Neon-Managed (ветка на git-ветку)

Раньше Preview в Vercel не имел переменных (превью падали), а общий `DATABASE_URL` пустил бы превью в прод-базу. Подключена Neon-Managed интеграция (для существующего проекта, биллинг в Neon; не Vercel-Managed - та создаёт новый проект): на preview-деплой webhook создаёт ветку `preview/<git-ветка>` от `main` и подставляет `DATABASE_URL`/`DATABASE_URL_UNPOOLED` в этот деплой. Проверено: первый деплой ветки получает базу сразу, без Redeploy. Ветка - снимок прод-данных (реальные юзеры) и дальше изолирована; для пета принято, при реальных пользователях - маскирование/schema-only или хотя бы Deployment Protection. Автоудаление веток включено (срабатывает при следующем preview-деплое). У Preview свой `BETTER_AUTH_SECRET` (секреты окружений не делим). Не сделано: миграции на превью-ветках (`vercel-build` с `drizzle-kit migrate` через `DATABASE_URL_UNPOOLED`) - нужно, когда в PR появится изменение схемы.

## 38. 2026-09-25 · Vercel Web Analytics + Speed Insights

Просмотры/источники (Web Analytics) и Core Web Vitals с реальных визитов (Speed Insights, p75) - компоненты `@vercel/analytics/react` и `@vercel/speed-insights/react` в корневом роуте. Отдельной интеграции под TanStack Start нет, у React-варианта нет поддержки роутов, поэтому `beforeSend` нормализует `/edit/<uuid>` → `/edit/[todoId]` (группировка в отчёте + id задач не уходят в Vercel). Без cookies - баннер не нужен; кастомные события только на Pro. Speed Insights взят ради практики/портфолио: при малом трафике перцентили шумные. Альтернативы (PostHog, Plausible) отложены - для пета встроенного хватает.

## 39. 2026-09-25 · Процесс работы с GitHub: issue → ветка → PR, squash-мерж

Доработки обсуждаем в чате, агент оформляет issue (после «ок» владельца), делает ветку и открывает PR; ревьюит и мержит только владелец. Доступ к GitHub - через MCP-сервер (issues, PR, логи CI); коммиты и push - обычным git. Конвенции - в `CONTRIBUTING.md` (в `CLAUDE.md` только ссылка на него): артефакты на английском, ветки `type/<issue>-slug`, Conventional Commits, заголовок PR = итоговый коммит. Мерж - только squash (в репо отключены merge commit и rebase, ветки удаляются после мержа): в ветке коммиты для ревью, в `master` - один коммит на задачу. PR-шаблон заточен под удобство ревью (ручные действия наверху, карта чтения, зона риска, шаги проверки на превью). Issue - формы (`.yml`) с обязательными полями, пустые issues запрещены. Метки создаются автоматически при первом назначении. Отложено: CI-проверка формата коммитов/заголовков, авто-changelog, протокол реакции на ревью и агент в GitHub Actions - смотрим по простому флоу.

## 40. 2026-09-25 · Тело issue на русском (уточняет №39)

Описание задачи (Context, Goal, Acceptance criteria, Out of scope, поля Bug-формы) пишем на русском - владелец так читает быстрее. Заголовок issue, ветки, коммиты и PR остаются на английском: они видны в истории, списках и squash-коммитах.

## 42. 2026-09-25 · План на сильной модели, исполнение - субагент на Sonnet

Реализация #12-#16 одним фоновым агентом на Opus вышла дорогой: пять задач в одном растущем контексте, разведка кодовой базы с нуля, сильная модель на механической работе. Теперь: основная сессия (Opus) пишет в issue «Implementation plan» и ревьюит дифф, реализацию делает субагент `implementer` (Sonnet, ограниченные инструменты, точечное чтение, одна задача за запуск, короткий PR). Главная экономия - от точного плана и короткого контекста, а не от цены модели: с размытым планом дешёвая модель блуждает и ошибается. Отдельный агент на Haiku - когда появятся чисто механические задачи. Номер 41 занят решением из PR #17.
## 43. 2026-09-25 · Удаление Neon preview-ветки при закрытии PR (уточняет №37)

Интеграция удаляет `preview/<ветка>` только при следующем preview-деплое, поэтому после мержа ветки копились и упирались в лимит Neon - CI не мог создать `ci-<run_id>`. Workflow `neon-preview-cleanup.yml` на `pull_request: closed` удаляет ветку через `neonctl`; если ветки нет (PR без preview), job успешен, остальные ошибки его валят. Имя ветки передаётся через env (защита от script injection). Официальный `delete-branch-action` не взят: на отсутствующей ветке он падает. Ночная чистка осиротевших веток отложена.
