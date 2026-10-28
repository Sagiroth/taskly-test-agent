import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diffCoverage, lineHits, summarizeCoverage, toRanges } from '../lib/coverage.mjs';

const ROOT = '/repo';

// Statements on lines 2, 3 (twice), 5, 6, 7; line 4 has none (e.g. a comment).
const fileCoverage = {
  statementMap: {
    0: { start: { line: 2 } },
    1: { start: { line: 3 } },
    2: { start: { line: 3 } },
    3: { start: { line: 5 } },
    4: { start: { line: 6 } },
    5: { start: { line: 7 } },
  },
  s: { 0: 1, 1: 0, 2: 4, 3: 0, 4: 0, 5: 2 },
};

test('lineHits keeps the highest count of statements starting on a line', () => {
  assert.deepEqual(
    [...lineHits(fileCoverage)],
    [
      [2, 1],
      [3, 4],
      [5, 0],
      [6, 0],
      [7, 2],
    ],
  );
});

test('diffCoverage counts only changed lines that hold statements', () => {
  const coverageFinal = {
    '/repo/backend/src/a.ts': fileCoverage,
    '/repo/backend/src/untouched.ts': fileCoverage,
  };
  const addedLines = new Map([
    ['backend/src/a.ts', [1, 3, 4, 5, 6, 7]],
    ['backend/tests/a.test.ts', [1, 2]],
  ]);

  assert.deepEqual(diffCoverage(coverageFinal, addedLines, ROOT), {
    coverable: 4,
    covered: 2,
    pct: 50,
    files: { 'backend/src/a.ts': { coverable: 4, covered: 2, uncovered: '5-6' } },
  });
});

test('diffCoverage reports null when no changed line is coverable', () => {
  const result = diffCoverage({ '/repo/backend/src/a.ts': fileCoverage }, new Map([['backend/src/a.ts', [4]]]), ROOT);
  assert.deepEqual(result, { coverable: 0, covered: 0, pct: null, files: {} });
});

test('summarizeCoverage returns totals, requested files and the weakest files first', () => {
  const metrics = (pct) => ({ lines: { pct }, statements: { pct }, branches: { pct }, functions: { pct } });
  const summary = {
    total: metrics(60),
    '/repo/backend/src/full.ts': metrics(100),
    '/repo/backend/src/half.ts': metrics(50),
    '/repo/backend/src/none.ts': metrics(0),
  };
  const flat = (pct) => ({ lines: pct, statements: pct, branches: pct, functions: pct });

  assert.deepEqual(summarizeCoverage(summary, ROOT, { files: ['backend/src/half.ts'] }), {
    total: flat(60),
    files: { 'backend/src/half.ts': flat(50) },
    lowest: [
      { file: 'backend/src/none.ts', ...flat(0) },
      { file: 'backend/src/half.ts', ...flat(50) },
    ],
  });
});

test('toRanges compresses consecutive lines', () => {
  assert.equal(toRanges([3, 4, 5, 9, 11, 12]), '3-5,9,11-12');
  assert.equal(toRanges([]), '');
});
