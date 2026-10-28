#!/usr/bin/env node
// Verifies that the working tree only contains test changes after the agent ran.
// Independent of the agent's permission config: a second, deterministic check before anything is committed.
//
// Writes .test-agent/guard.json and the step output `changed` (number of changed files).
// Exit code: 0 when every change is allowed, 1 on a violation.
// Usage: node scripts/guard-paths.mjs
import path from 'node:path';
import { checkChanges, parseStatus } from './lib/guard.mjs';
import { git, setOutputs, WORK_DIR, writeJson } from './lib/io.mjs';

const result = checkChanges(parseStatus(git(['status', '--porcelain=v1', '-z', '--untracked-files=all'])));
writeJson(path.join(WORK_DIR, 'guard.json'), result);
setOutputs({ changed: result.changed.length });

for (const violation of result.violations) console.error(`guard: ${violation.path}: ${violation.reason}`);
console.log(`guard: ${result.ok ? 'OK' : 'FAILED'} - ${result.changed.length} changed file(s), ${result.violations.length} violation(s)`);
process.exitCode = result.ok ? 0 : 1;
