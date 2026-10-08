# run-stats: схема v1

JSON прогона фичи - скрытый блок `<!-- run-stats:json ... -->` в комментарии `[run report]` PR. Время - ISO UTC, длительности - минуты (1 знак). Поля с пометкой «сессия» заполняет основная сессия; `render.mjs` не пропустит пустые.

```jsonc
{
    "schema": 1,
    "issue": 84,
    "pr": 110,
    "process_sha": "76b556e", // последний коммит CONTRIBUTING.md / CODING.md / .claude/agents на базе PR
    "started": "…",
    "approved": "…", // старт implementer → апрув владельца
    "totals": {
        "wall_min": 0, // started → approved
        "impl_work_min": 0,
        "impl_wait_min": 0,
        "rounds": 2,
        "verdicts": ["changes", "ok"],
        "ci": { "runs": 6, "success": 5, "failure": 0, "cancelled": 1 },
        "local": {
            "runs": 33,
            "pass": 12,
            "fail": 15,
            "no_tests": 2,
            "crash": 4,
            "flaky": 0,
            "expected_red": 3,
        },
        // по всему транскрипту implementer (см. «Токены и стоимость»)
        "impl_tokens": {
            "input": 0,
            "cache_write_5m": 0,
            "cache_write_1h": 0,
            "cache_read": 0,
            "output_est": 0,
        },
        "impl_cost_usd": {
            "input": 0,
            "cache_write": 0,
            "cache_read": 0,
            "output_est": 0,
            "total": 0,
            "output_estimated": true,
            "models": ["claude-opus-5-5"],
            "prices_as_of": "2026-09-25",
        }, // null - нет цен для модели
        "cache": {
            "writes": 0, // Σ cache_creation_input_tokens
            "growth": 0, // Σ прироста контекста между запросами
            "rewrite_ratio": 5.88, // writes / growth; ~1 - контекст записан один раз
            "misses": 6,
            "lost_tokens": 0,
            "overpay_usd": 0,
            "by_cause": { "ttl": { "misses": 0, "lost_tokens": 0, "overpay_usd": 0 }, "prefix": { … } },
            "by_kind": { "wait_ci": { "misses": 0, "lost_tokens": 0, "overpay_usd": 0 } } // kind этапа с паузой
        }
    },
    "stages": [
        {
            "round": 1,
            "actor": "impl",
            "kind": "build",
            "name": "Ядро: гостевой вход", // сессия (collect даёт черновик)
            "start": "…",
            "end": "…",
            "min": 21,
            "runs": [
                {
                    "type": "integration",
                    "result": "fail",
                    "at": "…",
                    "error": { "class": "env", "text": "fetch failed к Neon" },
                },
            ], // error - сессия, для result != pass
            "tokens": {
                "input": 0,
                "cache_write_5m": 0,
                "cache_write_1h": 0,
                "cache_read": 0,
                "output_est": 0,
            }, // только impl
            // промахи кэша, если пауза пришлась на этот этап (impl или triage)
            "cache_misses": [{ "at": "…", "gap_min": 8.5, "lost": 170931, "cause": "ttl", "overpay_usd": 0.82 }],
            "ref": "945ac4c", // CI/verify: SHA; verify: вердикт в "verdict"
        },
    ],
    "findings": [
        {
            "id": "F1",
            "round": 1,
            "severity": "should",
            "title": "…",
            "outcome": "fixed", // сессия
            "spec_ref": "edge:7", // сессия
            "spec_check": "manual", // сессия
        },
    ],
}
```

## Токены и стоимость

- Входная часть usage (`input`, `cache_write_5m/1h`, `cache_read`) - точная, из транскрипта implementer.
- `output_est` - оценка: точный output есть только у сообщений с финальным usage (на #84 - 12 из 102); для остальных - видимые символы × (токены/символ финальных сообщений). Thinking в транскрипте скрыт, но оплачивается, поэтому погрешность большая в обе стороны.
- Стоимость - эквивалент по ценам API, не расход подписки (формула лимитов Pro/Max в токенах не публикуется).
- Цены ($ за 1 млн, справка Claude API на 2026-09-25; при смене цен - новая строка и дата, `prices_as_of` в отчёте):

| Модель            | input | запись кэша 5 мин (1,25×) | запись кэша 1 ч (2×) | чтение кэша | output |
| ----------------- | ----- | ------------------------- | -------------------- | ----------- | ------ |
| claude-opus-5-5   | 4     | 5                         | 8                    | 0,20        | 20     |
| claude-sonnet-5-5 | 2     | 2,5                       | 4                    | 0,20        | 10     |

- Не входит: verifier (workflow не публикует usage), основная сессия.

## Кэш: перезапись контекста

- Контекст запроса = `input + cache_write + cache_read`. Запрос, прочитавший из кэша меньше контекста предыдущего (на ≥ 1024 токена), потерял префикс и записал его заново - **промах**, `lost` = контекст предыдущего − прочитано.
- `cause`: `ttl` - пауза от предыдущего ответа до запроса длиннее TTL перезаписи (5 мин, у записи с 1 ч - 60 мин); `prefix` - пауза короче TTL, префикс изменился.
- `overpay_usd` = `lost` × (цена записи − цена чтения кэша), по модели запроса.
- Промах относится к этапу, на который пришлась пауза: между раундами - `triage` (иначе следующий этап impl), внутри раунда - этап impl, содержащий середину паузы (долгий тест - `build`/`e2e`, ожидание CI - `wait_ci`).
- Считается по каждому транскрипту отдельно (новый запуск агента - новый контекст).

## Словари

### actor

`impl` implementer · `ci` CI · `verifier` verify.yml · `main` основная сессия · `owner` владелец.

### kind (режим: W работа, ⏳ ожидание)

| kind      | режим | что                                   | как определяется (collect)                                         |
| --------- | ----- | ------------------------------------- | ------------------------------------------------------------------ |
| `explore` | W     | чтение до первой правки               | вызовы без правок до первой правки захода                          |
| `schema`  | W     | схема, миграции                       | `drizzle-kit`, `db:generate`, `ALTER`, файлы `drizzle/`, `src/db/` |
| `build`   | W     | код + unit/integration одного куска   | остальная работа                                                   |
| `e2e`     | W     | e2e-тесты                             | файлы `e2e/`, `playwright`                                         |
| `docs`    | W     | DOCUMENTATION, DECISIONS, описание PR | эти файлы, `gh pr edit --body`                                     |
| `ship`    | W     | commit, push, PR, метки               | `git commit/push`, `gh pr create`, метки                           |
| `wait_ci` | ⏳    | implementer ждёт CI                   | `gh pr checks --watch`, `gh run watch`                             |
| `ci`      | ⏳    | прогон CI                             | `gh run list` (workflow CI)                                        |
| `verify`  | ⏳    | прогон verifier                       | `gh run list` (workflow Verify)                                    |
| `triage`  | W     | основная сессия: вердикт → правки     | от комментария `[verifier]` до старта следующего захода impl       |
| `accept`  | ⏳    | приёмка владельцем                    | ready → апрув                                                      |

Чтение посреди работы относится к текущему этапу. Время между вызовами (размышления модели) относится к этапу следующего вызова.

### run.type

`unit` · `integration` (`*.integration.test.ts` или проект integration) · `e2e` (playwright) · `typecheck` · `lint` · `migrate` (drizzle-kit, ALTER).

### run.result

`pass` · `fail` · `no_tests` (фильтр/путь ничего не нашёл) · `crash` (не дошёл до тестов: сеть, компиляция, таймаут команды) · `flaky` (авто: та же команда упала, затем прошла без правок между ними) · `expected_red` (сессия: red-фаза red-green).

### error.class (сессия) + text (≤ 80 символов, без стектрейса)

`env` окружение (сеть, Neon, прокси, кодировка) · `tooling` команда/фильтр/путь/конфиг · `test` ошибка в тесте (селектор, ожидание, таймаут) · `code` баг продукта, найденный тестом · `flaky` · `spec` неясность спеки · `expected` red-фаза.

### Находки verifier

- `severity`: `blocker` · `should` · `nit` (из `verifier:json`).
- `outcome`: `fixed` · `fixed_by_owner` · `rejected_false` · `skipped_nit`.
- `spec_ref`: `criterion:N` · `edge:N` · `plan` · `coding` · `none`.
- `spec_check` (как спека велела проверять): `test` · `manual` · `none`.

### Раунды и вердикты

- Раунд 1 - работа до первого прогона verifier; раунд N - после N-1 вердикта «правки» или фидбэка владельца.
- `verdict`: `ok` · `changes` · `not_formed` · `escalated`.
