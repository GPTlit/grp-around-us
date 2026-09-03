import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";

import { createStudioModel } from "@/lib/ai-gateway.server";
import { BLOCK_DOCS } from "@/lib/blocks";

const SYSTEM = `You are Deckmind, the in-app AI builder for a live 3-player bluffing card game app.

WHAT THE APP IS
- Liar's Deck: a moderator deals one secret card each (32-card deck: 7 8 9 10 J Q K A in hearts/diamonds/clubs/spades) to two rival players.
- Rivals take turns asking each other questions in a realtime group chat and may lie at most 3 times. Features used once each: Loan (ask the moderator if the last answer was a lie), Repeat (re-ask), Stop (accuse the rival of exceeding 3 lies).
- Moderator console: deal cards privately, whisper to one player or speak publicly, award points and lies, pass the turn. First to 3 points wins.
- Chat supports text, voice notes (waveform player with 1x/1.5x/2x), meme sounds and live voice calls.
- Routes: "/" lobby, "/auth" sign in, "/room/$code" the game room, "/studio" you, "/x/$slug" AI-built pages.

WHAT YOU CAN ACTUALLY DO (use your tools, never claim a change you did not make)
1. update_app_config — rename the app, change its tagline and accent colour, and set arbitrary settings keys. This changes the live app immediately, everywhere.
2. upsert_extension — create or rewrite a real page in the app at /x/<slug> out of blocks. This is how you grow the app: rules pages, strategy guides, leaderboards, meme boards, tournament formats, house rules, onboarding, changelogs, mini-tools.
3. delete_extension — remove a page.
4. save_code_draft — when the user asks for real source code (a React component, a server function, SQL, a hook), write production-quality code for THIS stack and save it as a draft with the exact file path it belongs at, plus a note on where to import it. The user can copy it or hand it to their Lovable editor to apply.
5. get_app_state — read the current config, pages and drafts before changing things.

STACK FACTS for any code you write: TanStack Start v1 + React 19, TypeScript, Tailwind v4 with semantic tokens only (never text-white/bg-black/hex classes), shadcn ui in @/components/ui, routes are files in src/routes, server logic uses createServerFn from @tanstack/react-start, backend is Lovable Cloud (Supabase) via "@/integrations/supabase/client", game helpers in @/lib/game, sounds in @/lib/sounds.

HOW TO WORK
- Be autonomous. Given a vague prompt, decide the details yourself and ship something complete and opinionated rather than asking questions. Only ask when the request is truly ambiguous about intent.
- Prefer doing multiple tool calls in one turn (e.g. config + two pages) to fully satisfy a request.
- Keep the vibe of the game: bright, playful, a bit cheeky, bluffing-themed.
- Finish with a short summary of exactly what changed and links like /x/<slug>.

${BLOCK_DOCS}
Blocks are passed as a JSON string in "blocks_json". Slugs are lowercase kebab-case.`;

type StudioTables = "app_config" | "extensions" | "code_drafts" | "studio_runs";

/** All writes run as the signed-in player through the Data API, so RLS still applies. */
function makeRest(token: string) {
  return async function rest(
    path: string,
    init: RequestInit & { table: StudioTables },
  ): Promise<unknown> {
    const url = `${process.env["SUPABASE_URL"]}/rest/v1/${init.table}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        apikey: process.env["SUPABASE_PUBLISHABLE_KEY"]!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Backend error ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

function makeTools(token: string) {
  const rest = makeRest(token);
  return {
  get_app_state: tool({
    description: "Read the app's current name/tagline/accent, its AI-built pages and saved code drafts.",
    inputSchema: z.object({}),
    execute: async () => {
      const [config, extensions, drafts] = await Promise.all([
        rest("?id=eq.default&select=*", { table: "app_config", method: "GET" }),
        rest("?select=slug,title,description,published,updated_at&order=updated_at.desc", {
          table: "extensions",
          method: "GET",
        }),
        rest("?select=title,file_path,created_at&order=created_at.desc&limit=20", {
          table: "code_drafts",
          method: "GET",
        }),
      ]);
      return { config, extensions, drafts };
    },
  }),
  update_app_config: tool({
    description: "Change the live app name, tagline, accent colour (hex) and/or free-form settings.",
    inputSchema: z.object({
      name: z.string().nullable(),
      tagline: z.string().nullable(),
      accent: z.string().nullable(),
      settings_json: z.string().nullable(),
    }),
    execute: async (input) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name) patch["name"] = input.name.slice(0, 60);
      if (input.tagline) patch["tagline"] = input.tagline.slice(0, 200);
      if (input.accent) patch["accent"] = input.accent.trim();
      if (input.settings_json) {
        try {
          patch["settings"] = JSON.parse(input.settings_json);
        } catch {
          return { ok: false, error: "settings_json was not valid JSON" };
        }
      }
      await rest("?id=eq.default", {
        table: "app_config",
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return { ok: true, applied: patch };
    },
  }),
  upsert_extension: tool({
    description:
      "Create or replace a real page in the app, live at /x/<slug>, built from blocks. Use this to add features and content to the app.",
    inputSchema: z.object({
      slug: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      icon: z.string().nullable(),
      blocks_json: z.string(),
      published: z.boolean().nullable(),
    }),
    execute: async (input) => {
      let blocks: unknown;
      try {
        blocks = JSON.parse(input.blocks_json);
      } catch {
        return { ok: false, error: "blocks_json was not valid JSON" };
      }
      if (!Array.isArray(blocks)) return { ok: false, error: "blocks_json must be a JSON array" };
      const slug = input.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await rest("?on_conflict=slug", {
        table: "extensions",
        method: "POST",
        body: JSON.stringify({
          slug,
          title: input.title,
          description: input.description,
          icon: input.icon,
          blocks,
          published: input.published ?? true,
          updated_at: new Date().toISOString(),
        }),
      });
      return { ok: true, slug, url: `/x/${slug}`, block_count: blocks.length };
    },
  }),
  delete_extension: tool({
    description: "Delete an AI-built page by slug.",
    inputSchema: z.object({ slug: z.string() }),
    execute: async (input) => {
      await rest(`?slug=eq.${encodeURIComponent(input.slug)}`, {
        table: "extensions",
        method: "DELETE",
      });
      return { ok: true, slug: input.slug };
    },
  }),
  save_code_draft: tool({
    description:
      "Save real source code for this project (component, route, hook, server function, SQL) with the exact file path it belongs at and import instructions.",
    inputSchema: z.object({
      title: z.string(),
      file_path: z.string(),
      language: z.string().nullable(),
      code: z.string(),
      note: z.string().nullable(),
    }),
    execute: async (input) => {
      await rest("", {
        table: "code_drafts",
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          file_path: input.file_path,
          language: input.language ?? "tsx",
          code: input.code,
          note: input.note,
        }),
      });
      return { ok: true, file_path: input.file_path, lines: input.code.split("\n").length };
    },
  }),
  } as const;
}

export const Route = createFileRoute("/api/studio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI is not configured." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        // Only signed-in players may drive the builder.
        const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const userRes = await fetch(`${process.env["SUPABASE_URL"]}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          },
        });
        if (!userRes.ok) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { messages: UIMessage[] };

        try {
          const result = streamText({
            model: createStudioModel(apiKey),
            system: SYSTEM,
            messages: await convertToModelMessages(body.messages),
            tools: makeTools(token),
            stopWhen: stepCountIs(50),
            providerOptions: {
              openai: {
                forceReasoning: true,
                reasoningEffort: "medium",
                reasoningSummary: "auto",
                store: false,
                include: ["reasoning.encrypted_content"],
              },
            },
            abortSignal: request.signal,
          });
          return result.toUIMessageStreamResponse({ sendReasoning: true });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
          const message = error instanceof Error ? error.message : "AI request failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
