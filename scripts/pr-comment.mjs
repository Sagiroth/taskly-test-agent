#!/usr/bin/env node
// Creates or updates the single test agent comment on a pull request.
//   node scripts/pr-comment.mjs <markdown file>   publish the report
//   node scripts/pr-comment.mjs --working         show that a run is in progress, with a link to it
// Needs GH_TOKEN, GITHUB_REPOSITORY and PR_NUMBER; RUN_URL and REVIEW_MODE are optional.
import { readFileSync } from 'node:fs';
import { api, requireEnv } from './lib/gh.mjs';
import { COMMENT_MARKER, workingComment } from './lib/report.mjs';

const BOT = 'github-actions[bot]';
const [repo, pr] = requireEnv('GITHUB_REPOSITORY', 'PR_NUMBER');
const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/pr-comment.mjs <markdown file> | --working');
  process.exit(2);
}

const body =
  target === '--working'
    ? workingComment({ review: process.env.REVIEW_MODE === 'true', runUrl: process.env.RUN_URL })
    : readFileSync(target, 'utf8');

const comments = api(`repos/${repo}/issues/${pr}/comments`, { paginate: true });
const existing = comments.filter((comment) => comment.user?.login === BOT && comment.body?.startsWith(COMMENT_MARKER)).at(-1);
if (existing) api(`repos/${repo}/issues/comments/${existing.id}`, { method: 'PATCH', body: { body } });
else api(`repos/${repo}/issues/${pr}/comments`, { method: 'POST', body: { body } });
console.log(`pr-comment: ${existing ? 'updated' : 'created'} the test agent comment`);
