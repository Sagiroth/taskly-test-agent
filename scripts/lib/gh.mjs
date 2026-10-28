import { spawnSync } from 'node:child_process';

// GitHub REST call through the gh CLI, authenticated with GH_TOKEN. Only workflow steps use it, never the agent.
export function api(path, { method = 'GET', body, paginate = false } = {}) {
  const args = ['api', path, '--method', method];
  if (paginate) args.push('--paginate', '--slurp');
  if (body) args.push('--input', '-');
  const result = spawnSync('gh', args, { encoding: 'utf8', input: body ? JSON.stringify(body) : undefined, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`gh api ${method} ${path} failed: ${(result.stderr || result.error?.message || '').trim()}`);
  const data = result.stdout.trim() ? JSON.parse(result.stdout) : null;
  return paginate ? data.flat() : data;
}

export function requireEnv(...names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return names.map((name) => process.env[name]);
}
