// Parses `git diff -U0` output into the line numbers added or changed per file.
// Returns a Map of repo-relative POSIX path -> sorted array of line numbers in the new file.
export function parseAddedLines(diffText) {
  const added = new Map();
  let current = null;

  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = unquote(line.slice(4).trim());
      current = target === '/dev/null' ? null : target.replace(/^b\//, '');
      if (current && !added.has(current)) added.set(current, []);
      continue;
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const lines = added.get(current);
      for (let n = start; n < start + count; n++) lines.push(n);
    }
  }

  for (const [file, lines] of added) {
    if (lines.length === 0) added.delete(file);
    else lines.sort((a, b) => a - b);
  }
  return added;
}

// Git quotes paths containing special characters: "b/some file.ts".
function unquote(value) {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}
