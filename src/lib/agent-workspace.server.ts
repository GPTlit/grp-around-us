/**
 * Deckmind's real development workspace.
 *
 * The published app runs on an edge runtime with no filesystem, no git binary
 * and no shell, so the workspace is a versioned copy of the project source in
 * Lovable Cloud, layered over the build-time source snapshot. Every operation
 * here has a real, inspectable effect and is written to an audit log.
 */
import { SOURCE, normalizePath, searchSource, unifiedDiff, globToRegExp } from "./agent-source.server";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

let adminClient: Admin | undefined;
async function db(): Promise<Admin> {
  if (!adminClient) {
    const mod = await import("@/integrations/supabase/client.server");
    adminClient = mod.supabaseAdmin;
  }
  return adminClient;
}

export const MAIN = "main";

export type Actor = { userId: string; email: string };

export type FileRow = { path: string; content: string; deleted: boolean };

export async function audit(
  tool: string,
  input: unknown,
  outcome: string,
  ok: boolean,
  actor: Actor,
): Promise<void> {
  const supabase = await db();
  await supabase.from("agent_audit").insert({
    tool,
    input: JSON.parse(JSON.stringify(input ?? {})),
    outcome: outcome.slice(0, 4000),
    ok,
    actor: actor.userId,
  });
}

/* ---------------------------------------------------------------- branches */

export async function listBranches() {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_branches")
    .select("name, base_branch, description, active, created_at, updated_at")
    .order("created_at", { ascending: true });
  const branches = data ?? [];
  if (!branches.some((b) => b.name === MAIN)) {
    branches.unshift({
      name: MAIN,
      base_branch: MAIN,
      description: "Live project source (read-only baseline plus committed edits)",
      active: !branches.some((b) => b.active),
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
  }
  return branches;
}

export async function activeBranch(): Promise<string> {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_branches")
    .select("name")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return data?.name ?? MAIN;
}

export async function createBranch(
  name: string,
  base: string,
  description: string | null,
  actor: Actor,
) {
  const supabase = await db();
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^-|-$/g, "");
  const baseBranch = base || MAIN;
  const { error } = await supabase
    .from("agent_branches")
    .insert({ name: safe, base_branch: baseBranch, description, created_by: actor.userId });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);

  // Copy the base branch's overlay so the new branch starts identical to it.
  const { data: baseFiles } = await supabase
    .from("agent_files")
    .select("path, content, deleted")
    .eq("branch", baseBranch);
  if (baseFiles?.length) {
    await supabase.from("agent_files").upsert(
      baseFiles.map((f) => ({ branch: safe, path: f.path, content: f.content, deleted: f.deleted })),
      { onConflict: "branch,path" },
    );
  }
  return { branch: safe, base: baseBranch, copied_files: baseFiles?.length ?? 0 };
}

export async function checkoutBranch(name: string) {
  const supabase = await db();
  await supabase.from("agent_branches").update({ active: false }).neq("name", "");
  if (name !== MAIN) await supabase.from("agent_branches").update({ active: true }).eq("name", name);
  return { active_branch: name };
}

/* ------------------------------------------------------------------- files */

async function overlay(branch: string): Promise<Map<string, FileRow>> {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_files")
    .select("path, content, deleted")
    .eq("branch", branch);
  return new Map((data ?? []).map((f) => [f.path, f as FileRow]));
}

/** Full view of the branch: build-time source overlaid with workspace edits. */
export async function branchFiles(branch: string): Promise<Record<string, string>> {
  const files: Record<string, string> = { ...SOURCE };
  for (const [path, row] of await overlay(branch)) {
    if (row.deleted) delete files[path];
    else files[path] = row.content;
  }
  return files;
}

export async function listFiles(branch: string, glob: string | null, limit = 400) {
  const files = await branchFiles(branch);
  const re = glob ? globToRegExp(glob) : null;
  const paths = Object.keys(files)
    .filter((p) => !re || re.test(p))
    .sort();
  return {
    branch,
    total: paths.length,
    paths: paths.slice(0, limit),
    truncated: paths.length > limit,
  };
}

export async function readFile(branch: string, path: string, from?: number, to?: number) {
  const p = normalizePath(path);
  const files = await branchFiles(branch);
  const content = files[p];
  if (content === undefined) return { ok: false as const, error: `File not found: ${p}` };
  const lines = content.split("\n");
  const start = Math.max(1, from ?? 1);
  const end = Math.min(lines.length, to ?? lines.length);
  const slice = lines.slice(start - 1, end);
  const numbered = slice.map((l, i) => `${start + i}: ${l}`).join("\n");
  return {
    ok: true as const,
    path: p,
    branch,
    lines: lines.length,
    shown: `${start}-${end}`,
    content: numbered.length > 60_000 ? `${numbered.slice(0, 60_000)}\n…truncated` : numbered,
  };
}

export async function search(branch: string, pattern: string, glob: string | null, limit?: number) {
  const files = await branchFiles(branch);
  const hits = searchSource(files, pattern, { glob, limit });
  return { branch, pattern, hit_count: hits.length, hits };
}

export type Edit =
  | { op: "write"; path: string; content: string }
  | { op: "delete"; path: string }
  | { op: "move"; path: string; to: string };

/** Applies a set of edits as one unit; nothing is written if validation fails. */
export async function applyEdits(branch: string, edits: Edit[], actor: Actor) {
  const supabase = await db();
  const files = await branchFiles(branch);
  const next = new Map<string, FileRow>();

  for (const edit of edits) {
    const path = normalizePath(edit.path);
    if (!path || path.includes("..")) return { ok: false as const, error: `Unsafe path: ${edit.path}` };
    if (edit.op === "write") {
      next.set(path, { path, content: edit.content, deleted: false });
      files[path] = edit.content;
    } else if (edit.op === "delete") {
      if (files[path] === undefined) return { ok: false as const, error: `File not found: ${path}` };
      next.set(path, { path, content: "", deleted: true });
      delete files[path];
    } else {
      const to = normalizePath(edit.to);
      const content = files[path];
      if (content === undefined) return { ok: false as const, error: `File not found: ${path}` };
      next.set(path, { path, content: "", deleted: true });
      next.set(to, { path: to, content, deleted: false });
      delete files[path];
      files[to] = content;
    }
  }

  const rows = [...next.values()].map((r) => ({
    branch,
    path: r.path,
    content: r.content,
    deleted: r.deleted,
  }));
  const { error } = await supabase.from("agent_files").upsert(rows, { onConflict: "branch,path" });
  if (error) return { ok: false as const, error: error.message };

  const checks = validateFiles(files, rows.map((r) => r.path));
  await audit("apply_edits", { branch, paths: rows.map((r) => r.path) }, `${rows.length} paths`, true, actor);
  return { ok: true as const, branch, changed: rows.map((r) => r.path), checks };
}

/* ------------------------------------------------------------------ checks */

export type CheckResult = { level: "error" | "warn"; path: string; message: string };

/**
 * Static checks that can genuinely run in this runtime: structural balance,
 * import resolution, JSON validity and project conventions. This is not tsc —
 * see `runToolchain` for what the edge runtime cannot do.
 */
export function validateFiles(files: Record<string, string>, only?: string[]): {
  ok: boolean;
  checked: number;
  findings: CheckResult[];
} {
  const paths = (only && only.length ? only : Object.keys(files)).filter((p) => files[p] !== undefined);
  const findings: CheckResult[] = [];

  for (const path of paths) {
    const src = files[path]!;
    if (path.endsWith(".json")) {
      try {
        JSON.parse(src);
      } catch (e) {
        findings.push({ level: "error", path, message: `Invalid JSON: ${(e as Error).message}` });
      }
      continue;
    }
    if (!/\.(ts|tsx)$/.test(path)) continue;

    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");
    for (const [open, close, label] of [
      ["{", "}", "braces"],
      ["(", ")", "parens"],
      ["[", "]", "brackets"],
    ] as const) {
      const diff =
        stripped.split(open).length - stripped.split(close).length;
      if (diff !== 0) {
        findings.push({
          level: "error",
          path,
          message: `Unbalanced ${label} (${diff > 0 ? `${diff} unclosed` : `${-diff} extra closing`})`,
        });
      }
    }

    for (const m of src.matchAll(/from\s+["'](@\/[^"']+)["']/g)) {
      const spec = m[1]!.replace(/^@\//, "src/");
      const candidates = [
        spec,
        `${spec}.ts`,
        `${spec}.tsx`,
        `${spec}/index.ts`,
        `${spec}/index.tsx`,
      ];
      if (!candidates.some((c) => files[c] !== undefined)) {
        findings.push({ level: "error", path, message: `Unresolved import "${m[1]}"` });
      }
    }
    for (const m of src.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
      const dir = path.split("/").slice(0, -1);
      const parts = m[1]!.split("/");
      const stack = [...dir];
      for (const part of parts) {
        if (part === ".") continue;
        else if (part === "..") stack.pop();
        else stack.push(part);
      }
      const spec = stack.join("/");
      const candidates = [spec, `${spec}.ts`, `${spec}.tsx`, `${spec}/index.ts`, `${spec}/index.tsx`];
      if (!candidates.some((c) => files[c] !== undefined)) {
        findings.push({ level: "warn", path, message: `Unresolved relative import "${m[1]}"` });
      }
    }

    if (/className=["'][^"']*\b(text-white|bg-black|text-black|bg-white)\b/.test(src)) {
      findings.push({
        level: "warn",
        path,
        message: "Hardcoded colour utility; use semantic design tokens instead",
      });
    }
    if (/from ["']react-router-dom["']/.test(src)) {
      findings.push({ level: "error", path, message: "react-router-dom is not allowed in this project" });
    }
    if (path.startsWith("src/routes/") && /createServerFn/.test(src) && /\.server["']/.test(src)) {
      findings.push({
        level: "warn",
        path,
        message: "Route file imports a .server module at top level; import it inside the handler",
      });
    }
  }
  return { ok: !findings.some((f) => f.level === "error"), checked: paths.length, findings };
}

/* ----------------------------------------------------------------- commits */

export async function diffBranch(branch: string, path?: string | null) {
  const supabase = await db();
  const rows = await overlay(branch);
  const { data: commits } = await supabase
    .from("agent_commits")
    .select("snapshot")
    .eq("branch", branch)
    .eq("reverted", false);
  // Baseline = build-time source (the last published state).
  const diffs: { path: string; diff: string }[] = [];
  for (const [p, row] of rows) {
    if (path && normalizePath(path) !== p) continue;
    const before = SOURCE[p] ?? "";
    const after = row.deleted ? "" : row.content;
    if (before === after) continue;
    diffs.push({ path: p, diff: unifiedDiff(before, after, p) });
  }
  return {
    branch,
    commit_count: commits?.length ?? 0,
    changed_files: diffs.length,
    diffs: diffs.slice(0, 20),
  };
}

export async function commit(branch: string, message: string, actor: Actor) {
  const supabase = await db();
  const rows = await overlay(branch);
  const { data: last } = await supabase
    .from("agent_commits")
    .select("snapshot")
    .eq("branch", branch)
    .eq("reverted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previous = new Map<string, string | null>(
    ((last?.snapshot as { path: string; after: string | null }[] | null) ?? []).map((s) => [
      s.path,
      s.after,
    ]),
  );

  const snapshot: { path: string; before: string | null; after: string | null }[] = [];
  for (const [p, row] of rows) {
    const after = row.deleted ? null : row.content;
    const before = previous.has(p) ? previous.get(p)! : (SOURCE[p] ?? null);
    if (before === after) continue;
    snapshot.push({ path: p, before, after });
  }
  if (!snapshot.length) return { ok: false as const, error: "Nothing to commit on this branch." };

  const { data, error } = await supabase
    .from("agent_commits")
    .insert({
      branch,
      message,
      changed_paths: snapshot.map((s) => s.path),
      snapshot,
      created_by: actor.userId,
    })
    .select("id, created_at")
    .single();
  if (error) return { ok: false as const, error: error.message };
  await audit("commit", { branch, message }, `${snapshot.length} files`, true, actor);
  return {
    ok: true as const,
    commit: data.id,
    branch,
    message,
    files: snapshot.map((s) => s.path),
    created_at: data.created_at,
  };
}

export async function listCommits(branch: string | null, limit = 20) {
  const supabase = await db();
  let query = supabase
    .from("agent_commits")
    .select("id, branch, message, changed_paths, reverted, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (branch) query = query.eq("branch", branch);
  const { data } = await query;
  return { commits: data ?? [] };
}

export async function revertCommit(commitId: string, actor: Actor) {
  const supabase = await db();
  const { data: c } = await supabase
    .from("agent_commits")
    .select("id, branch, message, snapshot, reverted")
    .eq("id", commitId)
    .maybeSingle();
  if (!c) return { ok: false as const, error: "Commit not found" };
  if (c.reverted) return { ok: false as const, error: "Commit is already reverted" };
  const snapshot = (c.snapshot as { path: string; before: string | null }[]) ?? [];
  const rows = snapshot.map((s) => ({
    branch: c.branch,
    path: s.path,
    content: s.before ?? "",
    deleted: s.before === null,
  }));
  if (rows.length) {
    const { error } = await supabase.from("agent_files").upsert(rows, { onConflict: "branch,path" });
    if (error) return { ok: false as const, error: error.message };
  }
  await supabase.from("agent_commits").update({ reverted: true }).eq("id", commitId);
  await audit("revert_commit", { commitId }, `${rows.length} files restored`, true, actor);
  return {
    ok: true as const,
    reverted: commitId,
    branch: c.branch,
    restored: rows.map((r) => r.path),
  };
}

/* --------------------------------------------------------------- approvals */

export const CONFIRM_ACTIONS = [
  "apply_migration",
  "promote_to_production",
  "delete_production_data",
  "disable_security",
  "rotate_secret",
  "delete_branch_history",
] as const;
export type ConfirmAction = (typeof CONFIRM_ACTIONS)[number];

export async function requestApproval(
  action: ConfirmAction,
  summary: string,
  details: Record<string, unknown>,
  actor: Actor,
) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("agent_approvals")
    .insert({ action, summary, details })
    .select("id, token, action, summary")
    .single();
  if (error) throw new Error(error.message);
  await audit("request_approval", { action, summary }, "pending", true, actor);
  return {
    requires_confirmation: true as const,
    approval_id: data.id,
    action,
    summary,
    how: "The owner must approve this in the Admin panel → Approvals. Then call the tool again with confirmation_token.",
  };
}

export async function approvedToken(action: ConfirmAction, token: string) {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_approvals")
    .select("id, action, status, details, token")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.action !== action || data.status !== "approved") return null;
  return data;
}

export async function consumeApproval(id: string) {
  const supabase = await db();
  await supabase
    .from("agent_approvals")
    .update({ status: "used", decided_at: new Date().toISOString() })
    .eq("id", id);
}

export async function listApprovals() {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_approvals")
    .select("id, action, summary, details, status, created_at, decided_at")
    .order("created_at", { ascending: false })
    .limit(40);
  return { approvals: data ?? [] };
}

export async function decideApproval(id: string, approve: boolean, actor: Actor) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("agent_approvals")
    .update({
      status: approve ? "approved" : "rejected",
      approved_by: actor.userId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, action, token, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/* -------------------------------------------------------------- migrations */

const DESTRUCTIVE =
  /\b(drop\s+(table|column|schema|database|function|policy|type)|truncate|delete\s+from|alter\s+table\s+[^;]*disable\s+row\s+level\s+security|drop\s+policy|revoke)\b/i;
const FORBIDDEN = /\b(alter\s+database|drop\s+database|create\s+extension\s+.*wrappers)\b/i;

export function analyseMigration(sql: string) {
  const findings: string[] = [];
  const destructive = DESTRUCTIVE.test(sql);
  if (FORBIDDEN.test(sql)) findings.push("Contains a statement that is never allowed (ALTER/DROP DATABASE).");
  const creates = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)].map(
    (m) => m[1]!,
  );
  for (const t of creates) {
    if (!new RegExp(`grant[^;]+public\\.${t}\\b`, "i").test(sql))
      findings.push(`CREATE TABLE public.${t} has no GRANT statements.`);
    if (!new RegExp(`alter\\s+table\\s+public\\.${t}[^;]*enable\\s+row\\s+level\\s+security`, "i").test(sql))
      findings.push(`public.${t} does not enable row level security.`);
    if (!new RegExp(`create\\s+policy[^;]+on\\s+public\\.${t}\\b`, "i").test(sql))
      findings.push(`public.${t} has no policies, so it will be unreachable.`);
  }
  if (/\bauth\.users\b/i.test(sql) && /references\s+auth\.users/i.test(sql))
    findings.push("Avoid foreign keys to auth.users; reference public.profiles instead.");
  if (/check\s*\([^)]*now\(\)/i.test(sql))
    findings.push("CHECK constraints must be immutable; use a trigger for time-based rules.");
  return {
    destructive,
    blocked: FORBIDDEN.test(sql),
    ok: findings.length === 0 && !FORBIDDEN.test(sql),
    findings,
    statements: sql.split(/;\s*\n/).filter((s) => s.trim()).length,
  };
}

export async function createMigration(name: string, sql: string, actor: Actor) {
  const supabase = await db();
  const analysis = analyseMigration(sql);
  const safeName = `${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;
  const { data, error } = await supabase
    .from("agent_migrations")
    .insert({
      name: safeName,
      sql,
      destructive: analysis.destructive,
      validation: analysis,
      status: analysis.blocked ? "blocked" : "validated",
      created_by: actor.userId,
    })
    .select("id, name, status, destructive")
    .single();
  if (error) throw new Error(error.message);
  await audit("create_migration", { name: safeName }, data.status, !analysis.blocked, actor);
  return { ...data, validation: analysis };
}

export async function listMigrations() {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_migrations")
    .select("id, name, status, destructive, validation, applied_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return { migrations: data ?? [] };
}

export async function applyMigration(id: string, token: string, actor: Actor) {
  const supabase = await db();
  const approval = await approvedToken("apply_migration", token);
  if (!approval || (approval.details as { migration_id?: string }).migration_id !== id) {
    return { ok: false as const, error: "This migration has no approved confirmation token." };
  }
  const { data, error } = await supabase.rpc("agent_apply_migration_admin", {
    _migration_id: id,
    _token: token,
  });
  if (error) {
    await supabase
      .from("agent_migrations")
      .update({ status: "failed", validation: { error: error.message } })
      .eq("id", id);
    await audit("apply_migration", { id }, error.message, false, actor);
    return { ok: false as const, error: error.message };
  }
  await audit("apply_migration", { id }, "applied", true, actor);
  return { ok: true as const, result: data };
}

export async function inspectSchema() {
  const supabase = await db();
  const { data, error } = await supabase.rpc("agent_inspect_schema_admin");
  if (error) throw new Error(error.message);
  return data;
}

/* ------------------------------------------------------------------ deploy */

export async function recordDeploy(
  label: string,
  branch: string,
  fileCount: number,
  notes: string,
  actor: Actor,
) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("agent_deploys")
    .insert({ label, branch, file_count: fileCount, notes, created_by: actor.userId })
    .select("id, label, branch, status, file_count, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listDeploys() {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_deploys")
    .select("id, label, branch, status, file_count, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return { deploys: data ?? [] };
}

export async function listAudit(limit = 60) {
  const supabase = await db();
  const { data } = await supabase
    .from("agent_audit")
    .select("id, tool, input, outcome, ok, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { audit: data ?? [] };
}

/** Secret names only — values never leave the server. */
export function listSecretNames() {
  const skip = /^(npm_|_|PWD$|HOME$|PATH$|SHELL$|TERM$)/;
  return Object.keys(process.env)
    .filter((k) => !skip.test(k) && !k.startsWith("VITE_"))
    .sort()
    .map((name) => ({ name, configured: true }));
}

/**
 * Honest boundary report for the things this runtime cannot do.
 * Returned to the model as a structured error so it never fakes results.
 */
export const UNSUPPORTED: Record<string, string> = {
  shell:
    "No shell in this runtime: bun/npm/git binaries, package installs and process spawning are unavailable. Use validate_workspace for real static checks and hand the branch to the Lovable pipeline for tsgo/tests/build.",
  build:
    "Production builds run in the Lovable build pipeline, not in the app runtime. Commit the branch and export it; the build then runs outside the app.",
  git_remote:
    "There is no git remote or push credential in the app runtime. Branches and commits here are workspace-level; promoting them to the real repository is a pipeline step.",
  production_deploy:
    "Publishing the live app requires the Lovable deploy pipeline. Deckmind can build and record a preview bundle and request owner approval, but cannot promote to production itself.",
};
