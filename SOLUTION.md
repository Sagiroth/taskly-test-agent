# Solution

An AI agent that runs on every pull request, writes or updates the missing unit tests, runs them and posts the results on the PR.

## Main decisions

I went with OpenCode and OpenCode Zen because I've used them for a long time and know how to set them up. The skills aren't tied to OpenCode, so it's easy to swap for another agent in CI.

There's one agent (`test-engineer`) and six small skills. Opencode only loads the ones it needs, so a backend-only PR doesn't pull in the frontend conventions.

Agent decides what to test and writes the tests. Everything after that is done by scripts:
- checking which files it changed,
- running all the tests again,
- committing only if the agent's tests pass,
- posting the PR comment (agent explains decisions but results are from script)

Scripts always work the same way, so the results don't depend on what the agent says.

The agent can only edit tests and run the test script, and it never gets the GitHub token. A guard script checks the changes again before commit.

The agent writes tests for the acceptance criteria from the linked issue, or from the PR description if there's no issue. If there's neither, it just tests what the code does now and says so in the PR comment.

If an old test fails and the issue or PR doesn't mention that change, the agent leaves the test alone and reports a possible regression. Otherwise it could just change the test to pass on a bug.

I thought about opening a separate stacked PR with the tests, but went with committing them to the same PR. That way there's one PR to review and the tests are reviewed together with the code. If the developer pushes more code, the agent runs again on that push and updates the tests, so they don't go stale. With a separate PR they would.

The agent doesn't start until the PR is marked ready for review. From experience, people push last-minute changes and re-read their PR before asking for a review, and every push would trigger an unnecessary agent run.

## How to run it

1. Add the repository secret `OPENCODE_API_KEY` (OpenCode Zen key) and the variable `TEST_AGENT_MODEL`. 

2. Open a PR that changes `backend/src` or `frontend/src` and mark it ready for review.

3. To ask for changes, leave review comments and add the label `test-agent: address-review`. The agent marks the comments with 👀 emoji, changes the tests and replies in each thread with reasoning.

PRs with only tests, docs or config, drafts and forks don't start the agent.

Locally: `npm run test:agent` runs the tests like the agent does, and `/cover backend/src` in opencode runs the agent on existing code. (You can use /cover in any other harness)

## Where is the agent and skills

- Agent: `.opencode/agents/test-engineer.md` (rules, permissions, report format)
- Skills: `.agents/skills/`
- Workflows: `.github/workflows/test-agent.yml` (agent), `ci.yml` (tests)
- Scripts: `scripts/` (test runner, guard, report)

In a PR run the agent always loads `unit-test-standards`, `run-tests` and `analyze-pr-diff`, then `backend-unit-tests` and/or `frontend-unit-tests` for the files it touches. The PR comment lists the skills that were actually loaded, taken from the run log. I could possibly skip listing skills after a while oncd agent proven to be consistent or bloats the PR.

## Example run

I added issue [#2](../../issues/2) (archive completed tasks) and opened PR [#3](../../pull/3) with the feature and no tests. The PR is still left open.

1. When I marked the PR ready for review, the agent added 3 new test files and updated 14, and covered all 6 acceptance criteria from the issue. 3 changed files were skipped because they're just types and constants. All 338 tests passed and got committed. It also needed to change a shared fixture, but fixtures weren't allowed yet, so it stopped with `BLOCKED` and explained why. (see commit history)

2. I allowed fixtures and pushed. The agent kept the tests from the first round, fixed the fixture, and CI passed on its commit.

3. I left two review comments and added the label `test-agent: address-review`. The first asked for a missing case (archived filter with priority sort). The agent added the test, replied "Addressed in 44d907f" and pointed out that the comment was on the wrong file and where the test actually belongs. The second asked to rename a button, which is application code, so the agent declined and explained why. CI passed on its commit.

Skills loaded in the last round: `unit-test-standards`, `analyze-pr-diff`, `run-tests`, `backend-unit-tests`, `frontend-unit-tests`. All decisions and results are in [the PR comment](https://github.com/Sagiroth/taskly-test-agent/pull/3#issuecomment-6480771995).

On the existing code (PR [#1](../../pull/1)), using `/cover` and the `improve-coverage` skill, backend coverage went from 33% to 97% and frontend from 48% to 98%.

## My Assumptions

- Acceptance criteria are in a GitHub issue linked from the PR. With Jira or similar, only that one step changes.
- PRs come from the same repo and people with write access are trusted.

## Limitations

- The API key is a secret, but during the agent step it sits in the agent's process environment. Test code from the PR runs on the same machine and could read it from there. Only people who can already push to the repo can get test code into that run.

- I used Claude Opus 5.5 on medium effort as a balance between quality and cost. A run costs about $0.40-1.60 and takes 2-7 minutes (OpenCode Zen rates). A cheaper model like Haiku, DeepSeek or GPT Luna is just a change of the `TEST_AGENT_MODEL` variable, but it would need to be benchmarked for test quality first.

## What I would change for production

- A GitHub App token, so the agent's commits trigger CI normally.
- Tests in a separate container with no network, so test code can't reach the agent's key or send anything out.
- Benchmarking models for best balance of cost/quality
- Consider manual trigger to control cost or set limit per PR
- Opening issues for suspected bugs, and mentioning that in the PR comment section
