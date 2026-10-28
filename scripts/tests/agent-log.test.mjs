import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseAgentLog } from '../lib/agent-log.mjs';

// Real `opencode run --format json` output (opencode 2.1.2): two skills, one write, final token.
const recorded = readFileSync(new URL('./fixtures/opencode-run.jsonl', import.meta.url), 'utf8');

const event = (type, part) => JSON.stringify({ type, part });

test('reads loaded skills, tool calls, usage and the result token from a recorded run', () => {
  const log = parseAgentLog(recorded);

  assert.equal(log.result, 'NO-TESTS-NEEDED');
  assert.deepEqual(log.skills, ['run-tests', 'analyze-pr-diff']);
  assert.deepEqual(log.tools, { skill: 2, write: 1 });
  assert.equal(log.steps, 3);
  assert.ok(log.cost > 0);
  assert.ok(log.tokens.output > 0);
});

test('only counts skills that loaded, once each, and records failed calls', () => {
  const log = parseAgentLog(
    [
      event('tool_use', { tool: 'skill', state: { status: 'completed', input: { id: 'run-tests' } } }),
      event('tool_use', { tool: 'skill', state: { status: 'completed', input: { id: 'run-tests' } } }),
      event('tool_use', { tool: 'skill', state: { status: 'error', input: { id: 'secret-skill' }, error: 'denied' } }),
      event('tool_use', { tool: 'edit', state: { status: 'error', error: 'permission denied: backend/src/app.ts' } }),
    ].join('\n'),
  );

  assert.deepEqual(log.skills, ['run-tests']);
  assert.deepEqual(log.failedCalls, [
    { tool: 'skill', error: 'denied' },
    { tool: 'edit', error: 'permission denied: backend/src/app.ts' },
  ]);
});

test('takes the result token from the last reply only and keeps the blocked reason', () => {
  const log = parseAgentLog(
    [event('text', { text: 'I will reply [TESTS-GREEN] at the end.' }), event('text', { text: '[BLOCKED] dependencies not installed' })].join('\n'),
  );

  assert.equal(log.result, 'BLOCKED');
  assert.equal(log.blockedReason, 'dependencies not installed');
});

test('has no result when the run ended without a token, and keeps provider errors', () => {
  const log = parseAgentLog(
    ['not json', event('text', { text: 'Working on it' }), JSON.stringify({ type: 'error', error: { name: 'APIError', data: { message: 'Insufficient balance' } } }), '{broken'].join('\n'),
  );

  assert.equal(log.result, null);
  assert.deepEqual(log.errors, ['Insufficient balance']);
});
