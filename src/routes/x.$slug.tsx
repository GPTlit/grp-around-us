import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { BlockRenderer } from "@/components/studio/BlockRenderer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { parseBlocks, type Extension } from "@/lib/blocks";

export const Route = createFileRoute("/x/$slug")({
  head: ({ params }) => {
    const title = `${params.slug.replace(/-/g, " ")} — Liar's Deck`;
    const description = `An AI-built page inside Liar's Deck, the 3-player bluffing card game: ${params.slug.replace(/-/g, " ")}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ExtensionPage,
});

function ExtensionPage() {
  const { slug } = Route.useParams();
  const [ext, setExt] = useState<Extension | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("extensions")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setExt(
          data
            ? {
                id: data.id,
                slug: data.slug,
                title: data.title,
                description: data.description,
                icon: data.icon,
                blocks: parseBlocks(data.blocks),
                published: data.published,
                updated_at: data.updated_at,
              }
            : null,
        );
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-accent/20 blur-3xl" />
      <header className="relative mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
        >
          <ArrowLeft className="size-4" /> Studio
        </Link>
        <ThemeToggle />
      </header>

      <div className="relative mx-auto w-full max-w-2xl px-4 pb-16">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !ext ? (
          <div className="card-surface rounded-3xl p-6 text-center">
            <Sparkles className="mx-auto size-7 text-accent" />
            <h1 className="mt-3 font-display text-xl font-bold">This page doesn&apos;t exist yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the AI Studio to build <span className="font-mono">/x/{slug}</span> and it will
              appear here instantly.
            </p>
            <Link
              to="/studio"
              className="mt-5 inline-flex rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Open AI Studio
            </Link>
          </div>
        ) : (
          <article className="card-surface rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI-built page
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
              {ext.icon ? <span className="mr-2">{ext.icon}</span> : null}
              {ext.title}
            </h1>
            {ext.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{ext.description}</p>
            ) : null}
            <hr className="my-6 border-border" />
            <BlockRenderer blocks={ext.blocks} />
          </article>
        )}
      </div>
    </main>
  );
}
