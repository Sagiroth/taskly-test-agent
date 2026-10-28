import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseThresholdErrors, splitFlaky, summarizeReport, trimMessage } from '../lib/vitest-report.mjs';

const ROOT = '/repo';

const report = {
  numTotalTests: 3,
  numPassedTests: 1,
  numPendingTests: 1,
  numTodoTests: 0,
  testResults: [
    {
      name: '/repo/backend/tests/math.test.ts',
      status: 'failed',
      message: '',
      assertionResults: [
        { ancestorTitles: [], title: 'adds', status: 'passed', failureMessages: [] },
        {
          ancestorTitles: ['math', 'edge cases'],
          title: 'divides',
          status: 'failed',
          failureMessages: [
            'AssertionError: expected 2 to be 3\n    at /repo/backend/tests/math.test.ts:2:7\n    at file:///repo/backend/node_modules/x.js:1:1',
          ],
        },
      ],
    },
    {
      name: '/repo/backend/tests/broken.test.ts',
      status: 'failed',
      message: "Cannot find module '../src/missing.ts' imported from /repo/backend/tests/broken.test.ts",
      assertionResults: [],
    },
  ],
};

test('summarizeReport lists assertion failures and files that failed to load', () => {
  assert.deepEqual(summarizeReport(report, ROOT), {
    total: 3,
    passed: 1,
    skipped: 1,
    failures: [
      { file: 'backend/tests/math.test.ts', test: 'math > edge cases > divides', message: 'AssertionError: expected 2 to be 3' },
      {
        file: 'backend/tests/broken.test.ts',
        test: null,
        message: "Cannot find module '../src/missing.ts' imported from backend/tests/broken.test.ts",
      },
    ],
  });
});

test('splitFlaky keeps failures that fail again and marks the rest as flaky', () => {
  const failures = [
    { file: 'a.test.ts', test: 'one', message: 'x' },
    { file: 'a.test.ts', test: 'two', message: 'y' },
  ];
  const rerun = { failures: [{ file: 'a.test.ts', test: 'two', message: 'y' }] };

  assert.deepEqual(splitFlaky(failures, rerun), {
    failures: [{ file: 'a.test.ts', test: 'two', message: 'y' }],
    flaky: [{ file: 'a.test.ts', test: 'one' }],
  });
});

test('splitFlaky treats every failure as real when the rerun produced no report', () => {
  const failures = [{ file: 'a.test.ts', test: 'one', message: 'x' }];
  assert.deepEqual(splitFlaky(failures, null), { failures, flaky: [] });
});

test('parseThresholdErrors extracts coverage threshold violations from the log', () => {
  const log = [
    ' % Coverage report from v8',
    'ERROR: Coverage for lines (83.33%) does not meet "src/x.ts" threshold (100%) for /repo/backend/src/x.ts',
    'some other output',
  ].join('\n');

  assert.deepEqual(parseThresholdErrors(log, ROOT), [
    'Coverage for lines (83.33%) does not meet "src/x.ts" threshold (100%) for backend/src/x.ts',
  ]);
});

test('trimMessage strips colors, stack frames and limits the length', () => {
  const message = '\x1b[31mError: one\x1b[39m\n\n  at stack (/repo/a.ts:1:1)\ntwo\nthree\nfour';
  assert.equal(trimMessage(message, ROOT), 'Error: one | two | three');
});
