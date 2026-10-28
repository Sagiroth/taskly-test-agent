#!/usr/bin/env node
// Review mode: collects the review comments the agent has to answer and marks them with 👀.
// Writes .test-agent/context/review-comments.md (for the agent) and .test-agent/review-comments.json (for the replies).
// Needs GH_TOKEN, GITHUB_REPOSITORY and PR_NUMBER.
import path from 'node:path';
import { api, requireEnv } from './lib/gh.mjs';
import { WORK_DIR, writeFile, writeJson } from './lib/io.mjs';
import { isCandidate, renderReviewComments, selectReviewComments } from './lib/review.mjs';

const BOT = 'github-actions[bot]';
const [repo, pr] = requireEnv('GITHUB_REPOSITORY', 'PR_NUMBER');
const endpoints = { inline: `repos/${repo}/pulls/comments`, conversation: `repos/${repo}/issues/comments` };

const inline = api(`repos/${repo}/pulls/${pr}/comments`, { paginate: true });
const conversation = api(`repos/${repo}/issues/${pr}/comments`, { paginate: true });

// A 👀 from the agent means the comment was already picked up by an earlier run.
const seen = new Set();
for (const [kind, comments] of [['inline', inline], ['conversation', conversation]]) {
  for (const comment of comments.filter(isCandidate)) {
    const reactions = api(`${endpoints[kind]}/${comment.id}/reactions?content=eyes`, { paginate: true });
    if (reactions.some((reaction) => reaction.user?.login === BOT)) seen.add(comment.id);
  }
}

const selected = selectReviewComments({ inline, conversation, seen });
writeJson(path.join(WORK_DIR, 'review-comments.json'), selected);
if (selected.length) writeFile(path.join(WORK_DIR, 'context', 'review-comments.md'), renderReviewComments(selected));
for (const comment of selected) api(`${endpoints[comment.kind]}/${comment.id}/reactions`, { method: 'POST', body: { content: 'eyes' } });

console.log(`review-comments: ${selected.length} new comment(s) for the agent, ${seen.size} already handled`);
