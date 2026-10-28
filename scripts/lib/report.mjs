export const COMMENT_MARKER = '<!-- test-agent-report -->';

// The agent's own report is model output: anything malformed becomes an empty value.
export function normalizeReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const list = (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);
  const criteria = report.acceptanceCriteria && typeof report.acceptanceCriteria === 'object' ? report.acceptanceCriteria : {};
  return {
    summary: String(report.summary ?? ''),
    acceptanceCriteria: { source: String(criteria.source ?? 'none'), items: list(criteria.items) },
    decisions: list(report.decisions),
    tests: list(report.tests).map((item) => ({ ...item, covers: Array.isArray(item.covers) ? item.covers.map(String) : [] })),
    planChecks: Array.isArray(report.planChecks) ? report.planChecks.map(String) : [],
    possibleRegressions: list(report.possibleRegressions),
    suspectedBugs: list(report.suspectedBugs),
  };
}

// Decides from facts only (guard, independent test run, run log) whether to commit and whether the check is green.
//   agentStep: outcome of the agent step (success | failure | cancelled | skipped)
//   log: parseAgentLog result, report: normalizeReport result
//   guard: checkChanges result, tests: result of scripts/run-tests.mjs
export function evaluate({ agentStep, log, report, guard, tests }) {
  const problems = [];
  if (agentStep !== 'success') problems.push(`The agent step did not finish (${agentStep}).`);
  for (const error of log?.errors ?? []) problems.push(`Agent error: ${error}`);
  if (!report) problems.push('The agent did not write a valid report.');
  if (guard && !guard.ok) problems.push(`Guard rejected the changes: ${guard.violations.map((v) => `${v.path} (${v.reason})`).join(', ')}. Nothing was committed.`);
  if (!tests) problems.push('The test run produced no result.');

  const changed = new Set(guard?.ok ? guard.changed.map((entry) => entry.path) : []);
  const packages = Object.entries(tests?.packages ?? {});
  const failing = packages.flatMap(([, pkg]) => [...(pkg.failures ?? []), ...(pkg.flaky ?? [])]);
  const typeErrors = packages.flatMap(([, pkg]) => pkg.typecheck?.errors ?? []);
  const brokenByAgent = unique([...failing, ...typeErrors].filter((item) => changed.has(item.file)).map((item) => item.file));
  const brokenElsewhere = unique(failing.filter((item) => !changed.has(item.file)).map((item) => item.file));
  const typeErrorsElsewhere = unique(typeErrors.filter((item) => !changed.has(item.file)).map((item) => item.file ?? 'project configuration'));

  if (brokenByAgent.length) problems.push(`Tests written by the agent fail, are flaky or do not compile, so they were not committed: ${brokenByAgent.join(', ')}.`);
  if (brokenElsewhere.length) problems.push(`Existing tests fail: ${brokenElsewhere.join(', ')}.`);
  if (typeErrorsElsewhere.length) problems.push(`Type errors outside the agent's tests: ${typeErrorsElsewhere.join(', ')}.`);
  for (const [name, pkg] of packages) {
    if (pkg.error) problems.push(`${name}: ${pkg.error.split('\n')[0]}`);
    if (pkg.thresholdErrors?.length) problems.push(`${name}: coverage thresholds not met.`);
  }

  const commit = changed.size > 0 && brokenByAgent.length === 0 && Boolean(tests);
  const attention = problems.length > 0 || (report?.possibleRegressions.length ?? 0) > 0 || (report?.suspectedBugs.length ?? 0) > 0;
  const status = attention ? 'attention' : commit ? 'added' : 'not-needed';
  return { ok: problems.length === 0, commit, status, problems, changedFiles: [...changed], brokenFiles: [...brokenByAgent, ...brokenElsewhere] };
}

const HEADLINES = {
  added: '✅ Tests added',
  'not-needed': 'ℹ️ No new tests needed',
  attention: '⚠️ Needs attention',
};

export function renderComment({ outcome, report, log, tests, runUrl }) {
  const lines = [COMMENT_MARKER, `## Test agent: ${HEADLINES[outcome.status]}`, ''];
  if (report?.summary) lines.push(`> ${inline(report.summary)}`, '');
  for (const problem of outcome.problems) lines.push(`- ${inline(problem)}`);
  if (outcome.problems.length) lines.push('');

  if (report?.decisions.length) {
    lines.push('### Decisions', '', '| File | Action | Reason |', '|---|---|---|');
    for (const item of report.decisions) lines.push(`| \`${cell(item.file)}\` | ${cell(item.action)} | ${cell(item.reason)} |`);
    lines.push('');
  }

  if (report) {
    const { source, items } = report.acceptanceCriteria;
    lines.push(`### Acceptance criteria (source: ${inline(source)})`, '');
    if (items.length) {
      lines.push('| | Criterion | Tests | Result |', '|---|---|---|---|');
      for (const item of items) {
        const covering = report.tests.filter((test) => test.covers.includes(String(item.id)));
        const result = covering.length === 0 ? '❌ not covered' : covering.some((test) => outcome.brokenFiles.includes(test.file)) ? '❌ failing' : '✅ passing';
        lines.push(`| ${cell(item.id)} | ${cell(item.text)} | ${covering.map((test) => `\`${cell(test.file)}\``).join('<br>') || '-'} | ${result} |`);
      }
    } else {
      lines.push('No acceptance criteria found: tests describe the current behaviour of the code.');
    }
    lines.push('');
  }

  if (report?.tests.length) {
    lines.push('### Tests written or updated', '', '| File | Status | Covers |', '|---|---|---|');
    for (const test of report.tests) lines.push(`| \`${cell(test.file)}\` | ${cell(test.status)} | ${cell(test.covers.join(', '))} |`);
    lines.push('');
  }

  if (report?.planChecks.length) {
    lines.push('### Plan review', '', 'Gaps the agent found in its own test plan (gap checklist of `unit-test-standards`) and how the plan changed:', '');
    for (const check of report.planChecks) lines.push(`- ${inline(check)}`);
    lines.push('');
  }

  if (tests) lines.push(...renderTestRun(tests), '');

  if (report?.possibleRegressions.length) {
    lines.push('### Possible regressions', '', 'Existing tests were left unchanged because the change is not described in the issue or the PR:', '');
    for (const item of report.possibleRegressions) lines.push(`- \`${inline(item.test)}\`: ${inline(item.reason)}`);
    lines.push('');
  }
  if (report?.suspectedBugs.length) {
    lines.push('### Suspected bugs', '');
    for (const bug of report.suspectedBugs) {
      lines.push(`- \`${inline(bug.file)}${bug.line ? `:${inline(bug.line)}` : ''}\`: ${inline(bug.description)} (expected: ${inline(bug.expected)}; actual: ${inline(bug.actual)})`);
    }
    lines.push('');
  }

  lines.push('<details><summary>Agent run</summary>', '');
  lines.push(`- Skills loaded (from the run log): ${log?.skills.length ? log.skills.map((skill) => `\`${skill}\``).join(', ') : 'none'}`);
  if (log) {
    lines.push(`- Tool calls: ${Object.entries(log.tools).map(([tool, count]) => `${tool} ${count}`).join(', ') || 'none'}; denied or failed: ${log.failedCalls.length}`);
    lines.push(`- Steps: ${log.steps}; tokens in/out: ${log.tokens.input + log.tokens.cacheRead + log.tokens.cacheWrite}/${log.tokens.output + log.tokens.reasoning}; cost: $${log.cost}`);
    lines.push(`- Final answer: \`${log.result ?? 'none'}\``);
  }
  if (runUrl) lines.push(`- [Workflow run and logs](${runUrl})`);
  lines.push('', '</details>', '');
  return lines.join('\n');
}

function renderTestRun(tests) {
  const lines = ['### Test run', '', 'Independent full run of `node scripts/run-tests.mjs` after the agent finished.', ''];
  lines.push('| Package | Passed | Failed | Flaky | Type errors | Lines | Branches |', '|---|---|---|---|---|---|---|');
  for (const [name, pkg] of Object.entries(tests.packages)) {
    if (pkg.error) {
      lines.push(`| ${name} | error | | | | | |`);
      continue;
    }
    const total = pkg.coverage?.total;
    lines.push(`| ${name} | ${pkg.tests.passed} | ${pkg.tests.failed} | ${pkg.tests.flaky} | ${pkg.typecheck?.count ?? '-'} | ${total ? `${total.lines}%` : '-'} | ${total ? `${total.branches}%` : '-'} |`);
  }
  const failures = Object.values(tests.packages).flatMap((pkg) => pkg.failures ?? []);
  if (failures.length) {
    lines.push('', 'Failures:', '');
    for (const failure of failures.slice(0, 10)) lines.push(`- \`${inline(failure.file)}\`${failure.test ? ` > ${inline(failure.test)}` : ''}: ${inline(failure.message)}`);
  }
  const typeErrors = Object.values(tests.packages).flatMap((pkg) => pkg.typecheck?.errors ?? []);
  if (typeErrors.length) {
    lines.push('', 'Type errors (`tsc --noEmit`):', '');
    for (const error of typeErrors.slice(0, 10)) lines.push(`- \`${inline(error.file ?? 'tsconfig')}${error.line ? `:${error.line}` : ''}\`: ${inline(error.message)}`);
  }

  const diff = tests.diffCoverage;
  if (diff) {
    lines.push('');
    if (diff.pct === null) {
      lines.push('Diff coverage: no coverable changed lines.');
    } else {
      lines.push(`Diff coverage: **${diff.covered}/${diff.coverable} changed lines (${diff.pct}%)**`);
      const uncovered = Object.entries(diff.files).filter(([, file]) => file.uncovered);
      for (const [file, info] of uncovered) lines.push(`- \`${inline(file)}\` uncovered lines: ${info.uncovered}`);
    }
  }
  return lines;
}

// Agent text goes into a public comment: no HTML, no mentions, no line breaks inside table cells.
export function inline(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@(?=\w)/g, '@\u200b')
    .replace(/`/g, "'")
    .trim();
}

function cell(value) {
  return inline(value).replace(/\|/g, '\\|');
}

function unique(values) {
  return [...new Set(values)];
}
