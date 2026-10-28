import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAddedLines } from '../lib/diff.mjs';

test('collects every line of a new file', () => {
  const diff = [
    'diff --git a/backend/src/new.ts b/backend/src/new.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/backend/src/new.ts',
    '@@ -0,0 +1,3 @@',
    '+a',
    '+b',
    '+c',
  ].join('\n');

  assert.deepEqual([...parseAddedLines(diff)], [['backend/src/new.ts', [1, 2, 3]]]);
});

test('handles several hunks, single-line hunks and pure deletions', () => {
  const diff = [
    '--- a/frontend/src/a.ts',
    '+++ b/frontend/src/a.ts',
    '@@ -10,2 +10,2 @@ function x() {',
    '@@ -20 +20 @@',
    '@@ -30,3 +29,0 @@',
    '@@ -40 +38,2 @@',
  ].join('\n');

  assert.deepEqual(parseAddedLines(diff).get('frontend/src/a.ts'), [10, 11, 20, 38, 39]);
});

test('skips deleted files and files with deletions only', () => {
  const diff = [
    '--- a/backend/src/gone.ts',
    '+++ /dev/null',
    '@@ -1,5 +0,0 @@',
    '--- a/backend/src/trimmed.ts',
    '+++ b/backend/src/trimmed.ts',
    '@@ -3,2 +2,0 @@',
  ].join('\n');

  assert.equal(parseAddedLines(diff).size, 0);
});

test('uses the new path of renamed files and unquotes special paths', () => {
  const diff = [
    '--- a/backend/src/old.ts',
    '+++ b/backend/src/renamed.ts',
    '@@ -1 +1 @@',
    '--- "a/backend/src/with space.ts"',
    '+++ "b/backend/src/with space.ts"',
    '@@ -1 +1 @@',
  ].join('\n');

  assert.deepEqual([...parseAddedLines(diff).keys()], ['backend/src/renamed.ts', 'backend/src/with space.ts']);
});
