import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMMENT_MARKER, evaluate, inline, normalizeReport, renderComment } from '../lib/report.mjs';

const log = { result: 'TESTS-GREEN', errors: [], skills: ['analyze-pr-diff'], tools: { edit: 2 }, failedCalls: [], steps: 5, tokens: { input: 1, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0 }, cost: 0.1 };
const guard = (...paths) => ({ ok: true, violations: [], changed: paths.map((path) => ({ status: 'A', path })) });
const pkg = ({ failures = [], flaky = [], thresholdErrors = [] } = {}) => ({ ok: !failures.length, tests: { passed: 3, failed: failures.length, flaky: flaky.length }, failures, flaky, thresholdErrors });
const tests = (backend = pkg(), frontend = pkg()) => ({ ok: true, packages: { backend, frontend } });
const base = { agentStep: 'success', log, report: normalizeReport({ summary: 'ok' }), guard: guard('backend/tests/a.test.ts'), tests: tests() };

test('commits green agent tests and keeps the check green', () => {
  assert.deepEqual(pick(evaluate(base)), { ok: true, commit: true, status: 'added' });
});

test('reports no tests needed when the agent changed nothing', () => {
  assert.deepEqual(pick(evaluate({ ...base, guard: guard() })), { ok: true, commit: false, status: 'not-needed' });
});

test('never commits failing or flaky tests written by the agent', () => {
  for (const backend of [pkg({ failures: [{ file: 'backend/tests/a.test.ts' }] }), pkg({ flaky: [{ file: 'backend/tests/a.test.ts' }] })]) {
    assert.deepEqual(pick(evaluate({ ...base, tests: tests(backend) })), { ok: false, commit: false, status: 'attention' });
  }
});

test('commits green agent tests but turns the check red when existing tests or thresholds fail', () => {
  const regression = evaluate({ ...base, tests: tests(pkg({ failures: [{ file: 'backend/tests/router.test.ts' }] })) });
  const threshold = evaluate({ ...base, tests: tests(pkg(), pkg({ thresholdErrors: ['lines'] })) });

  assert.deepEqual(pick(regression), { ok: false, commit: true, status: 'attention' });
  assert.match(regression.problems[0], /Existing tests fail: backend\/tests\/router.test.ts/);
  assert.deepEqual(pick(threshold), { ok: false, commit: true, status: 'attention' });
});

test('reported regressions and bugs need attention without failing the check', () => {
  const report = normalizeReport({ possibleRegressions: [{ test: 'x', reason: 'y' }] });

  assert.deepEqual(pick(evaluate({ ...base, report })), { ok: true, commit: true, status: 'attention' });
});

test('commits nothing when the guard rejects the changes, the agent fails or no test result exists', () => {
  const rejected = { ok: false, violations: [{ path: 'backend/src/app.ts', reason: 'not a test file' }], changed: [{ status: 'M', path: 'backend/src/app.ts' }] };
  const cases = [
    [{ ...base, guard: rejected }, /Guard rejected the changes: backend\/src\/app.ts/],
    [{ ...base, agentStep: 'failure', guard: guard() }, /did not finish \(failure\)/],
    [{ ...base, log: { ...log, errors: ['Insufficient balance'] }, guard: guard() }, /Insufficient balance/],
    [{ ...base, report: normalizeReport('text'), guard: guard() }, /valid report/],
    [{ ...base, tests: null }, /no result/],
  ];

  for (const [input, problem] of cases) {
    const outcome = evaluate(input);
    assert.deepEqual([outcome.ok, outcome.commit], [false, false]);
    assert.match(outcome.problems.join(' '), problem);
  }
});

test('maps acceptance criteria to the tests covering them and their result', () => {
  const report = normalizeReport({
    acceptanceCriteria: { source: 'issue #3', items: [{ id: 'AC1', text: 'Deletes completed' }, { id: 'AC2', text: 'Returns count' }, { id: 'AC3', text: 'Hides button' }] },
    tests: [
      { file: 'backend/tests/a.test.ts', status: 'added', covers: ['AC1'] },
      { file: 'backend/tests/b.test.ts', status: 'added', covers: ['AC2'] },
    ],
  });
  const input = { ...base, report, guard: guard('backend/tests/a.test.ts', 'backend/tests/b.test.ts'), tests: tests(pkg({ failures: [{ file: 'backend/tests/b.test.ts', test: 't', message: 'm' }] })) };
  const comment = renderComment({ outcome: evaluate(input), report, log, tests: input.tests });

  assert.match(comment, /\| AC1 \| Deletes completed \| `backend\/tests\/a.test.ts` \| ✅ passing \|/);
  assert.match(comment, /\| AC2 \| Returns count \| `backend\/tests\/b.test.ts` \| ❌ failing \|/);
  assert.match(comment, /\| AC3 \| Hides button \| - \| ❌ not covered \|/);
  assert.ok(comment.startsWith(COMMENT_MARKER));
});

test('lists the skills from the run log and diff coverage gaps', () => {
  const result = { ...tests(), diffCoverage: { covered: 8, coverable: 10, pct: 80, files: { 'backend/src/x.ts': { uncovered: '4-5' } } } };
  const comment = renderComment({ outcome: evaluate(base), report: base.report, log, tests: result });

  assert.match(comment, /Skills loaded \(from the run log\): `analyze-pr-diff`/);
  assert.match(comment, /8\/10 changed lines \(80%\)/);
  assert.match(comment, /`backend\/src\/x.ts` uncovered lines: 4-5/);
});

test('neutralises HTML, mentions and table breaks in agent text', () => {
  assert.equal(inline('<img src=x>\n@octocat `x`'), "&lt;img src=x&gt; @\u200boctocat 'x'");
  const report = normalizeReport({ decisions: [{ file: 'a|b', action: 'skip', reason: 'one | two' }] });

  assert.match(renderComment({ outcome: evaluate({ ...base, report }), report, log, tests: null }), /\| `a\\\|b` \| skip \| one \\\| two \|/);
});

function pick({ ok, commit, status }) {
  return { ok, commit, status };
}
