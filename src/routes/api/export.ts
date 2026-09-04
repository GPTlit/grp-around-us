import { createFileRoute } from "@tanstack/react-router";
import { zipSync, strToU8 } from "fflate";

import { isAdminEmail } from "@/lib/admin";
import { parseBlocks, type AppConfig, type Extension } from "@/lib/blocks";
import { buildNetlifySite } from "@/lib/netlify-export";

type ConfigRow = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  settings: Record<string, unknown> | null;
};
type ExtRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  blocks: unknown;
  published: boolean;
  updated_at: string;
};
type DraftRow = { title: string; file_path: string; code: string; note: string | null };

async function rest<T>(table: string, query: string, token: string): Promise<T> {
  const res = await fetch(`${process.env["SUPABASE_URL"]}/rest/v1/${table}${query}`, {
    headers: {
      apikey: process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Backend error ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const userRes = await fetch(`${process.env["SUPABASE_URL"]}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          },
        });
        if (!userRes.ok) return new Response("Unauthorized", { status: 401 });
        const user = (await userRes.json()) as { email?: string | null };
        if (!isAdminEmail(user.email)) return new Response("Forbidden", { status: 403 });

        const origin = new URL(request.url).origin;

        try {
          const [configRows, extRows, draftRows] = await Promise.all([
            rest<ConfigRow[]>("app_config", "?id=eq.default&select=*", token),
            rest<ExtRow[]>(
              "extensions",
              "?select=id,slug,title,description,icon,blocks,published,updated_at&order=updated_at.desc",
              token,
            ),
            rest<DraftRow[]>(
              "code_drafts",
              "?select=title,file_path,code,note&order=created_at.desc&limit=60",
              token,
            ),
          ]);

          const row = configRows[0];
          const config: AppConfig = {
            id: "default",
            name: row?.name ?? "Liar's Deck",
            tagline: row?.tagline ?? "A 3-player bluffing card game with voice chat.",
            accent: row?.accent ?? "#e11d48",
            settings: row?.settings ?? {},
          };

          const extensions: Extension[] = extRows
            .filter((e) => e.published)
            .map((e) => ({
              id: e.id,
              slug: e.slug,
              title: e.title,
              description: e.description,
              icon: e.icon,
              blocks: parseBlocks(e.blocks),
              published: e.published,
              updated_at: e.updated_at,
            }));

          const files = buildNetlifySite({
            config,
            extensions,
            drafts: draftRows,
            liveUrl: origin,
          });

          const zipped = zipSync(
            Object.fromEntries(Object.entries(files).map(([p, c]) => [p, strToU8(c)])),
            { level: 6 },
          );
          const slug = config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

          return new Response(zipped as unknown as BodyInit, {
            headers: {
              "content-type": "application/zip",
              "content-disposition": `attachment; filename="${slug || "app"}-netlify.zip"`,
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Export failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
