---
name: run-tests
description: How to run the backend and frontend test suites with scripts/run-tests.mjs and read its compact JSON result (failures, flaky tests, coverage, diff coverage). Use whenever you need to run tests or check coverage.
---

# Run tests

## Iron rules

- Run tests only through `node scripts/run-tests.mjs`, called from the repository root, exactly with that prefix (no `cd`, no `npx vitest`, no pipes).
- The script result is the source of truth. Never report a test as passing without a run that shows it.
- At most 3 fix rounds per test file. If it still fails, stop, remove or keep the test as described below and report it.

## Commands

| Goal | Command |
|---|---|
| Fast check while writing tests | `node scripts/run-tests.mjs --related <source or test files...>` |
| Full run of one package | `node scripts/run-tests.mjs --pkg backend` (or `frontend`) |
| Full run with coverage of changed lines | `node scripts/run-tests.mjs --base <ref>` |
| Final verification | `node scripts/run-tests.mjs` (both packages) |

The script prints a short summary and writes the full result to `.test-agent/result.json`. Read that file for details.

## Reading the result

```json
{
  "ok": false,
  "packages": {
    "backend": {
      "tests": { "total": 50, "passed": 49, "failed": 1, "flaky": 0, "skipped": 0 },
      "failures": [{ "file": "backend/tests/x.test.ts", "test": "group > name", "message": "AssertionError: ..." }],
      "flaky": [],
      "thresholdErrors": [],
      "coverage": { "total": { "lines": 80 }, "lowest": [{ "file": "backend/src/...", "lines": 0 }] }
    }
  },
  "diffCoverage": { "covered": 12, "coverable": 15, "pct": 80, "files": { "backend/src/x.ts": { "uncovered": "18-20" } } }
}
```

- `failures` with `test: null`: the test file did not load (import or syntax error).
- `flaky`: the test passed only on rerun. Treat it as a defect of your test: remove the source of non-determinism.
- `thresholdErrors`: coverage thresholds in `vitest.config.ts` are not met. Add tests; never change thresholds.
- `--related` mode does not enforce thresholds; always finish with a full run.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `Vitest is not installed` | Dependencies missing | Stop and report `[BLOCKED] dependencies not installed` |
| Permission denied for the command | Command not in the allowed form | Use exactly `node scripts/run-tests.mjs ...` from the root |
| Your new test fails after 3 rounds | Wrong expectation or a bug in the code | Re-read the code: if the code is wrong, report a suspected bug and remove the test; otherwise remove the test and report why |
| An existing test fails | Intended change or regression | Follow the update vs regression rule in `analyze-pr-diff` |

## Success token

`[RUN-OK]`: the final full run has `"ok": true`.
