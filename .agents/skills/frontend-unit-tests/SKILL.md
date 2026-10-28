---
name: frontend-unit-tests
description: Conventions and patterns for unit tests in frontend/ (React 19, TanStack Query, styled-components, Vitest, jsdom, Testing Library). Use when writing or updating tests for any file under frontend/src.
---

# Frontend unit tests

## Iron rules

- Tests live next to the source file: `TodoItem.tsx` -> `TodoItem.test.tsx`, `todos.ts` -> `todos.test.ts`.
- Only `*.test.ts` and `*.test.tsx` files under `frontend/src/` may be created or changed.
- Query the DOM the way a user does: `getByRole` with an accessible name first, then `getByLabelText`, `getByText`. Avoid test ids and class names.
- Interact with `userEvent.setup()`, not `fireEvent`.
- Reuse `src/test/todoFixture.ts` (`todoFixture`) and override fields with spread: `{ ...todoFixture, completed: true }`.

## Running

Agents run tests with the `run-tests` skill. Developers can also use the package scripts in `frontend/` (`npm test`, `npm run test:coverage`); both use the same `vite.config.ts`, so results match.

## Style

Prettier settings of the package: no semicolons, single quotes, trailing commas, 2-space indent, imports from `vitest` explicit (`import { expect, it, vi } from 'vitest'`). You cannot run Prettier, so write it in this style directly.

## Patterns

**Components**: mock the design system with its ready-made mocks, so tests do not depend on styled-components:

```tsx
vi.mock('../../../design-system', () => import('../../../design-system/mocks'))
```

Adjust the relative path to the test location. Pass callbacks as `vi.fn()` and assert they are (or are not) called.

**Pages and containers** (e.g. `TodosPage`): mock the hooks and child components with `vi.mock` and control them with `vi.mocked(hook).mockReturnValue(...)`, as in `TodosPage.test.tsx`.

**Query and mutation hooks**: render with `renderHook` and a fresh `QueryClient` per test, retries off, and mock the API module:

```tsx
vi.mock('../api/todos', () => ({ todosApi: { list: vi.fn(), create: vi.fn() } }))

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }
}
```

Use `waitFor` for async results; assert on returned data and on the cache (`client.getQueryData(todoKeys.list)`) for mutations that update it. Hook tests using JSX must be `.test.tsx`.

**API modules** (`features/todos/api`): mock `lib/http` (`vi.mock('../../../lib/http', () => ({ request: vi.fn() }))`) and assert the path, method and body sent.

**HTTP client** (`lib/http.ts`): stub `fetch` with `vi.stubGlobal('fetch', vi.fn())` and restore with `vi.unstubAllGlobals()`. Cover success, 204, 422, other errors with and without `detail`, network failure and aborted requests.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `No QueryClient set` | Hook rendered without a provider | Use the wrapper above |
| Styled-components or theme errors | Real design system rendered | Mock `design-system` with its mocks |
| `act(...)` warnings or flaky assertions | Async update not awaited | `await user...` and `await waitFor(...)` / `findBy...` |
| Element not found by role | Missing accessible name in the component | Query by the text the user sees; report the accessibility gap in the summary |

## Success token

`[FRONTEND-TESTS-READY]`: tests follow these conventions and pass with `node scripts/run-tests.mjs --pkg frontend`.
