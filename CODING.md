# Правила написания кода

Только уроки из код-ревью и антипаттерны, без общих практик. Формат: правило - почему (источник). Пример кода - только если без него правило неоднозначно.

## React

- Флаг «отрендерено на клиенте» - через `useSyncExternalStore`, не `useEffect` + `setState`: без лишнего рендера при каждом монтировании (#24).
    ```ts
    const subscribe = () => () => {};
    const useHydrated = () =>
        useSyncExternalStore(
            subscribe,
            () => true,
            () => false,
        );
    ```
- Производное состояние вычислять при рендере, не хранить в `useState` + `useEffect`.
- Данные - через `loader` + TanStack Query (`queryOptions` в `src/lib/*-query.ts`), не `useEffect` + `fetch`.

## TypeScript

- Фиксированный набор значений - строковый `enum`, без разбросанных литералов; карты по нему - `Record<Enum, T>` (#24).
- Без `any`, `as` и `!` для подавления ошибок типов: `unknown` + сужение или схема, явная проверка на отсутствие. Можно: `as const`, `satisfies`, моки в тестах.
- `eslint-disable` / `@ts-expect-error` - только с причиной: `// eslint-disable-next-line <rule> -- <почему>`.

## Тесты

- Чистые функции в `src/lib/*.ts` - с unit-тестами рядом (`*.test.ts`) в том же PR (#41).
- Временный id оптимистичной сущности - через `createTempId()` из `src/lib/boards.ts`; пока id временный, действия над сущностью заблокированы (#41).
