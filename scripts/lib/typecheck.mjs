const ERROR_LINE = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/;
const GLOBAL_ERROR = /^error (TS\d+): (.*)$/;
const MAX_ERRORS = 20;

// Parses `tsc --noEmit --pretty false` output run inside a package directory.
// Returns { ok, count, errors: [{ file, line, code, message }] } with repo-relative file paths.
export function parseTypecheck(output, pkg) {
  const errors = [];
  for (const line of output.split('\n')) {
    const located = ERROR_LINE.exec(line);
    if (located) {
      errors.push({ file: `${pkg}/${located[1].replaceAll('\\', '/')}`, line: Number(located[2]), code: located[3], message: located[4].trim() });
      continue;
    }
    const global = GLOBAL_ERROR.exec(line);
    if (global) errors.push({ file: null, line: null, code: global[1], message: global[2].trim() });
  }
  return { ok: errors.length === 0, count: errors.length, errors: errors.slice(0, MAX_ERRORS) };
}
