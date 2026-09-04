import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowUp,
  Code2,
  Copy,
  Download,
  Loader2,
  Lock,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuth } from "@/hooks/useAuth";
import { isAdminEmail } from "@/lib/admin";


export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "AI Studio — Grow Liar's Deck From Inside the App" },
      {
        name: "description",
        content:
          "Prompt the in-app AI builder to rename the app, change its accent, ship new pages at /x/<slug> and write real project code — live, with no redeploy.",
      },
      { property: "og:title", content: "AI Studio — Build Liar's Deck by prompt" },
      {
        property: "og:description",
        content:
          "An autonomous in-app builder that edits the live app config, creates new pages and writes production code drafts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

const IDEAS = [
  "Rename the app to something cheekier and pick a matching accent colour",
  "Build a strategy guide page for bluffing without burning your 3 lies",
  "Make a house-rules page for a 5-point tournament with tie-breakers",
  "Create a meme soundboard page that explains when to use each sound",
  "Write me a React component that shows a player's lie streak, and save the code",
];

type ExtRow = { slug: string; title: string; icon: string | null; updated_at: string };
type DraftRow = {
  id: string;
  title: string;
  file_path: string;
  language: string;
  code: string;
  note: string | null;
};

function Studio() {
  const { session, loading } = useAuth();
  const config = useAppConfig();
  const [input, setInput] = useState("");
  const [tab, setTab] = useState<"pages" | "code">("pages");
  const [pages, setPages] = useState<ExtRow[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const token = session?.access_token;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportSite() {
    if (!token || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "site-netlify.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }


  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/studio",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),
    [token],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const refresh = () => {
    void supabase
      .from("extensions")
      .select("slug,title,icon,updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPages((data as ExtRow[] | null) ?? []));
    void supabase
      .from("code_drafts")
      .select("id,title,file_path,language,code,note")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setDrafts((data as DraftRow[] | null) ?? []));
  };

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  useEffect(() => {
    if (status === "ready") refresh();
  }, [status]);

  useEffect(() => {
    if (!busy) taRef.current?.focus();
  }, [busy, session]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void sendMessage({ text });
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </main>
    );
  }

  if (!session || !isAdminEmail(session.user.email)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="card-surface w-full max-w-sm rounded-3xl p-6 text-center">
          <Lock className="mx-auto size-7 text-accent" />
          <h1 className="mt-3 font-display text-xl font-bold">Admin panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {session
              ? "This account can’t open the admin panel."
              : "Sign in with the owner account to open the admin panel."}
          </p>
          <Link
            to={session ? "/" : "/auth"}
            className="mt-5 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            {session ? "Back to lobby" : "Sign in"}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute -top-28 -left-20 size-80 rounded-full bg-primary/20 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
        >
          <ArrowLeft className="size-4" /> Lobby
        </Link>
        <div className="min-w-0 text-center">
          <p className="font-display text-base font-bold">Admin panel ✨</p>
          <p className="truncate text-[11px] text-muted-foreground">
            editing “{config.name}” live
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="relative mx-auto w-full max-w-2xl px-4">
        <div className="card-surface flex flex-wrap items-center gap-3 rounded-3xl p-4">
          <Download className="size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Netlify-ready copy</p>
            <p className="text-xs text-muted-foreground">
              Downloads a zip of the current app (name, style, every AI page and saved code). Unzip
              it and drag the folder onto netlify.com/drop — it hosts instantly, no setup.
            </p>
            {exportError && <p className="mt-1 text-xs text-destructive">{exportError}</p>}
          </div>
          <button
            onClick={exportSite}
            disabled={exporting}
            className="rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : "Download zip"}
          </button>
        </div>
      </div>


      <section className="relative mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 pb-40">
        {messages.length === 0 ? (
          <div className="card-surface rounded-3xl p-5">
            <Wand2 className="size-6 text-accent" />
            <h2 className="mt-3 font-display text-2xl font-bold">Tell it what to build</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              It can rename the app, change the accent colour, ship whole new pages at{" "}
              <span className="font-mono">/x/…</span> and write real project code — on its own, from
              one prompt.
            </p>
            <div className="mt-4 space-y-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setInput(idea)}
                  className="w-full rounded-2xl border border-border bg-muted/40 px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> building…
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message}
          </p>
        )}

        <div className="card-surface rounded-3xl p-4">
          <div className="flex gap-2">
            {(["pages", "code"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {t === "pages" ? `AI pages (${pages.length})` : `Code drafts (${drafts.length})`}
              </button>
            ))}
          </div>

          {tab === "pages" ? (
            <div className="mt-3 space-y-2">
              {pages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No AI pages yet.</p>
              ) : (
                pages.map((p) => (
                  <Link
                    key={p.slug}
                    to="/x/$slug"
                    params={{ slug: p.slug }}
                    className="flex items-center justify-between rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm transition hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate font-semibold">
                      {p.icon ? <span className="mr-1.5">{p.icon}</span> : null}
                      {p.title}
                    </span>
                    <span className="ml-2 shrink-0 font-mono text-[11px] opacity-70">
                      /x/{p.slug}
                    </span>
                  </Link>
                ))
              )}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No code drafts yet.</p>
              ) : (
                drafts.map((d) => <DraftCard key={d.id} draft={d} />)
              )}
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 border-t border-border bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-end gap-2 rounded-3xl border border-input bg-card p-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Ask the builder to add anything to the app…"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <button
              onClick={submit}
              disabled={busy || !input.trim()}
              aria-label="Send prompt"
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const mine = message.role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[92%] rounded-3xl px-4 py-3 text-sm ${
          mine
            ? "bg-primary text-primary-foreground"
            : "card-surface text-card-foreground"
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return mine ? (
              <p key={i} className="whitespace-pre-wrap">
                {part.text}
              </p>
            ) : (
              <div
                key={i}
                className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_code]:font-mono"
              >
                <ReactMarkdown>{part.text}</ReactMarkdown>
              </div>
            );
          }
          if (part.type === "reasoning" && part.text) {
            return (
              <p key={i} className="mb-2 border-l-2 border-border pl-2 text-xs italic opacity-70">
                {part.text}
              </p>
            );
          }
          if (part.type.startsWith("tool-")) {
            const label = part.type.replace("tool-", "").replace(/_/g, " ");
            const state = (part as { state?: string }).state;
            return (
              <p
                key={i}
                className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold"
              >
                {state === "output-available" ? (
                  <Sparkles className="size-3.5" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {label}
              </p>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function DraftCard({ draft }: { draft: DraftRow }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <Code2 className="size-4 text-accent" /> {draft.title}
          </p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{draft.file_path}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => {
              void navigator.clipboard.writeText(draft.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Copy code"
            className="grid size-8 place-items-center rounded-xl bg-secondary text-secondary-foreground"
          >
            {copied ? <Send className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-xl bg-secondary px-2 text-xs font-bold text-secondary-foreground"
          >
            {open ? "Hide" : "View"}
          </button>
        </div>
      </div>
      {draft.note ? <p className="mt-2 text-xs text-muted-foreground">{draft.note}</p> : null}
      {open ? (
        <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-border bg-background p-3 text-[11px] leading-relaxed">
          <code>{draft.code}</code>
        </pre>
      ) : null}
    </div>
  );
}
