/** Block schema for AI-built pages ("extensions"). Rendered live by BlockRenderer. */

export type Block =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "text"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "cards"; items: { title: string; body?: string; emoji?: string }[] }
  | { type: "stats"; items: { label: string; value: string }[] }
  | { type: "callout"; text: string; tone?: "info" | "warn" | "win" | "lose" }
  | { type: "quote"; text: string; author?: string }
  | { type: "sound"; sound: string; label?: string }
  | { type: "link"; label: string; to: string }
  | { type: "code"; code: string; language?: string }
  | { type: "divider" };

export type Extension = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
  blocks: Block[];
  published: boolean;
  updated_at: string;
};

export type AppConfig = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  settings: Record<string, unknown>;
};

export const BLOCK_DOCS = `Block types (JSON array):
{"type":"heading","text":string,"level":1|2|3}
{"type":"text","text":string}
{"type":"list","items":string[],"ordered":boolean}
{"type":"cards","items":[{"title":string,"body":string,"emoji":string}]}
{"type":"stats","items":[{"label":string,"value":string}]}
{"type":"callout","text":string,"tone":"info"|"warn"|"win"|"lose"}
{"type":"quote","text":string,"author":string}
{"type":"sound","sound":"vine_boom"|"fahh"|"bruh"|"airhorn"|"sad_trombone"|"fart"|"sheeesh"|"crickets"|"suspense"|"win","label":string}
{"type":"link","label":string,"to":"/" | "/studio" | "/x/<slug>"}
{"type":"code","code":string,"language":string}
{"type":"divider"}`;

export function parseBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (b): b is Block => !!b && typeof b === "object" && typeof (b as Block).type === "string",
  );
}
