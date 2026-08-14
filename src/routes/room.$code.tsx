import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  Mic,
  Send,
  Square,
  Phone,
  PhoneOff,
  Search,
  Smile,
  Coins,
  Repeat,
  Hand,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoom } from "@/hooks/useRoom";
import { MEMES, memeById, playMeme, unlockAudio } from "@/lib/sounds";
import {
  DECK,
  MAX_LIES,
  RANKS,
  SUITS,
  TARGET_SCORE,
  cardLabel,
  seatOf,
  suitOf,
  type Card,
  type ChatMessage,
  type Rank,
  type Room,
  type SuitId,
} from "@/lib/game";
import { CardFace } from "@/components/game/CardFace";

export const Route = createFileRoute("/room/$code")({
  head: () => ({
    meta: [
      { title: "Room — Liar's Deck live bluffing table" },
      {
        name: "description",
        content:
          "Your live Liar's Deck room: secret cards, private moderator whispers, voice notes, voice calls, meme sounds and the Loan, Repeat and Stop calls.",
      },
      { property: "og:title", content: "Liar's Deck room" },
      {
        property: "og:description",
        content: "Join the table: secret cards, bluffs, voice notes and meme sounds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id;
  const { room, messages, people, error, loading, send, patchRoom } = useRoom(code, userId);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!session) {
    return (
      <Empty text="Sign in to enter this room." action={{ to: "/auth", label: "Sign in" }} />
    );
  }
  if (error || !room) return <Empty text={error ?? "Room not found."} />;

  const seat = seatOf(room, userId);
  if (seat === "spectator") {
    return <Empty text="This table is full — three seats only." />;
  }

  const isMod = seat === "moderator";
  const meIndex = seat === "player1" ? 1 : seat === "player2" ? 2 : 0;
  const p1 = room.player1_id ? (people[room.player1_id] ?? "Player 1") : "Waiting…";
  const p2 = room.player2_id ? (people[room.player2_id] ?? "Player 2") : "Waiting…";
  const matchOver = room.score1 >= TARGET_SCORE || room.score2 >= TARGET_SCORE;

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-md px-4 pt-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3.5" /> Lobby
          </Link>
          <p className="font-display text-sm font-bold tracking-[0.2em]">{room.code}</p>
          <CallButton roomId={room.id} userId={session.user.id} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <ScoreCard
            name={p1}
            score={room.score1}
            lies={room.lies1}
            showLies={isMod || meIndex === 1}
            tone="blue"
            active={room.turn === 1}
          />
          <ScoreCard
            name={p2}
            score={room.score2}
            lies={room.lies2}
            showLies={isMod || meIndex === 2}
            tone="red"
            active={room.turn === 2}
          />
        </div>

        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {matchOver
            ? `🏆 ${room.score1 > room.score2 ? p1 : p2} wins the match!`
            : `Round ${room.round} · ${room.turn === 1 ? p1 : p2}'s turn · moderator ${people[room.moderator_id] ?? ""}`}
        </p>
      </header>

      <div ref={feedRef} className="mx-auto w-full max-w-md flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            {isMod
              ? "Deal a card to each rival, then pick who starts."
              : "Waiting for the moderator to deal your secret card…"}
          </p>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.id}
            m={m}
            mine={m.sender_id === userId}
            people={people}
            isModSender={m.sender_id === room.moderator_id}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-4">
        {isMod ? (
          <ModeratorConsole room={room} people={people} send={send} patchRoom={patchRoom} />
        ) : (
          <PlayerComposer room={room} meIndex={meIndex} send={send} />
        )}
      </div>
    </main>
  );
}

/* ---------- shared bits ---------- */

function Empty({ text, action }: { text: string; action?: { to: string; label: string } }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        to={action ? "/auth" : "/"}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {action?.label ?? "Back to lobby"}
      </Link>
    </main>
  );
}

function ScoreCard({
  name,
  score,
  lies,
  showLies,
  tone,
  active,
}: {
  name: string;
  score: number;
  lies: number;
  showLies: boolean;
  tone: "blue" | "red";
  active: boolean;
}) {
  return (
    <div
      className={`card-surface rounded-2xl px-3 py-2 ${
        active ? "ring-2 ring-accent" : ""
      } ${tone === "blue" ? "bg-primary/10" : "bg-destructive/10"}`}
    >
      <p className="truncate text-[11px] font-semibold text-muted-foreground">{name}</p>
      <div className="flex items-end justify-between">
        <p className={`font-display text-2xl font-bold ${tone === "blue" ? "text-primary" : "text-destructive"}`}>
          {score}
        </p>
        {showLies ? (
          <p className={`text-[11px] ${lies > MAX_LIES ? "text-destructive" : "text-muted-foreground"}`}>
            lies {lies}/{MAX_LIES}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60">lies hidden</p>
        )}
      </div>
    </div>
  );
}


function Bubble({
  m,
  mine,
  people,
  isModSender,
}: {
  m: ChatMessage;
  mine: boolean;
  people: Record<string, string>;
  isModSender: boolean;
}) {
  const author = people[m.sender_id] ?? "Player";
  const meme = m.kind === "meme" ? memeById(m.body ?? "") : null;

  useEffect(() => {
    if (m.kind === "meme" && m.body) playMeme(m.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id]);

  if (m.kind === "system") {
    return (
      <p className="mx-auto max-w-[92%] rounded-xl bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
        {m.body}
      </p>
    );
  }

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="px-2 pb-1 text-[11px] text-muted-foreground">
        {author}
        {m.recipient_id && " · private"}
      </span>
      <div
        className={`max-w-[85%] px-4 py-2.5 text-sm ${
          mine
            ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
            : isModSender
              ? "rounded-2xl rounded-bl-md bg-accent/20 text-foreground"
              : "rounded-2xl rounded-bl-md bg-bubble-mod text-bubble-mod-foreground"
        } ${m.recipient_id ? "ring-1 ring-accent" : ""}`}
      >
        {m.kind === "card" && m.card_rank ? (
          <div className="flex items-center gap-3">
            <CardFace card={{ rank: m.card_rank as Rank, suit: m.card_suit as SuitId }} size="sm" />
            <span className="text-xs">your secret card</span>
          </div>
        ) : m.kind === "voice" && m.audio_url ? (
          <VoicePlayer path={m.audio_url} />
        ) : meme ? (
          <button onClick={() => playMeme(meme.id)} className="flex items-center gap-2 text-sm">
            <span className="text-lg">{meme.emoji}</span> {meme.label}
          </button>
        ) : m.kind === "guess" && m.card_rank ? (
          <span>
            🔍 guesses <b>{m.card_rank}{suitOf(m.card_suit ?? "hearts").symbol}</b>
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{m.body}</span>
        )}
      </div>
    </div>
  );
}

function VoicePlayer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage
      .from("voice-notes")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive && data) setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <span className="text-xs opacity-70">loading voice note…</span>;
  return <audio controls src={url} className="h-9 w-52" />;
}

/* ---------- player side ---------- */

type Send = ReturnType<typeof useRoom>["send"];

function PlayerComposer({
  room,
  meIndex,
  send,
}: {
  room: Room;
  meIndex: number;
  send: Send;
}) {
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState<"none" | "memes" | "guess">("none");
  const [guess, setGuess] = useState<{ rank: Rank; suit: SuitId }>({ rank: "7", suit: "hearts" });
  const [used, setUsed] = useState<{ round: number; keys: string[] }>({ round: room.round, keys: [] });

  const usedKeys = used.round === room.round ? used.keys : [];
  const markUsed = (k: string) =>
    setUsed({ round: room.round, keys: [...usedKeys, k] });

  const feature = (key: "loan" | "repeat" | "stop", label: string) => {
    if (usedKeys.includes(key)) return;
    markUsed(key);
    playMeme(key === "stop" ? "airhorn" : "suspense");
    void send({ kind: "action", body: label });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Feature
          icon={<Coins className="size-4" />}
          label="Loan"
          hint="was that a lie?"
          used={usedKeys.includes("loan")}
          onClick={() => feature("loan", "🪙 Loan — moderator, was that answer a lie?")}
        />
        <Feature
          icon={<Repeat className="size-4" />}
          label="Repeat"
          hint="ask again"
          used={usedKeys.includes("repeat")}
          onClick={() => feature("repeat", "🔁 Repeat — answer my last question again.")}
        />
        <Feature
          icon={<Hand className="size-4 rotate-90" />}
          label="Stop"
          hint={`${MAX_LIES} lies!`}
          used={usedKeys.includes("stop")}
          onClick={() => feature("stop", `🛑 Stop — you have lied ${MAX_LIES} times!`)}
        />
      </div>

      {tray === "memes" && (
        <div className="card-surface grid grid-cols-5 gap-1.5 rounded-2xl p-2">
          {MEMES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                unlockAudio();
                playMeme(m.id);
                void send({ kind: "meme", body: m.id });
              }}
              className="flex flex-col items-center rounded-xl bg-secondary py-2 text-[10px] text-secondary-foreground active:scale-95"
            >
              <span className="text-lg">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {tray === "guess" ? (
        <div className="card-surface rounded-3xl p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Name your rival&apos;s card
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {RANKS.map((r) => (
              <button
                key={r}
                onClick={() => setGuess((g) => ({ ...g, rank: r }))}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${
                  guess.rank === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {SUITS.map((s) => (
              <button
                key={s.id}
                onClick={() => setGuess((g) => ({ ...g, suit: s.id }))}
                className={`h-10 flex-1 rounded-lg text-lg ${
                  guess.suit === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {s.symbol}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTray("none")}
              className="flex-1 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground"
            >
              Back
            </button>
            <button
              onClick={() => {
                playMeme("suspense");
                void send({ kind: "guess", card_rank: guess.rank, card_suit: guess.suit });
                setTray("none");
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent px-3 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Lock it in
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5">
            <button
              onClick={() => setTray(tray === "memes" ? "none" : "memes")}
              className="h-11 rounded-2xl bg-secondary px-3 text-secondary-foreground"
              aria-label="Meme sounds"
            >
              <Smile className="size-4" />
            </button>
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) {
                    void send({ kind: "text", body: draft.trim() });
                    setDraft("");
                  }
                }
              }}
              placeholder={
                room.turn === meIndex ? "your turn — ask or answer…" : "type a message…"
              }
              className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <Recorder roomId={room.id} send={send} />
            <button
              onClick={() => {
                if (!draft.trim()) return;
                void send({ kind: "text", body: draft.trim() });
                setDraft("");
              }}
              className="h-11 rounded-2xl bg-primary px-4 text-primary-foreground"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </div>
          <button
            onClick={() => setTray("guess")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold"
          >
            <Search className="size-4" /> Name the card
          </button>
        </>
      )}
    </div>
  );
}

function Feature({
  icon,
  label,
  hint,
  used,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  used: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={used}
      className="card-surface flex flex-col items-start gap-0.5 rounded-2xl px-3 py-2 text-left transition-transform active:scale-95 disabled:opacity-40"
    >
      <span className="text-accent">{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[10px] text-muted-foreground">{used ? "used" : hint}</span>
    </button>
  );
}

function Recorder({ roomId, send }: { roomId: string; send: Send }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [busy, setBusy] = useState(false);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const path = `${roomId}/${crypto.randomUUID()}.webm`;
        const { error } = await supabase.storage.from("voice-notes").upload(path, blob, {
          contentType: "audio/webm",
        });
        if (!error) await send({ kind: "voice", audio_url: path });
        setBusy(false);
      };
      mr.start();
      setRec(mr);
    } catch {
      /* mic denied */
    }
  }

  return (
    <button
      onClick={() => {
        if (rec) {
          rec.stop();
          setRec(null);
        } else void start();
      }}
      className={`h-11 rounded-2xl px-3 ${
        rec ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"
      }`}
      aria-label={rec ? "Stop recording" : "Record voice note"}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : rec ? (
        <Square className="size-4" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}

/* ---------- moderator side ---------- */

function ModeratorConsole({
  room,
  people,
  send,
  patchRoom,
}: {
  room: Room;
  people: Record<string, string>;
  send: Send;
  patchRoom: (patch: Partial<Room>) => void | Promise<void>;
}) {
  const [target, setTarget] = useState<"p1" | "p2" | "both">("p1");
  const [tab, setTab] = useState<"deal" | "score" | "say">("deal");
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<Card | null>(null);

  const p1 = room.player1_id;
  const p2 = room.player2_id;
  const name = (id: string | null) => (id ? (people[id] ?? "player") : "empty seat");

  const targets = useMemo(
    () => (target === "p1" ? [p1] : target === "p2" ? [p2] : [p1, p2]).filter(Boolean) as string[],
    [target, p1, p2],
  );

  const sendCard = async () => {
    if (!picked || targets.length === 0) return;
    for (const t of targets) {
      await send({ kind: "card", recipient_id: t, card_rank: picked.rank, card_suit: picked.suit });
    }
    setPicked(null);
  };

  const say = async () => {
    const body = draft.trim();
    if (!body) return;
    if (target === "both") await send({ kind: "text", body });
    else for (const t of targets) await send({ kind: "text", body, recipient_id: t });
    setDraft("");
  };

  const addLie = async (which: 1 | 2) => {
    const next = (which === 1 ? room.lies1 : room.lies2) + 1;
    await patchRoom(which === 1 ? { lies1: next } : { lies2: next });
    playMeme(next > MAX_LIES ? "airhorn" : "boom");
    await send({
      kind: "system",
      body:
        next > MAX_LIES
          ? `⚠️ ${name(which === 1 ? p1 : p2)} lied ${next} times — over the limit. Round goes to the rival!`
          : `😈 ${name(which === 1 ? p1 : p2)} lied — ${next}/${MAX_LIES}`,
    });
  };

  const award = async (kind: "p1" | "p2" | "draw") => {
    const s1 = room.score1 + (kind === "p2" ? 0 : 1);
    const s2 = room.score2 + (kind === "p1" ? 0 : 1);
    await patchRoom({
      score1: s1,
      score2: s2,
      lies1: 0,
      lies2: 0,
      round: room.round + 1,
      turn: room.turn === 1 ? 2 : 1,
    });
    playMeme(s1 >= TARGET_SCORE || s2 >= TARGET_SCORE ? "win" : "trombone");
    await send({
      kind: "system",
      body: `🏁 Round ${room.round}: ${kind === "draw" ? "1-1, point each" : `point to ${name(kind === "p1" ? p1 : p2)}`} · score ${s1}-${s2}`,
    });
  };

  return (
    <div className="card-surface rounded-3xl p-3">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        {(["deal", "say", "score"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-2 py-1.5 text-xs font-semibold capitalize ${
              tab === t ? "bg-surface shadow-soft" : "text-muted-foreground"
            }`}
          >
            {t === "deal" ? "Deal cards" : t === "say" ? "Speak" : "Score & lies"}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {(
          [
            ["p1", name(p1)],
            ["p2", name(p2)],
            ["both", "Both"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTarget(k)}
            className={`truncate rounded-xl px-2 py-1.5 text-xs font-semibold ${
              target === k
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "deal" && (
        <>
          <div className="mt-2 grid max-h-44 grid-cols-8 gap-1 overflow-y-auto">
            {DECK.map((c) => {
              const on = picked?.rank === c.rank && picked?.suit === c.suit;
              return (
                <button
                  key={`${c.rank}${c.suit}`}
                  onClick={() => setPicked(c)}
                  className={`rounded-lg py-1 text-[11px] font-semibold ${
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  } ${suitOf(c.suit).red && !on ? "text-destructive" : ""}`}
                >
                  {cardLabel(c)}
                </button>
              );
            })}
          </div>
          <button
            onClick={sendCard}
            disabled={!picked}
            className="mt-2 w-full rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {picked ? `Send ${cardLabel(picked)} privately` : "Pick a card"}
          </button>
        </>
      )}

      {tab === "say" && (
        <div className="mt-2 flex items-end gap-1.5">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              target === "both" ? "message the whole room…" : `whisper to ${name(target === "p1" ? p1 : p2)}…`
            }
            className="max-h-24 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Recorder roomId={room.id} send={send} />
          <button
            onClick={say}
            className="h-11 rounded-2xl bg-primary px-4 text-primary-foreground"
            aria-label="Send"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}

      {tab === "score" && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => void award("p1")}
              className="rounded-xl bg-primary px-2 py-2 text-xs font-bold text-primary-foreground"
            >
              +1 {name(p1)}
            </button>
            <button
              onClick={() => void award("p2")}
              className="rounded-xl bg-destructive px-2 py-2 text-xs font-bold text-destructive-foreground"
            >
              +1 {name(p2)}
            </button>
            <button
              onClick={() => void award("draw")}
              className="rounded-xl bg-secondary px-2 py-2 text-xs font-bold text-secondary-foreground"
            >
              1 - 1
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => void addLie(1)}
              className="rounded-xl border border-border px-2 py-2 text-xs font-semibold"
            >
              😈 lie +1 · {name(p1)}
            </button>
            <button
              onClick={() => void addLie(2)}
              className="rounded-xl border border-border px-2 py-2 text-xs font-semibold"
            >
              😈 lie +1 · {name(p2)}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                void patchRoom({ turn: room.turn === 1 ? 2 : 1 });
                void send({
                  kind: "system",
                  body: `🎙️ ${name(room.turn === 1 ? p2 : p1)} asks next.`,
                });
              }}
              className="rounded-xl bg-secondary px-2 py-2 text-xs font-semibold text-secondary-foreground"
            >
              Pass the turn
            </button>
            <button
              onClick={() =>
                void send({
                  kind: "system",
                  body: "🃏 Cards are revealed — round over, show your hands!",
                })
              }
              className="rounded-xl bg-secondary px-2 py-2 text-xs font-semibold text-secondary-foreground"
            >
              Reveal round
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- voice call ---------- */

function CallButton({ roomId, userId }: { roomId: string; userId: string }) {
  const [inCall, setInCall] = useState(false);
  const [peers, setPeers] = useState(0);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const streamRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const cleanup = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (chanRef.current) void supabase.removeChannel(chanRef.current);
    chanRef.current = null;
    setPeers(0);
    setInCall(false);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const join = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return;
    }
    streamRef.current = stream;
    setInCall(true);
    const channel = supabase.channel(`call-${roomId}`, { config: { presence: { key: userId } } });
    chanRef.current = channel;

    const makePc = (peerId: string) => {
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate)
          void channel.send({
            type: "broadcast",
            event: "ice",
            payload: { from: userId, to: peerId, candidate: e.candidate.toJSON() },
          });
      };
      pc.ontrack = (e) => {
        const audio = new Audio();
        audio.srcObject = e.streams[0]!;
        audio.autoplay = true;
        void audio.play().catch(() => {});
        setPeers(peersRef.current.size);
      };
      peersRef.current.set(peerId, pc);
      return pc;
    };

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = makePc(payload.from);
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void channel.send({
          type: "broadcast",
          event: "answer",
          payload: { from: userId, to: payload.from, sdp: answer },
        });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(payload.sdp);
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        if (pc) await pc.addIceCandidate(payload.candidate).catch(() => {});
      })
      .on("presence", { event: "sync" }, () => {
        const ids = Object.keys(channel.presenceState());
        setPeers(Math.max(0, ids.length - 1));
        ids
          .filter((id) => id !== userId && id < userId && !peersRef.current.has(id))
          .forEach(async (id) => {
            const pc = makePc(id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            void channel.send({
              type: "broadcast",
              event: "offer",
              payload: { from: userId, to: id, sdp: offer },
            });
          });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: Date.now() });
      });
  }, [roomId, userId]);

  // "lift the phone to your ear" — tilting the device upright joins the call
  useEffect(() => {
    if (inCall || typeof window === "undefined") return;
    let raised = 0;
    const onTilt = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0;
      if (beta > 65) {
        raised += 1;
        if (raised > 8) void join();
      } else raised = 0;
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [inCall, join]);

  return (
    <button
      onClick={() => (inCall ? cleanup() : void join())}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
        inCall
          ? "bg-destructive text-destructive-foreground"
          : "bg-success text-success-foreground"
      }`}
    >
      {inCall ? <PhoneOff className="size-3.5" /> : <Phone className="size-3.5" />}
      {inCall ? `Leave · ${peers}` : "Call"}
    </button>
  );
}
