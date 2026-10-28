import path from 'node:path';

// Files the agent may create or change. Same patterns as `permission.edit` in .opencode/agents/test-engineer.md:
// test files and shared fixtures, but not the global frontend setup, which runs for every test.
const AGENT_WRITABLE = ['backend/tests/**', 'frontend/src/**/*.test.ts', 'frontend/src/**/*.test.tsx', 'frontend/src/test/**'];
const AGENT_FORBIDDEN = ['frontend/src/test/setup.ts'];

function isAgentWritable(file) {
  const matches = (patterns) => patterns.some((pattern) => path.posix.matchesGlob(file, pattern));
  return matches(AGENT_WRITABLE) && !matches(AGENT_FORBIDDEN);
}

// Parses `git status --porcelain=v1 -z --untracked-files=all` into { status, path } entries.
// A rename becomes a deletion of the old path plus an addition of the new one.
export function parseStatus(text) {
  const fields = text.split('\0');
  const entries = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (!field) continue;
    const code = field.slice(0, 2);
    const file = field.slice(3);
    if (code.includes('R') || code.includes('C')) {
      const original = fields[++index];
      entries.push({ status: 'A', path: file });
      if (code.includes('R')) entries.push({ status: 'D', path: original });
    } else if (code === '??') {
      entries.push({ status: 'A', path: file });
    } else {
      entries.push({ status: code.includes('D') ? 'D' : code.includes('A') ? 'A' : 'M', path: file });
    }
  }
  return entries;
}

// The agent may only add or change test files. Deleting tests is also refused: it would hide failures.
export function checkChanges(entries) {
  const violations = [];
  for (const entry of entries) {
    if (!isAgentWritable(entry.path)) violations.push({ path: entry.path, reason: 'not a test file' });
    else if (entry.status === 'D') violations.push({ path: entry.path, reason: 'test file deleted' });
  }
  return { ok: violations.length === 0, changed: entries, violations };
}
