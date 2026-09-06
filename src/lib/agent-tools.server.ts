/**
 * Deckmind's real development tools.
 *
 * Every tool here performs a genuine, inspectable operation on the versioned
 * workspace, the database, or the deploy record. Anything this runtime truly
 * cannot do (shell, package installs, git push, production publish) returns a
 * structured "unsupported" result from UNSUPPORTED instead of pretending.
 */
import { tool } from "ai";
import { z } from "zod";

import {
  MAIN,
  UNSUPPORTED,
  activeBranch,
  analyseMigration,
  applyEdits,
  applyMigration,
  audit,
  branchFiles,
  checkoutBranch,
  commit,
  createBranch,
  createMigration,
  diffBranch,
  inspectSchema,
  listApprovals,
  listAudit,
  listBranches,
  listCommits,
  listDeploys,
  listFiles,
  listMigrations,
  listSecretNames,
  readFile,
  recordDeploy,
  requestApproval,
  revertCommit,
  search,
  validateFiles,
  type Actor,
  type Edit,
} from "./agent-workspace.server";

export const AGENT_DOCS = `YOUR DEVELOPMENT WORKSPACE (real tools, real effects)
- The workspace is a versioned copy of this project's source in the backend, layered over the build-time snapshot of the code that is actually running. read_file / search_code / list_files show the true current source.
- Edit with apply_edits (write/delete/move in one atomic set). Then validate_workspace (structural balance, import resolution, JSON validity, project conventions), diff_workspace to review, and commit_workspace to version it. revert_commit undoes any commit.
- Work on branches: create_branch / checkout_branch / list_branches, and inspect history with list_commits and list_audit.
- Database: inspect_schema reads the live schema. create_migration writes and validates SQL (GRANT + RLS + policy checks). apply_migration RUNS it, but only with an owner-approved confirmation_token — call request_confirmation first, tell the owner to approve it in Admin panel → Approvals, then call apply_migration again with the token.
- Deploy: record_deploy logs a build of a branch; list_deploys shows history. The Netlify-ready static export is downloadable from the Admin panel.
- runtime_limits explains, honestly, what this runtime cannot do (no shell, no package installs, no git remote, no production publish). Never claim you did any of those.
- Always report exactly which files you changed and which checks passed or failed.`;

export function makeAgentTools(actor: Actor) {
  const br = (b: string | null | undefined) => b || MAIN;

  return {
    runtime_limits: tool({
      description: "What this runtime genuinely cannot do, and what to do instead.",
      inputSchema: z.object({}),
      execute: async () => ({ unsupported: UNSUPPORTED, workspace_branch_default: MAIN }),
    }),

    list_branches: tool({
      description: "List workspace branches and which one is active.",
      inputSchema: z.object({}),
      execute: async () => ({ branches: await listBranches(), active: await activeBranch() }),
    }),
    create_branch: tool({
      description: "Create a workspace branch copied from a base branch.",
      inputSchema: z.object({
        name: z.string(),
        base: z.string().nullable(),
        description: z.string().nullable(),
      }),
      execute: async (i) => createBranch(i.name, br(i.base), i.description, actor),
    }),
    checkout_branch: tool({
      description: "Make a branch the active one.",
      inputSchema: z.object({ name: z.string() }),
      execute: async (i) => checkoutBranch(i.name),
    }),

    list_files: tool({
      description: "List real project file paths on a branch, optionally filtered by a glob.",
      inputSchema: z.object({ branch: z.string().nullable(), glob: z.string().nullable() }),
      execute: async (i) => listFiles(br(i.branch), i.glob),
    }),
    read_file: tool({
      description: "Read a project file (line-numbered) from a branch.",
      inputSchema: z.object({
        path: z.string(),
        branch: z.string().nullable(),
        from_line: z.number().nullable(),
        to_line: z.number().nullable(),
      }),
      execute: async (i) =>
        readFile(br(i.branch), i.path, i.from_line ?? undefined, i.to_line ?? undefined),
    }),
    search_code: tool({
      description: "Regex search the project source on a branch.",
      inputSchema: z.object({
        pattern: z.string(),
        branch: z.string().nullable(),
        glob: z.string().nullable(),
      }),
      execute: async (i) => search(br(i.branch), i.pattern, i.glob),
    }),
    apply_edits: tool({
      description:
        "Create, rewrite, move or delete project files on a branch as one atomic change set. Always pass full file contents for writes.",
      inputSchema: z.object({
        branch: z.string().nullable(),
        edits: z.array(
          z.object({
            op: z.enum(["write", "delete", "move"]),
            path: z.string(),
            content: z.string().nullable(),
            to: z.string().nullable(),
          }),
        ),
      }),
      execute: async (i) => {
        const edits: Edit[] = [];
        for (const e of i.edits) {
          if (e.op === "write") edits.push({ op: "write", path: e.path, content: e.content ?? "" });
          else if (e.op === "delete") edits.push({ op: "delete", path: e.path });
          else {
            if (!e.to) return { ok: false, error: `move needs "to" for ${e.path}` };
            edits.push({ op: "move", path: e.path, to: e.to });
          }
        }
        return applyEdits(br(i.branch), edits, actor);
      },
    }),
    validate_workspace: tool({
      description:
        "Run the real static checks available here: structural balance, import resolution, JSON validity, project conventions.",
      inputSchema: z.object({ branch: z.string().nullable(), paths: z.array(z.string()).nullable() }),
      execute: async (i) => {
        const files = await branchFiles(br(i.branch));
        const result = validateFiles(files, i.paths ?? undefined);
        await audit("validate_workspace", { branch: br(i.branch) }, `${result.findings.length} findings`, result.ok, actor);
        return result;
      },
    }),
    diff_workspace: tool({
      description: "Unified diff of a branch against the live published source.",
      inputSchema: z.object({ branch: z.string().nullable(), path: z.string().nullable() }),
      execute: async (i) => diffBranch(br(i.branch), i.path),
    }),
    commit_workspace: tool({
      description: "Version the current branch changes with a message.",
      inputSchema: z.object({ branch: z.string().nullable(), message: z.string() }),
      execute: async (i) => commit(br(i.branch), i.message, actor),
    }),
    list_commits: tool({
      description: "Recent commits, newest first.",
      inputSchema: z.object({ branch: z.string().nullable() }),
      execute: async (i) => listCommits(i.branch ?? null),
    }),
    revert_commit: tool({
      description: "Roll a commit back, restoring every file it touched.",
      inputSchema: z.object({ commit_id: z.string() }),
      execute: async (i) => revertCommit(i.commit_id, actor),
    }),

    inspect_schema: tool({
      description: "Read the live database schema: tables, columns, RLS state, policies, functions.",
      inputSchema: z.object({}),
      execute: async () => inspectSchema(),
    }),
    create_migration: tool({
      description:
        "Write and validate a database migration (checks GRANTs, RLS, policies, destructive statements). Does not run it.",
      inputSchema: z.object({ name: z.string(), sql: z.string() }),
      execute: async (i) => createMigration(i.name, i.sql, actor),
    }),
    check_migration_sql: tool({
      description: "Validate SQL without saving it.",
      inputSchema: z.object({ sql: z.string() }),
      execute: async (i) => analyseMigration(i.sql),
    }),
    list_migrations: tool({
      description: "Saved migrations and their status.",
      inputSchema: z.object({}),
      execute: async () => listMigrations(),
    }),
    apply_migration: tool({
      description:
        "Actually run a saved migration against the live database. Requires an owner-approved confirmation_token.",
      inputSchema: z.object({
        migration_id: z.string(),
        confirmation_token: z.string().nullable(),
      }),
      execute: async (i) => {
        if (!i.confirmation_token) {
          return requestApproval(
            "apply_migration",
            `Run migration ${i.migration_id} on the live database`,
            { migration_id: i.migration_id },
            actor,
          );
        }
        return applyMigration(i.migration_id, i.confirmation_token, actor);
      },
    }),

    request_confirmation: tool({
      description:
        "Ask the owner to approve a sensitive action. Returns an approval id; the owner approves it in Admin panel → Approvals.",
      inputSchema: z.object({
        action: z.enum([
          "apply_migration",
          "promote_to_production",
          "delete_production_data",
          "disable_security",
          "rotate_secret",
          "delete_branch_history",
        ]),
        summary: z.string(),
        details_json: z.string().nullable(),
      }),
      execute: async (i) => {
        let details: Record<string, unknown> = {};
        if (i.details_json) {
          try {
            details = JSON.parse(i.details_json) as Record<string, unknown>;
          } catch {
            return { ok: false, error: "details_json was not valid JSON" };
          }
        }
        return requestApproval(i.action, i.summary, details, actor);
      },
    }),
    list_approvals: tool({
      description: "Pending and decided owner approvals.",
      inputSchema: z.object({}),
      execute: async () => listApprovals(),
    }),

    record_deploy: tool({
      description:
        "Record a build of a branch (label + notes). The owner downloads the Netlify-ready zip from the Admin panel; promoting to production is a pipeline step.",
      inputSchema: z.object({
        label: z.string(),
        branch: z.string().nullable(),
        notes: z.string().nullable(),
      }),
      execute: async (i) => {
        const branch = br(i.branch);
        const files = await branchFiles(branch);
        return recordDeploy(i.label, branch, Object.keys(files).length, i.notes ?? "", actor);
      },
    }),
    list_deploys: tool({
      description: "Deploy history.",
      inputSchema: z.object({}),
      execute: async () => listDeploys(),
    }),
    promote_to_production: tool({
      description: "Attempt to publish the live app. Reports the real boundary of this runtime.",
      inputSchema: z.object({ branch: z.string().nullable() }),
      execute: async (i) => ({
        ok: false,
        branch: br(i.branch),
        reason: UNSUPPORTED["production_deploy"],
      }),
    }),
    run_shell: tool({
      description: "Run a terminal command (bun/npm/git/tsc/tests). Reports the real boundary.",
      inputSchema: z.object({ command: z.string() }),
      execute: async (i) => ({ ok: false, command: i.command, reason: UNSUPPORTED["shell"] }),
    }),

    list_secret_names: tool({
      description: "Names of configured server secrets. Values never leave the server.",
      inputSchema: z.object({}),
      execute: async () => ({ secrets: listSecretNames() }),
    }),
    list_audit: tool({
      description: "Audit log of everything the agent has done.",
      inputSchema: z.object({}),
      execute: async () => listAudit(),
    }),
  } as const;
}
