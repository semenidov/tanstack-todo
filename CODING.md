# Правила написания кода

Только то, в чём наш выбор отличается от поведения модели по умолчанию: уроки из код-ревью и антипаттерны. Общие практики сюда не пишем.

Формат: правило → почему → плохо / хорошо → источник. Новый урок из ревью добавляется сюда в том же PR, где исправлено замечание.

## React

### Флаг «отрендерено на клиенте» - через `useSyncExternalStore`, не `useEffect` + `setState`

Почему: `useEffect` с `setState` даёт лишний рендер при каждом монтировании, в том числе при клиентской навигации. `useSyncExternalStore` с серверным снапшотом `false` перерисовывает один раз только после гидрации, а при последующих монтированиях сразу возвращает `true`.

```tsx
// плохо
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

// хорошо
const subscribe = () => () => {};
function useHydrated() {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );
}
```

Источник: #24.

### Производное состояние - вычислять при рендере, не хранить в `useState` + `useEffect`

Почему: лишний рендер и рассинхрон на один кадр.

```tsx
// плохо
const [count, setCount] = useState(0);
useEffect(() => setCount(countCompleted(todos)), [todos]);

// хорошо
const count = countCompleted(todos);
```

### Данные - через loader и TanStack Query, не `useEffect` + `fetch`

Почему: теряются SSR, кэш, отмена и состояния ошибок. Паттерн проекта: `queryOptions` в `src/lib/*-query.ts`, `loader` в роуте, `useSuspenseQuery` в компоненте.

## TypeScript

### Фиксированный набор значений - `enum`, без разбросанных строковых литералов

Почему: одно место для значений, опечатки ловит компилятор, поиск по использованиям работает. Строковый enum, если значения уходят во внешнюю библиотеку (next-themes и т. п.).

```ts
// плохо
if (theme === 'light') ...
const next = { light: 'dark', dark: 'system', system: 'light' } as const;

// хорошо
enum Theme { Light = 'light', Dark = 'dark', System = 'system' }
const NEXT_THEME: Record<Theme, Theme> = { ... };
```

Источник: #24.

### Без `any`, `as` и `!` для подавления ошибок типов

Почему: прячут реальную ошибку до рантайма. Неизвестные данные - `unknown` + сужение (или схема валидации), отсутствующее значение - явная проверка.

```ts
// плохо
const data = (await res.json()) as Todo[];
const user = session!.user;

// хорошо
const data = todoListSchema.parse(await res.json());
if (!session) throw redirect({ to: '/login' });
```

Допустимо: `as const`, `satisfies`, `as` в тестах для моков.

### `eslint-disable` и `@ts-expect-error` - только с причиной в том же комментарии

```ts
// плохо
// eslint-disable-next-line
// хорошо
// eslint-disable-next-line react-hooks/exhaustive-deps -- router instance is stable
```
