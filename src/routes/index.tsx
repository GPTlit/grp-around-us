import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, LogOut, Plus, Users, Spade, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MAX_LIES, TARGET_SCORE } from "@/lib/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liar's Deck — 3-Player Bluffing Card Game with Voice Chat" },
      {
        name: "description",
        content:
          "Liar's Deck is a live 3-player bluffing game: a moderator deals secret cards from 32, two rivals question each other, lie up to 3 times, and use Loan, Repeat and Stop.",
      },
      { property: "og:title", content: "Liar's Deck — 3-Player Bluffing Card Game" },
      {
        property: "og:description",
        content:
          "Deal secret cards, bluff, send voice notes and meme sounds. First to 3 points wins the table.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Lobby,
});

const randomCode = () =>
  Array.from({ length: 5 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join(
    "",
  );

function Lobby() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!session) return;
    setBusy("create");
    setError(null);
    const newCode = randomCode();
    const { error: err } = await supabase
      .from("rooms")
      .insert({ code: newCode, moderator_id: session.user.id });
    setBusy(null);
    if (err) return setError(err.message);
    void navigate({ to: "/room/$code", params: { code: newCode } });
  }

  async function joinRoom() {
    if (!session) return;
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setError("Enter the room code your moderator shared.");
    setBusy("join");
    setError(null);
    const { data, error: err } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", c)
      .maybeSingle();
    if (err || !data) {
      setBusy(null);
      return setError("No room with that code.");
    }
    const uid = session.user.id;
    const taken = [data.moderator_id, data.player1_id, data.player2_id];
    if (!taken.includes(uid)) {
      const slot = !data.player1_id ? "player1_id" : !data.player2_id ? "player2_id" : null;
      if (!slot) {
        setBusy(null);
        return setError("That room already has 3 players.");
      }
      const { error: uErr } = await supabase
        .from("rooms")
        .update(slot === "player1_id" ? { player1_id: uid } : { player2_id: uid })
        .eq("id", data.id);
      if (uErr) {
        setBusy(null);
        return setError(uErr.message);
      }
    }
    setBusy(null);
    void navigate({ to: "/room/$code", params: { code: c } });
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-28 -right-24 size-80 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 size-80 rounded-full bg-primary/25 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <div>
          <h1 className="font-display text-xl font-bold">
            {config.name} <span className="text-accent">♠️</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {config.tagline || `3 players · 32 cards · ${MAX_LIES} lies · first to ${TARGET_SCORE}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session && (
            <button
              onClick={() => void supabase.auth.signOut()}
              className="rounded-xl bg-secondary p-2 text-secondary-foreground"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-md flex-1 px-4 pb-14">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !session ? (
          <div className="card-surface rounded-3xl p-6">
            <Spade className="size-8 text-accent" />
            <h2 className="mt-3 font-display text-2xl font-bold">Bluff your way to 3 points</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The moderator holds all 32 cards and hands each rival a secret one. Ask, lie, call the
              bluff — with voice notes, live calls and meme sounds in the room.
            </p>
            <Link
              to="/auth"
              className="mt-5 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-bold text-primary-foreground shadow-lift"
            >
              Register with your number
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="card-surface rounded-3xl p-5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Signed in as
              </p>
              <p className="font-display text-xl font-bold">{profile?.username ?? "…"}</p>
            </div>

            <button
              onClick={createRoom}
              disabled={busy !== null}
              className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-accent px-5 py-4 text-left text-primary-foreground shadow-lift disabled:opacity-60"
            >
              {busy === "create" ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Plus className="size-5" />
              )}
              <span>
                <span className="block text-sm font-bold">Open a room as moderator</span>
                <span className="block text-xs opacity-80">
                  You deal the cards, keep score and judge the lies
                </span>
              </span>
            </button>

            <div className="card-surface rounded-3xl p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-accent" /> Join a room
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ROOM CODE"
                  maxLength={6}
                  className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 font-display text-lg tracking-[0.2em] outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={joinRoom}
                  disabled={busy !== null}
                  className="rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {busy === "join" ? <Loader2 className="size-4 animate-spin" /> : "Enter"}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <Link
              to="/studio"
              className="card-surface flex items-center gap-3 rounded-3xl p-5 transition hover:bg-accent/10"
            >
              <Sparkles className="size-5 text-accent" />
              <span>
                <span className="block text-sm font-bold text-foreground">AI Studio</span>
                <span className="block text-xs text-muted-foreground">
                  Prompt the in-app builder to rename the app, restyle it or ship new pages
                </span>
              </span>
            </Link>

            <div className="card-surface rounded-3xl p-5 text-sm text-muted-foreground">
              <h3 className="text-sm font-semibold text-foreground">House rules</h3>
              <ul className="mt-2 space-y-1.5">
                <li>• Moderator deals one secret card to each rival from the 32-card deck.</li>
                <li>• Rivals take turns asking anything — answers can be truth, bluff or lie.</li>
                <li>• 🪙 Loan: the moderator tells you privately if that answer was a lie.</li>
                <li>• 🔁 Repeat: force the same question again.</li>
                <li>• 🛑 Stop: call {MAX_LIES} lies. Right = point, wrong = your Stop is gone.</li>
                <li>• Lie a 4th time and the moderator ends the round against you.</li>
                <li>• First to {TARGET_SCORE} points takes the match.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
