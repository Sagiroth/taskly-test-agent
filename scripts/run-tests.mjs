#!/usr/bin/env node
// Runs the Vitest suites and writes a compact, machine-readable result.
// One source of truth for test results: used by the test agent, the agent workflow and developers.
//
// Uses the same Vitest binary and vitest.config.ts as the package scripts (npm test, npm run test:coverage),
// so results match; it only adds machine-readable output and an isolated environment.
//
// Usage (also available as: npm run test:agent -- <options>):
//   node scripts/run-tests.mjs [--pkg backend|frontend|all] [--base <git-ref>] [--out <file>]
//   node scripts/run-tests.mjs --related <changed files...>
//
//   --pkg      Package to test (default: all).
//   --base     Git ref to compare against; adds coverage of the changed lines (diff coverage).
//   --related  Fast mode: only run tests related to the given source files. Coverage thresholds are not enforced.
//   --out      Result file (default: .test-agent/result.json).
//
// Exit code: 0 when every executed package is green, 1 otherwise, 2 on usage errors.
// Tests of this script: npm run test:scripts
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { diffCoverage, summarizeCoverage, toRepoPath } from './lib/coverage.mjs';
import { parseAddedLines } from './lib/diff.mjs';
import { parseThresholdErrors, splitFlaky, summarizeReport } from './lib/vitest-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = ['backend', 'frontend'];
const WORK_DIR = path.join(ROOT, '.test-agent');
const TIMEOUT_MS = 10 * 60 * 1000;
const SOURCE_FILE = /\.(m?[jt]sx?)$/;

// Tests run with a minimal environment: no tokens or API keys leak from the caller.
// TZ is pinned because the app works with calendar dates.
const TEST_ENV = {
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  TZ: 'UTC',
  CI: '1',
  NO_COLOR: '1',
  FORCE_COLOR: '0',
};

function main() {
  const options = readOptions();
  const plan = options.related ? planRelated(options.files) : planFull(options.pkg);

  const packages = {};
  const coverageFinal = {};
  for (const [pkg, files] of Object.entries(plan.packages)) {
    const { result, final } = runPackage(pkg, files);
    packages[pkg] = result;
    Object.assign(coverageFinal, final);
  }

  const result = {
    ok: Object.values(packages).every((pkg) => pkg.ok),
    mode: options.related ? 'related' : 'full',
    packages,
  };
  if (plan.ignored.length) result.ignored = plan.ignored;

  if (options.base) {
    const addedLines = changedLines(options.base);
    result.diffCoverage = { base: options.base, ...diffCoverage(coverageFinal, addedLines, ROOT) };
    for (const summary of Object.values(packages)) {
      if (summary.coverage) summary.coverage.files = pickFiles(summary.coverageAll, [...addedLines.keys()]);
    }
  }
  for (const summary of Object.values(packages)) delete summary.coverageAll;

  const outFile = path.resolve(options.out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
  printSummary(result, outFile);
  process.exitCode = result.ok ? 0 : 1;
}

function readOptions() {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        pkg: { type: 'string', default: 'all' },
        base: { type: 'string' },
        related: { type: 'boolean', default: false },
        out: { type: 'string', default: path.join(WORK_DIR, 'result.json') },
      },
    });
    if (![...PACKAGES, 'all'].includes(values.pkg)) throw new Error(`Unknown package "${values.pkg}"`);
    if (values.related && positionals.length === 0) throw new Error('--related needs at least one file');
    if (!values.related && positionals.length > 0) throw new Error(`Unexpected arguments: ${positionals.join(' ')}`);
    return { ...values, files: positionals };
  } catch (error) {
    console.error(`run-tests: ${error.message}`);
    console.error('Usage: node scripts/run-tests.mjs [--pkg backend|frontend|all] [--base <ref>] [--out <file>]');
    console.error('       node scripts/run-tests.mjs --related <files...>');
    process.exit(2);
  }
}

function planFull(pkg) {
  const selected = pkg === 'all' ? PACKAGES : [pkg];
  return { packages: Object.fromEntries(selected.map((name) => [name, null])), ignored: [] };
}

// Groups the given files by package; files outside the packages are reported as ignored.
function planRelated(files) {
  const packages = {};
  const ignored = [];
  for (const file of files) {
    const absolutePath = path.resolve(file);
    const pkg = toRepoPath(absolutePath, ROOT).split('/')[0];
    if (PACKAGES.includes(pkg)) (packages[pkg] ??= []).push(absolutePath);
    else ignored.push(file);
  }
  return { packages, ignored };
}

function runPackage(pkg, relatedFiles) {
  const pkgDir = path.join(ROOT, pkg);
  const vitest = path.join(pkgDir, 'node_modules', '.bin', 'vitest');
  if (!existsSync(vitest)) {
    return { result: { ok: false, error: `Vitest is not installed, run "npm ci" in ${pkg}/` }, final: {} };
  }

  const outDir = path.join(WORK_DIR, pkg);
  const reportFile = path.join(outDir, 'vitest.json');
  const coverageDir = path.join(outDir, 'coverage');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const args = relatedFiles ? ['related', ...relatedFiles, '--run', '--passWithNoTests'] : ['run'];
  args.push(
    '--reporter=json',
    `--outputFile=${reportFile}`,
    '--coverage',
    // Keep coverage when tests fail, so a fix loop still sees what is covered.
    '--coverage.reportOnFailure',
    '--coverage.reporter=json',
    '--coverage.reporter=json-summary',
    `--coverage.reportsDirectory=${coverageDir}`,
  );

  const run = runVitest(vitest, pkgDir, args, path.join(outDir, 'vitest.log'));
  if (!existsSync(reportFile)) {
    return { result: { ok: false, exitCode: run.status, error: lastLines(run.log, 20) }, final: {} };
  }

  const report = summarizeReport(readJson(reportFile), ROOT);
  const { failures, flaky } = report.failures.length
    ? splitFlaky(report.failures, rerunFailures(vitest, pkgDir, outDir, report.failures))
    : { failures: [], flaky: [] };
  const thresholdErrors = relatedFiles ? [] : parseThresholdErrors(run.log, ROOT);

  const summaryFile = path.join(coverageDir, 'coverage-summary.json');
  const finalFile = path.join(coverageDir, 'coverage-final.json');
  const coverageSummary = existsSync(summaryFile) ? readJson(summaryFile) : null;

  return {
    result: {
      ok: failures.length === 0 && flaky.length === 0 && thresholdErrors.length === 0,
      exitCode: run.status,
      tests: {
        total: report.total,
        passed: report.passed,
        failed: failures.length,
        flaky: flaky.length,
        skipped: report.skipped,
      },
      failures,
      flaky,
      thresholdErrors,
      coverage: coverageSummary ? summarizeCoverage(coverageSummary, ROOT) : null,
      coverageAll: coverageSummary,
    },
    final: existsSync(finalFile) ? readJson(finalFile) : {},
  };
}

// Reruns only the failing files, without coverage, to tell real failures from flaky ones.
function rerunFailures(vitest, pkgDir, outDir, failures) {
  const files = [...new Set(failures.map((failure) => path.join(ROOT, failure.file)))];
  const reportFile = path.join(outDir, 'vitest-rerun.json');
  runVitest(vitest, pkgDir, ['run', ...files, '--reporter=json', `--outputFile=${reportFile}`], path.join(outDir, 'vitest-rerun.log'));
  return existsSync(reportFile) ? summarizeReport(readJson(reportFile), ROOT) : null;
}

function runVitest(vitest, cwd, args, logFile) {
  const run = spawnSync(vitest, args, {
    cwd,
    env: TEST_ENV,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  const log = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? `\n${run.error.message}` : ''}`;
  writeFileSync(logFile, log);
  return { status: run.status, log };
}

// Lines changed since the merge base with `base`, including uncommitted and untracked source files.
function changedLines(base) {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim();
  const added = parseAddedLines(git(['diff', '-U0', '--no-color', '--no-ext-diff', '--diff-filter=AMR', mergeBase]));

  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n').filter((file) => SOURCE_FILE.test(file));
  for (const file of untracked) {
    const lineCount = readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
    added.set(file, Array.from({ length: lineCount }, (_, index) => index + 1));
  }
  return added;
}

function pickFiles(coverageSummary, files) {
  return summarizeCoverage(coverageSummary, ROOT, { files, lowestCount: 0 }).files;
}

function git(args) {
  const run = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    console.error(`run-tests: git ${args.join(' ')} failed: ${run.stderr.trim()}`);
    process.exit(2);
  }
  return run.stdout;
}

function printSummary(result, outFile) {
  for (const [pkg, summary] of Object.entries(result.packages)) {
    if (summary.error) {
      console.log(`${pkg.padEnd(9)} ERROR ${summary.error}`);
      continue;
    }
    const { passed, failed, flaky } = summary.tests;
    const total = summary.coverage?.total;
    const coverage = total ? ` | lines ${total.lines}% statements ${total.statements}%` : '';
    console.log(`${pkg.padEnd(9)} ${passed} passed, ${failed} failed, ${flaky} flaky${coverage}`);
    for (const failure of summary.failures) {
      console.log(`  FAIL  ${failure.file}${failure.test ? ` > ${failure.test}` : ''}: ${failure.message}`);
    }
    for (const test of summary.flaky) console.log(`  FLAKY ${test.file}${test.test ? ` > ${test.test}` : ''}`);
    for (const error of summary.thresholdErrors) console.log(`  THRESHOLD ${error}`);
  }
  if (result.ignored) console.log(`ignored (outside packages): ${result.ignored.join(', ')}`);
  if (result.diffCoverage) {
    const { covered, coverable, pct } = result.diffCoverage;
    console.log(pct === null ? 'diff coverage: no coverable changed lines' : `diff coverage: ${covered}/${coverable} changed lines (${pct}%)`);
  }
  console.log(`${result.ok ? 'OK' : 'FAILED'} - result: ${toRepoPath(outFile, ROOT)}`);
}

function lastLines(text, count) {
  return text.trim().split('\n').slice(-count).join('\n');
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

main();
