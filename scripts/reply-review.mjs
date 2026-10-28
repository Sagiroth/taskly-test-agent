#!/usr/bin/env node
// Review mode: answers each inline review comment in its thread with the agent's status
// ("Addressed in <commit>" or "Declined"). Conversation comments are answered in the report comment.
// Needs GH_TOKEN, GITHUB_REPOSITORY and PR_NUMBER; COMMIT_SHA when tests were pushed.
import path from 'node:path';
import { api, requireEnv } from './lib/gh.mjs';
import { readJsonIfValid, WORK_DIR } from './lib/io.mjs';
import { normalizeReport } from './lib/report.mjs';
import { replyText } from './lib/review.mjs';

const [repo, pr] = requireEnv('GITHUB_REPOSITORY', 'PR_NUMBER');
const requests = readJsonIfValid(path.join(WORK_DIR, 'review-comments.json')) ?? [];
const report = normalizeReport(readJsonIfValid(path.join(WORK_DIR, 'agent-report.json')));
const answers = new Map(report?.reviewComments.map((item) => [item.id, item]) ?? []);
const commit = process.env.COMMIT_SHA?.slice(0, 7) || null;

let replied = 0;
for (const comment of requests.filter((request) => request.kind === 'inline')) {
  api(`repos/${repo}/pulls/${pr}/comments/${comment.id}/replies`, { method: 'POST', body: { body: replyText(answers.get(comment.id), commit) } });
  replied++;
}
console.log(`reply-review: replied to ${replied} review thread(s)`);
