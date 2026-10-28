---
name: backend-unit-tests
description: Conventions and patterns for unit tests in backend/ (Express 5, Prisma, Zod, Vitest, supertest). Use when writing or updating tests for any file under backend/src.
---

# Backend unit tests

## Iron rules

- Tests live in `backend/tests/` as `<subject>.test.ts`; never next to the source.
- No real database: tests must pass without PostgreSQL. Mock Prisma or the repository.
- Import application code with the `.ts` extension: `import { createTodosRouter } from '../src/features/todos/router.ts';`
- Reuse `backend/tests/fixture.ts` (`record` is a database row, `todo` is the API shape). Extend it only when a new field is needed by several tests.
- Only `.ts` test files under `backend/tests/` may be created or changed.

## Style

- Semicolons, single quotes. Match the file you edit: flat `it(...)` blocks (`router.test.ts`) or a `describe` group (`validators.test.ts`).
- `it.each` for input variants, as in `router.test.ts`.
- `afterEach(() => vi.restoreAllMocks())` when using `vi.spyOn`.

## Patterns

**Router** (`createTodosRouter`): mount on a fresh Express app with a fake repository object and call it with supertest.

```ts
function setup() {
  const repository = { list: vi.fn(), create: vi.fn(), get: vi.fn(), update: vi.fn(), delete: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use('/api/todos', createTodosRouter(repository));
  return { app, repository };
}
```

Assert status code, response body and what the repository was (or was not) called with.

**Repository** (`TodoRepository`): build the real Prisma client with `createDatabase('postgresql://test:test@localhost:5432/test')` and spy on its delegate (`vi.spyOn(database.todo, 'findMany').mockResolvedValue([record])`). No connection is opened.

**Validators and mappers**: plain function tests with `parse` / `safeParse`, covering defaults, trimming, boundaries and rejected values. Both files have 100% coverage thresholds; keep them at 100%.

**App factory** (`createApp`): pass a fake `Database` object and test cross-cutting behaviour with supertest: unknown routes return 404 `{ detail: 'Not Found' }`, invalid JSON returns 422, oversized body returns 413, unexpected errors return 500 (silence `console.error` with a spy).

**Config and lifespan**: functions that read `process.env` get explicit values in the test; set variables with `vi.stubEnv` and call `vi.unstubAllEnvs()` after each test. Never depend on the developer's real environment.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `Cannot find module ... .js` | Wrong extension in a test import | Import `.ts` from tests |
| Test tries to connect to PostgreSQL | Database call not mocked | Spy on the Prisma delegate or use a fake repository |
| Coverage threshold error for validators or mappers | A branch lost coverage | Add the missing case; never lower thresholds |

## Success token

`[BACKEND-TESTS-READY]`: tests follow these conventions and pass with `node scripts/run-tests.mjs --pkg backend`.
