---
name: unit-test-standards
description: Rules every unit test in this repository must follow, and a checklist of common gaps to review a test plan against before writing tests. Use whenever you plan, write or review unit tests in backend or frontend.
---

# Unit test standards

## Iron rules

- A test must fail when the behaviour it describes breaks. If you cannot name the change in the code that would make it fail, the test is useless.
- Test behaviour through the public interface (HTTP response, rendered UI, returned value), not private implementation details.
- Mock only at the boundaries of the unit: database (Prisma), HTTP (`fetch` / `request`), child components or hooks when testing a parent. Never mock the module under test.
- Tests are deterministic: no real network, no real time, no randomness. Use fixed dates and fake timers when time matters. Tests run with `TZ=UTC`.
- Tests are isolated: no shared mutable state between tests, restore or clear mocks.
- Never use `.only`, `.skip` or `.todo`, and never loosen an assertion to make a test pass.

## Writing a test

- One behaviour per test, named after the behaviour: `rejects a title longer than 120 characters`, not `test validation 2`.
- Arrange, act, assert. No conditionals or loops in test bodies; use `it.each` for variants.
- Specific assertions: `toEqual(expected)`, `toHaveBeenCalledWith(...)`, `toBeVisible()`. Avoid `toBeTruthy()`, `toBeDefined()` and snapshots when a concrete value can be checked.
- Prefer readable over DRY (DAMP). Repeating a small arrange step is fine; hiding the scenario behind helpers is not. Reuse existing fixtures and helpers instead of creating copies.
- Match the style of the file you edit or of its neighbours.

## Gap checklist for a test plan

Before writing, go through the plan and add the cases that apply:

- Happy path for every public function, endpoint or user interaction in scope.
- Empty and missing values: empty string, whitespace, `null`, `undefined`, empty list.
- Boundaries: maximum lengths, first and last valid value, one past the limit.
- Invalid input: wrong type, unknown enum value, impossible date (`2026-02-30`), invalid id.
- Error paths: rejected promise, non-OK HTTP status, not found, network failure, aborted request.
- State transitions: loading, success, error, and retry; optimistic updates and rollback.
- Dates and time: time zones, date-only vs timestamp, today vs past vs future.
- Side effects: what must be called, and what must NOT be called (e.g. repository not called on invalid input).
- Accessibility for UI: element reachable by role and accessible name.

Record each gap you found and how the plan changed; it goes into `planChecks` of the agent report.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| Test passes even with the asserted code removed | Assertion checks a mock or nothing | Assert on the observable result instead |
| Test only fails in CI or at certain times | Real time, time zone or order dependence | Fix the date, use fake timers, isolate state |
| Test needs many mocks of internal modules | Testing implementation, wrong unit | Test one level up or mock at the boundary only |

## Success token

`[STANDARDS-APPLIED]`: every planned test satisfies the iron rules and the gap checklist was applied.
