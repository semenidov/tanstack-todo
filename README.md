# Todo List

Full-stack task board on TanStack Start - Trello-like boards, lists and cards. [Live demo](https://todo-semenidov.vercel.app)

[![CI](https://github.com/semenidov/tanstack-todo/actions/workflows/ci.yml/badge.svg)](https://github.com/semenidov/tanstack-todo/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154?logo=tanstack)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)

<!-- screenshots: light / dark - to be added -->

## Stack

- [TanStack Start](https://tanstack.com/start) - SSR, server functions
- [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query)
- React 19
- [Better Auth](https://www.better-auth.com/)
- [Drizzle ORM](https://orm.drizzle.team/) + Neon Postgres
- Tailwind CSS v4 + shadcn/ui
- Vitest + Playwright
- Sentry, Vercel Analytics

## Engineering highlights

- Integration and E2E each migrate an isolated Neon branch before running in CI. Previews share `staging` and migrate it before building. Production migrations run in CI after checks pass on `master`. [Decision #26](DECISIONS.md#26-2026-09-19--тесты-в-ci---на-временной-neon-ветке-на-прогон), [decision #57](DECISIONS.md#57-2026-10-02--общая-превью-база-для-всех-pr), [decision #27](DECISIONS.md#27-2026-09-19--миграции-прода---шагом-ci-после-зелёных-проверок)
- Board operations check the user's role before accessing the repository. SQL also limits access to boards the user owns or has joined. Integration tests cover access isolation. [Decision #83](DECISIONS.md#83-2026-10-27--доступ-к-доске---шлюз-по-роли-карта-прав-пропуск-в-репозиторий-140)
- Optimistic edits, server-confirmed creation and immediate soft delete with Undo - [decision #55](DECISIONS.md#55-2026-09-30--мягкое-удаление-колонок-и-карточек-49), [decision #56](DECISIONS.md#56-2026-09-30--создание-без-оптимизма---в-кэше-только-то-что-есть-на-сервере-59)
- Sentry wired with source maps via the Vite plugin, plus Vercel Analytics with normalized URLs - [decision #38](DECISIONS.md#38-2026-09-25--vercel-web-analytics--speed-insights)
- Playwright covers auth, route guards and data isolation in a separate CI job. [Decision #28](DECISIONS.md#28-2026-09-23--e2e-на-playwright), [decision #81](DECISIONS.md#81-2026-11-07--integration-и-e2e-параллельно-155)
- Agent-assisted workflow: the owner approves a spec and accepts the PR on preview; an implementer subagent builds the feature and CI checks it - [`CONTRIBUTING.md`](CONTRIBUTING.md#процесс-фичи), [`CODING.md`](CODING.md)

## Architecture

```mermaid
flowchart LR
    Browser -->|HTTPS| Vercel[Vercel: TanStack Start SSR + server functions]
    Vercel --> Neon[(Neon Postgres)]
    Vercel --> BetterAuth[Better Auth]
    Vercel --> Sentry[Sentry]
    GHA[GitHub Actions] -->|ephemeral branch| Neon
    VercelPreview[Vercel preview deploy] -->|preview branch| Neon
```

## Getting started

```bash
npm ci
docker compose up -d
npm run db:migrate
npm run dev
```

Requires Docker and a `.env` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/main` and `BETTER_AUTH_SECRET`. Local development uses Docker Postgres; CI, previews and production use Neon.

For integration and e2e, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test` in `.env.test` and `.env.e2e`; set `BETTER_AUTH_SECRET` in `.env.e2e`. Migrate the test database on a fresh volume, then run tests:

```bash
npx drizzle-kit migrate --config=drizzle.config.test.ts
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Docs

- [DOCUMENTATION.md](DOCUMENTATION.md) - project map
- [DECISIONS.md](DECISIONS.md) - decision log (ADR)
- [CONTRIBUTING.md](CONTRIBUTING.md) - GitHub workflow
- [CODING.md](CODING.md) - code review lessons
