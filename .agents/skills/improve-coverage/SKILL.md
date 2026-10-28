---
name: improve-coverage
description: Find the least covered files in a package or directory and plan meaningful unit tests for their behaviour. Use to pay down missing tests in existing code, for the whole repository or a given scope such as backend/src/core.
---

# Improve coverage

## Iron rules

- Coverage is a map, not a goal. Plan tests for behaviours that matter; a line covered by an assertion-free test does not count.
- No acceptance criteria exist for existing code: the code and its callers are the specification. When behaviour looks wrong, test the intended behaviour and report a suspected bug instead of enshrining it.
- Do not chase 100%. Skip code whose only behaviour is wiring with real side effects, and record why.

## Procedure

1. **Measure.** Run `node scripts/run-tests.mjs --pkg <package>` (`run-tests` skill) and read `coverage.lowest` in `.test-agent/result.json`. If a scope was given (e.g. `backend/src/core`), keep only files inside it.
2. **Prioritise** in this order:
   1. Domain logic and rules: validators, mappers, utils, routers, repositories.
   2. Data access and state: API clients, HTTP client, query and mutation hooks.
   3. UI with logic: components with conditional rendering or event handling.
   4. Infrastructure with testable behaviour: app factory, config parsing, lifecycle handlers.
   5. Skip with a reason: process entry points (`main.ts`, `main.tsx`), files that only re-export, static data.
3. **Plan per file.** Read the file and its callers. List the behaviours (inputs and the observable result), not the lines. Check the plan against the gap checklist in `unit-test-standards`.
4. **Write tests file by file** with the package skill, running each with `--related` before moving on. Prefer adding to an existing test file of the same subject.
5. **Verify.** Finish with a full run and compare the totals with step 1.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| File needs real network, database or process signals | Wiring code | Mock the boundary (fake database, stubbed fetch) or skip with a reason |
| Coverage rises but tests assert little | Tests written for lines | Rewrite around behaviours with concrete assertions |
| Too many files for one run | Large scope | Finish and report the files done; list the rest in the summary |

## Success token

`[COVERAGE-IMPROVED]`: the planned files have behaviour-based tests, the full run is green and coverage before and after is in the report summary.
