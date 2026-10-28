import { toRepoPath } from './coverage.mjs';

const ANSI = /\x1b\[[0-9;]*m/g;

// Reduces a Vitest JSON report to counts and short failure descriptions.
// A test file that fails to load (e.g. a bad import) has no assertions, so it is reported as a failure of its own.
export function summarizeReport(report, root) {
  const failures = [];

  for (const file of report.testResults) {
    const filePath = toRepoPath(file.name, root);
    const failed = file.assertionResults.filter((assertion) => assertion.status === 'failed');

    for (const assertion of failed) {
      failures.push({
        file: filePath,
        test: [...assertion.ancestorTitles, assertion.title].join(' > '),
        message: trimMessage(assertion.failureMessages[0] ?? '', root),
      });
    }
    if (file.status === 'failed' && failed.length === 0) {
      failures.push({ file: filePath, test: null, message: trimMessage(file.message || 'Test file failed to run', root) });
    }
  }

  return {
    total: report.numTotalTests,
    passed: report.numPassedTests,
    skipped: report.numPendingTests + report.numTodoTests,
    failures,
  };
}

// Compares the first run with a rerun of the failing files: whatever passed the second time is flaky.
// Without a rerun report every failure is kept as a real failure.
export function splitFlaky(failures, rerun) {
  if (!rerun) return { failures, flaky: [] };
  const stillFailing = new Set(rerun.failures.map(failureKey));
  return {
    failures: failures.filter((failure) => stillFailing.has(failureKey(failure))),
    flaky: failures
      .filter((failure) => !stillFailing.has(failureKey(failure)))
      .map(({ file, test }) => ({ file, test })),
  };
}

// Coverage threshold violations are only printed to the log; the JSON report still says success.
export function parseThresholdErrors(log, root) {
  return log
    .replace(ANSI, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^ERROR: Coverage for .+ does not meet/.test(line))
    .map((line) => line.replace('ERROR: ', '').replaceAll(`${root}/`, ''));
}

// First meaningful lines of an error, without stack frames or absolute paths.
export function trimMessage(message, root, maxLines = 3) {
  return message
    .replace(ANSI, '')
    .replaceAll(`file://${root}/`, '')
    .replaceAll(`${root}/`, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('at '))
    .slice(0, maxLines)
    .join(' | ');
}

function failureKey({ file, test }) {
  return `${file}::${test}`;
}
