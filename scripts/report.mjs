#!/usr/bin/env node
// Evaluates an agent run from facts and writes the pull request comment.
// Reads .test-agent/: agent.jsonl (opencode log), agent-report.json, guard.json, result.json.
//
// Writes .test-agent/comment.md, the job summary and the step outputs
// `commit` (true when the agent's tests are green and allowed) and `ok` (false makes the check red).
// Usage: AGENT_STEP=<success|failure|cancelled|skipped> [RUN_URL=<url>] node scripts/report.mjs
import path from 'node:path';
import { parseAgentLog } from './lib/agent-log.mjs';
import { appendSummary, readJsonIfValid, readText, setOutputs, WORK_DIR, writeFile } from './lib/io.mjs';
import { evaluate, normalizeReport, renderComment } from './lib/report.mjs';

const file = (name) => path.join(WORK_DIR, name);
const logText = readText(file('agent.jsonl'));

const log = logText === null ? null : parseAgentLog(logText);
const report = normalizeReport(readJsonIfValid(file('agent-report.json')));
const tests = readJsonIfValid(file('result.json'));
const outcome = evaluate({ agentStep: process.env.AGENT_STEP ?? 'skipped', log, report, guard: readJsonIfValid(file('guard.json')), tests });
const comment = renderComment({ outcome, report, log, tests, runUrl: process.env.RUN_URL });

writeFile(file('comment.md'), comment);
appendSummary(comment);
setOutputs({ commit: outcome.commit, ok: outcome.ok });
console.log(`report: ${outcome.status}, commit ${outcome.commit}, ok ${outcome.ok}`);
for (const problem of outcome.problems) console.log(`  - ${problem}`);
