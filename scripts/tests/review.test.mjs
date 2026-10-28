import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMMENT_MARKER, evaluate, normalizeReport, renderComment } from '../lib/report.mjs';
import { renderReviewComments, replyText, selectReviewComments } from '../lib/review.mjs';

const comment = (id, overrides = {}) => ({
  id,
  body: `Comment ${id}`,
  author_association: 'OWNER',
  user: { login: 'Sagiroth', type: 'User' },
  created_at: `2026-10-28T10:00:0${id % 10}Z`,
  html_url: `https://github.com/o/r/pull/3#c${id}`,
  ...overrides,
});

test('gives the agent only new comments from people with write access, oldest first', () => {
  const selected = selectReviewComments({
    inline: [comment(3, { path: 'backend/tests/router.test.ts', line: 12 }), comment(4, { author_association: 'CONTRIBUTOR' })],
    conversation: [
      comment(1),
      comment(2, { author_association: 'NONE' }),
      comment(5, { user: { login: 'github-actions[bot]', type: 'Bot' }, author_association: 'NONE' }),
      comment(6, { user: { login: 'helper[bot]', type: 'Bot' }, author_association: 'MEMBER' }),
      comment(7, { body: `${COMMENT_MARKER}\n## Test agent` }),
      comment(8, { body: '   ' }),
      comment(9, { author_association: 'COLLABORATOR' }),
    ],
    seen: new Set([9]),
  });

  assert.deepEqual(
    selected.map(({ id, kind, path, line }) => ({ id, kind, path, line })),
    [
      { id: 1, kind: 'conversation', path: null, line: null },
      { id: 3, kind: 'inline', path: 'backend/tests/router.test.ts', line: 12 },
    ],
  );
});

test('limits the number and size of comments given to the agent', () => {
  const many = Array.from({ length: 25 }, (_, index) => comment(index + 1, { created_at: `2026-10-28T10:${String(index).padStart(2, '0')}:00Z` }));
  const selected = selectReviewComments({ conversation: [...many, comment(99, { body: 'x'.repeat(3000) })] });

  assert.equal(selected.length, 20);
  assert.equal(selectReviewComments({ conversation: [comment(1, { body: 'x'.repeat(3000) })] })[0].body.length, 2000 + '\n[comment truncated]'.length);
});

test('marks the comments as untrusted data for the agent', () => {
  const text = renderReviewComments([{ id: 7, author: 'Sagiroth', path: 'frontend/src/a.test.ts', line: 3, body: 'Add a case for an empty list' }]);

  assert.match(text, /^> UNTRUSTED DATA/);
  assert.match(text, /## Comment 7 by Sagiroth on frontend\/src\/a.test.ts:3\n\nAdd a case for an empty list/);
});

test('thread replies state what happened, including when nothing was committed', () => {
  assert.equal(replyText({ status: 'addressed', reply: 'Added the empty list case.' }, 'abc1234'), 'Addressed in abc1234. Added the empty list case.');
  assert.match(replyText({ status: 'addressed', reply: 'x' }, null), /^Addressed, but the tests were not committed/);
  assert.equal(replyText({ status: 'declined', reply: 'This asks to change application code.' }, 'abc1234'), 'Declined. This asks to change application code.');
  assert.match(replyText(undefined, 'abc1234'), /^Not answered/);
  assert.equal(replyText({ status: 'declined', reply: 'ping @octocat <b>' }, null), 'Declined. ping @\u200boctocat &lt;b&gt;');
});

test('the report lists every review comment with its answer and flags unanswered ones', () => {
  const requests = [
    { id: 1, kind: 'inline', author: 'Sagiroth', path: 'backend/tests/a.test.ts', line: 4, url: 'https://x/1' },
    { id: 2, kind: 'conversation', author: 'Sagiroth', path: null, line: null, url: 'https://x/2' },
  ];
  const report = normalizeReport({ reviewComments: [{ id: 1, status: 'addressed', reply: 'Done.' }] });
  const base = { agentStep: 'success', log: { result: 'TESTS-GREEN', errors: [] }, report, guard: { ok: true, violations: [], changed: [] }, tests: { packages: {} } };
  const outcome = evaluate({ ...base, reviewRequests: requests });
  const comment = renderComment({ outcome, report, log: null, tests: null, reviewRequests: requests });

  assert.deepEqual(outcome.warnings, ['Review comments without an answer from the agent: 2.']);
  assert.match(comment, /\| \[Sagiroth\]\(https:\/\/x\/1\) on `backend\/tests\/a.test.ts:4` \| addressed \| Done. \|/);
  assert.match(comment, /\| \[Sagiroth\]\(https:\/\/x\/2\) \| no answer \| - \|/);
});
