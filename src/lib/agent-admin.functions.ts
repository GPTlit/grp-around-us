import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdminEmail } from "@/lib/admin";

type Claims = { email?: string; sub?: string };

function owner(context: { claims: unknown; userId: string }) {
  const claims = context.claims as Claims;
  if (!isAdminEmail(claims.email)) throw new Error("Forbidden");
  return { userId: context.userId, email: claims.email ?? "" };
}

/** Pending approvals, recent commits, branches and the audit trail. */
export const getAgentWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    owner(context);
    const ws = await import("./agent-workspace.server");
    const [approvals, commits, branches, log, deploys] = await Promise.all([
      ws.listApprovals(),
      ws.listCommits(null, 10),
      ws.listBranches(),
      ws.listAudit(20),
      ws.listDeploys(),
    ]);
    return {
      approvals: approvals.approvals,
      commits: commits.commits,
      branches: branches.map((b) => ({ name: b.name, active: b.active })),
      audit: log.audit,
      deploys: deploys.deploys,
    };
  });

/** Approve or reject a sensitive action the agent requested. */
export const decideAgentApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; approve: boolean }) => input)
  .handler(async ({ data, context }) => {
    const actor = owner(context);
    const ws = await import("./agent-workspace.server");
    const row = await ws.decideApproval(data.id, data.approve, actor);
    return { ok: Boolean(row), status: row?.status ?? null };
  });
