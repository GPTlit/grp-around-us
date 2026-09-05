/**
 * Real source snapshot of this project, embedded at build time.
 *
 * Vite inlines every matched file as a raw string, which gives the in-app agent
 * genuine read access to the code that is actually running — no filesystem
 * needed (the edge runtime has none).
 */
const RAW = import.meta.glob("/src/**/*.{ts,tsx,css,md,json}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const EXTRA = import.meta.glob("/*.{ts,json,md,toml}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** path -> file contents, paths are repo-relative (e.g. "src/lib/game.ts"). */
export const SOURCE: Record<string, string> = Object.fromEntries(
  [...Object.entries(RAW), ...Object.entries(EXTRA)].map(([k, v]) => [k.replace(/^\//, ""), v]),
);

export const SOURCE_PATHS = Object.keys(SOURCE).sort();

export function readSource(path: string): string | null {
  return SOURCE[normalizePath(path)] ?? null;
}

export function normalizePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\\/g, "/").trim();
}

export type SearchHit = { path: string; line: number; text: string };

export function searchSource(
  files: Record<string, string>,
  pattern: string,
  opts: { glob?: string | null; limit?: number } = {},
): SearchHit[] {
  const limit = opts.limit ?? 80;
  let re: RegExp;
  try {
    re = new RegExp(pattern, "i");
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  const globRe = opts.glob ? globToRegExp(opts.glob) : null;
  const hits: SearchHit[] = [];
  for (const path of Object.keys(files).sort()) {
    if (globRe && !globRe.test(path)) continue;
    const lines = (files[path] ?? "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? "";
      if (re.test(text)) {
        hits.push({ path, line: i + 1, text: text.slice(0, 240) });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

/** Compact unified diff between two texts. */
export function unifiedDiff(before: string, after: string, path: string): string {
  if (before === after) return `# ${path}: no changes`;
  const a = before === "" ? [] : before.split("\n");
  const b = after === "" ? [] : after.split("\n");
  const out: string[] = [`--- a/${path}`, `+++ b/${path}`];

  // Guard the DP table on very large files: fall back to a coarse replace hunk.
  if (a.length * b.length > 4_000_000) {
    out.push(`@@ -1,${a.length} +1,${b.length} @@`);
    for (const l of a) out.push(`-${l}`);
    for (const l of b) out.push(`+${l}`);
    return out.join("\n");
  }

  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const ops: { sign: " " | "-" | "+"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ sign: " ", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ops.push({ sign: "-", text: a[i]! });
      i++;
    } else {
      ops.push({ sign: "+", text: b[j]! });
      j++;
    }
  }
  while (i < a.length) ops.push({ sign: "-", text: a[i++]! });
  while (j < b.length) ops.push({ sign: "+", text: b[j++]! });

  // Emit hunks with 3 lines of context.
  const ctx = 3;
  let cursor = 0;
  let aLine = 1;
  let bLine = 1;
  const positions = ops.map((op) => {
    const pos = { a: aLine, b: bLine };
    if (op.sign !== "+") aLine++;
    if (op.sign !== "-") bLine++;
    return pos;
  });
  while (cursor < ops.length) {
    if (ops[cursor]!.sign === " ") {
      cursor++;
      continue;
    }
    let start = Math.max(0, cursor - ctx);
    let end = cursor;
    while (end < ops.length) {
      if (ops[end]!.sign !== " ") {
        end++;
        continue;
      }
      let run = 0;
      while (end + run < ops.length && ops[end + run]!.sign === " ") run++;
      if (run > ctx * 2 || end + run >= ops.length) {
        end += Math.min(run, ctx);
        break;
      }
      end += run;
    }
    const slice = ops.slice(start, end);
    const aCount = slice.filter((o) => o.sign !== "+").length;
    const bCount = slice.filter((o) => o.sign !== "-").length;
    out.push(`@@ -${positions[start]!.a},${aCount} +${positions[start]!.b},${bCount} @@`);
    for (const op of slice) out.push(`${op.sign}${op.text}`);
    cursor = end;
  }
  return out.join("\n");
}
