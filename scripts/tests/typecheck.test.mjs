import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTypecheck } from '../lib/typecheck.mjs';

test('reads located errors with repo-relative paths and skips their detail lines', () => {
  const output = [
    "src/features/todos/hooks/useTodoFilters.test.ts(58,29): error TS2322: Type '{ priority: \"high\" }' is not assignable.",
    "  Types of property 'priority' are incompatible.",
    "src/lib/http.ts(3,1): error TS2304: Cannot find name 'x'.",
  ].join('\n');

  assert.deepEqual(parseTypecheck(output, 'frontend'), {
    ok: false,
    count: 2,
    errors: [
      { file: 'frontend/src/features/todos/hooks/useTodoFilters.test.ts', line: 58, code: 'TS2322', message: "Type '{ priority: \"high\" }' is not assignable." },
      { file: 'frontend/src/lib/http.ts', line: 3, code: 'TS2304', message: "Cannot find name 'x'." },
    ],
  });
});

test('keeps errors without a location, such as a broken tsconfig', () => {
  assert.deepEqual(parseTypecheck("error TS5083: Cannot read file 'tsconfig.json'.", 'backend').errors, [
    { file: null, line: null, code: 'TS5083', message: "Cannot read file 'tsconfig.json'." },
  ]);
});

test('is ok for clean output and caps the number of listed errors', () => {
  assert.deepEqual(parseTypecheck('', 'backend'), { ok: true, count: 0, errors: [] });

  const many = Array.from({ length: 30 }, (_, index) => `src/a.ts(${index + 1},1): error TS1: e`).join('\n');
  const result = parseTypecheck(many, 'backend');
  assert.equal(result.count, 30);
  assert.equal(result.errors.length, 20);
});
