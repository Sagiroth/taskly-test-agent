import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkChanges, parseStatus } from '../lib/guard.mjs';

const status = (...fields) => `${fields.join('\0')}\0`;

test('accepts new and changed test files and shared fixtures', () => {
  const result = checkChanges(
    parseStatus(
      status(
        ' M backend/tests/router.test.ts',
        '?? backend/tests/health.test.ts',
        '?? frontend/src/features/todos/TodoBadge.test.tsx',
        ' M backend/tests/fixture.ts',
        ' M frontend/src/test/todoFixture.ts',
      ),
    ),
  );

  assert.equal(result.ok, true);
  assert.equal(result.changed.length, 5);
});

test('rejects application code, config, tooling, the global test setup and test files in the repository root', () => {
  const result = checkChanges(
    parseStatus(
      status(' M backend/src/app.ts', '?? .opencode/agents/evil.md', ' M frontend/vite.config.ts', ' M scripts/run-tests.mjs', '?? root.test.ts', ' M frontend/src/test/setup.ts'),
    ),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map((violation) => violation.path),
    ['backend/src/app.ts', '.opencode/agents/evil.md', 'frontend/vite.config.ts', 'scripts/run-tests.mjs', 'root.test.ts', 'frontend/src/test/setup.ts'],
  );
});

test('rejects deleted test files, including the old path of a rename', () => {
  const result = checkChanges(parseStatus(status(' D backend/tests/router.test.ts', 'R  backend/tests/new.test.ts', 'backend/tests/old.test.ts')));

  assert.deepEqual(result.violations, [
    { path: 'backend/tests/router.test.ts', reason: 'test file deleted' },
    { path: 'backend/tests/old.test.ts', reason: 'test file deleted' },
  ]);
});

test('handles paths with spaces', () => {
  assert.deepEqual(parseStatus(status('?? backend/tests/with space.test.ts')), [{ status: 'A', path: 'backend/tests/with space.test.ts' }]);
});
