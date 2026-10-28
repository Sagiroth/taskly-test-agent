import path from 'node:path';

// Hit count per line, using Istanbul semantics: a statement belongs to the line it starts on,
// and a line with several statements takes the highest count.
export function lineHits(fileCoverage) {
  const hits = new Map();
  for (const [id, location] of Object.entries(fileCoverage.statementMap)) {
    const line = location.start.line;
    const count = fileCoverage.s[id] ?? 0;
    if (!hits.has(line) || hits.get(line) < count) hits.set(line, count);
  }
  return hits;
}

// Coverage of the changed lines only. Lines without statements (comments, types, braces) are ignored.
// coverageFinal: Istanbul coverage-final.json keyed by absolute path.
// addedLines: Map of repo-relative path -> changed line numbers (see parseAddedLines).
export function diffCoverage(coverageFinal, addedLines, root) {
  const files = {};
  let coverable = 0;
  let covered = 0;

  for (const [absolutePath, fileCoverage] of Object.entries(coverageFinal)) {
    const file = toRepoPath(absolutePath, root);
    const changed = addedLines.get(file);
    if (!changed) continue;

    const hits = lineHits(fileCoverage);
    const relevant = changed.filter((line) => hits.has(line));
    if (relevant.length === 0) continue;

    const uncovered = relevant.filter((line) => hits.get(line) === 0);
    coverable += relevant.length;
    covered += relevant.length - uncovered.length;
    files[file] = {
      coverable: relevant.length,
      covered: relevant.length - uncovered.length,
      uncovered: toRanges(uncovered),
    };
  }

  return { coverable, covered, pct: coverable ? round((covered / coverable) * 100) : null, files };
}

// Compact view of coverage-summary.json: totals, optionally the given files, and the weakest files.
export function summarizeCoverage(summary, root, { files, lowestCount = 10 } = {}) {
  const entries = Object.entries(summary)
    .filter(([key]) => key !== 'total')
    .map(([absolutePath, metrics]) => [toRepoPath(absolutePath, root), pick(metrics)]);

  const result = { total: pick(summary.total) };
  if (files) {
    const wanted = new Set(files);
    result.files = Object.fromEntries(entries.filter(([file]) => wanted.has(file)));
  }
  result.lowest = entries
    .filter(([, metrics]) => metrics.lines < 100)
    .sort(([, a], [, b]) => a.lines - b.lines)
    .slice(0, lowestCount)
    .map(([file, metrics]) => ({ file, ...metrics }));
  return result;
}

// [3, 4, 5, 9] -> "3-5,9"
export function toRanges(lines) {
  const ranges = [];
  for (const line of lines) {
    const last = ranges.at(-1);
    if (last && line === last[1] + 1) last[1] = line;
    else ranges.push([line, line]);
  }
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(',');
}

export function toRepoPath(absolutePath, root) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function pick(metrics) {
  return {
    lines: metrics.lines.pct,
    statements: metrics.statements.pct,
    branches: metrics.branches.pct,
    functions: metrics.functions.pct,
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
