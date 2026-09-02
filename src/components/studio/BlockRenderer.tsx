import { Link } from "@tanstack/react-router";
import { Volume2 } from "lucide-react";

import type { Block } from "@/lib/blocks";
import { playMeme } from "@/lib/sounds";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  info: "border-primary/40 bg-primary/10 text-foreground",
  warn: "border-accent/50 bg-accent/15 text-foreground",
  win: "border-emerald-500/40 bg-emerald-500/10 text-foreground",
  lose: "border-destructive/40 bg-destructive/10 text-foreground",
};

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const level = block.level ?? 2;
      const cls =
        level === 1
          ? "text-3xl font-bold tracking-tight"
          : level === 2
            ? "text-xl font-semibold"
            : "text-base font-semibold uppercase tracking-wide text-muted-foreground";
      return <p className={cn("font-display text-foreground", cls)}>{block.text}</p>;
    }
    case "text":
      return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={cn(
            "space-y-2 pl-5 text-sm text-muted-foreground",
            block.ordered ? "list-decimal" : "list-disc",
          )}
        >
          {(block.items ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      );
    }
    case "cards":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {(block.items ?? []).map((item, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="flex items-center gap-2 font-semibold text-card-foreground">
                {item.emoji ? <span aria-hidden>{item.emoji}</span> : null}
                {item.title}
              </p>
              {item.body ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              ) : null}
            </div>
          ))}
        </div>
      );
    case "stats":
      return (
        <div className="flex flex-wrap gap-3">
          {(block.items ?? []).map((item, i) => (
            <div
              key={i}
              className="min-w-24 flex-1 rounded-xl border border-border bg-muted/40 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-display text-2xl font-bold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      );
    case "callout":
      return (
        <div className={cn("rounded-2xl border p-4 text-sm", toneClass[block.tone ?? "info"])}>
          {block.text}
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary/60 pl-4 text-sm italic text-foreground">
          "{block.text}"
          {block.author ? (
            <footer className="mt-1 text-xs not-italic text-muted-foreground">
              — {block.author}
            </footer>
          ) : null}
        </blockquote>
      );
    case "sound":
      return (
        <button
          type="button"
          onClick={() => playMeme(block.sound)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          <Volume2 className="size-4" />
          {block.label ?? block.sound}
        </button>
      );
    case "link":
      return (
        <Link
          to={block.to}
          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          {block.label}
        </Link>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-2xl border border-border bg-muted/50 p-4 text-xs text-foreground">
          <code>{block.code}</code>
        </pre>
      );
    case "divider":
      return <hr className="border-border" />;
    default:
      return null;
  }
}
