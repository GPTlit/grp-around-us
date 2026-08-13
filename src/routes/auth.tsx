import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, Phone, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Liar's Deck multiplayer card bluffing game" },
      {
        name: "description",
        content:
          "Create your Liar's Deck player account with a phone number and password, pick a username, and jump into a 3-player bluffing room.",
      },
      { property: "og:title", content: "Sign in — Liar's Deck" },
      {
        property: "og:description",
        content: "Register with your number, pick a username and join a Liar's Deck room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 6) return setError("Enter a valid phone number.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      if (mode === "up") {
        const name = username.trim();
        if (name.length < 3) throw new Error("Pick a username with at least 3 characters.");
        const { data, error: err } = await supabase.auth.signUp({
          email: phoneToEmail(digits),
          password,
          options: { data: { username: name, phone: digits } },
        });
        if (err) throw err;
        const uid = data.user?.id;
        if (uid) {
          const { error: pErr } = await supabase
            .from("profiles")
            .insert({ id: uid, username: name, phone: digits });
          if (pErr && !pErr.message.includes("duplicate")) throw pErr;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: phoneToEmail(digits),
          password,
        });
        if (err) throw err;
      }
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-32 -left-24 size-80 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 size-72 rounded-full bg-accent/25 blur-3xl" />

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <Link to="/" className="font-display text-lg font-bold">
          Liar&apos;s Deck <span className="text-accent">♠️</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="relative mx-auto w-full max-w-md flex-1 px-4 pb-12">
        <div className="card-surface rounded-3xl p-6">
          <h1 className="font-display text-2xl font-bold">
            {mode === "up" ? "Create your player" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "up"
              ? "Register with your number, choose a username, then join a room."
              : "Sign in with the number and password you registered."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["up", "in"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === m ? "bg-surface shadow-soft" : "text-muted-foreground"
                }`}
              >
                {m === "up" ? "Register" : "Sign in"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <Field icon={<Phone className="size-4" />} label="Phone number">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="e.g. 22334455"
                className="w-full bg-transparent text-sm outline-none"
              />
            </Field>
            {mode === "up" && (
              <Field icon={<User className="size-4" />} label="Username">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="how the table sees you"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </Field>
            )}
            <Field icon={<Lock className="size-4" />} label="Password">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="min. 6 characters"
                className="w-full bg-transparent text-sm outline-none"
              />
            </Field>

            {error && (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-bold text-primary-foreground shadow-lift disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "up" ? "Deal me in" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block rounded-2xl border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
