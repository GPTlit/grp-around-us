import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, HelpCircle, RotateCcw, Hand, Repeat, Search } from "lucide-react";
import {
  MAX_LIES,
  MAX_QUESTIONS,
  RANKS,
  SUITS,
  cardLabel,
  drawCard,
  suitOf,
  type Card,
  type Message,
  type Rank,
  type SuitId,
} from "@/lib/game";
import { CardFace } from "./CardFace";

type Phase = "setup" | "ask" | "answer" | "over";
type Pending = { kind: "question" | "repeat"; text: string } | null;

const DEFAULT_NAMES = ["Sam", "Alex", "Nour"];

export function GameBoard() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [card, setCard] = useState<Card | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [questionsLeft, setQuestionsLeft] = useState(MAX_QUESTIONS);
  const [lies, setLies] = useState(0);
  const [features, setFeatures] = useState({ loan: false, repeat: false, stop: false });
  const [pending, setPending] = useState<Pending>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [lastWasLie, setLastWasLie] = useState<boolean | null>(null);
  const [turn, setTurn] = useState(0);
  const [draft, setDraft] = useState("");
  const [guessOpen, setGuessOpen] = useState(false);
  const [guess, setGuess] = useState<{ rank: Rank; suit: SuitId }>({
    rank: "7",
    suit: "hearts",
  });
  const [outcome, setOutcome] = useState<{ won: boolean; text: string } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const moderator = names[0]!;
  const askers = [names[1]!, names[2]!];
  const asker = askers[turn]!;

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  const push = (m: Omit<Message, "id">) =>
    setMessages((prev) => [...prev, { ...m, id: ++idRef.current }]);

  function startGame() {
    const drawn = drawCard();
    setCard(drawn);
    setShowCard(false);
    setQuestionsLeft(MAX_QUESTIONS);
    setLies(0);
    setFeatures({ loan: false, repeat: false, stop: false });
    setPending(null);
    setLastQuestion(null);
    setLastWasLie(null);
    setTurn(0);
    setGuessOpen(false);
    setOutcome(null);
    idRef.current = 0;
    setMessages([
      {
        id: 1,
        sender: "system",
        author: "Table",
        tone: "info",
        text: `${names[0]} drew a secret card from the 32-card deck. ${names[1]} and ${names[2]} have ${MAX_QUESTIONS} questions — the moderator may lie up to ${MAX_LIES} times.`,
      },
    ]);
    idRef.current = 1;
    setPhase("ask");
  }

  function askQuestion() {
    const text = draft.trim();
    if (!text || questionsLeft === 0) return;
    push({ sender: "player", author: asker, text });
    setLastQuestion(text);
    setQuestionsLeft((q) => q - 1);
    setPending({ kind: "question", text });
    setDraft("");
    setPhase("answer");
  }

  function answer(value: "Yes" | "No", lying: boolean) {
    if (!pending) return;
    push({
      sender: "moderator",
      author: moderator,
      text: pending.kind === "repeat" ? `${value} — (repeated answer)` : value,
    });
    if (lying) {
      setLies((l) => l + 1);
      setLastWasLie(true);
    } else {
      setLastWasLie(false);
    }
    setPending(null);
    setTurn((t) => (t === 0 ? 1 : 0));
    setPhase("ask");
  }

  function useLoan() {
    if (features.loan || lastWasLie === null) return;
    setFeatures((f) => ({ ...f, loan: true }));
    push({ sender: "player", author: asker, tone: "feature", text: "🪙 Loan — did you lie?" });
    push({
      sender: "moderator",
      author: moderator,
      tone: lastWasLie ? "bad" : "good",
      text: lastWasLie ? "Yes, that last answer was a lie." : "No, that last answer was the truth.",
    });
  }

  function useRepeat() {
    if (features.repeat || !lastQuestion) return;
    setFeatures((f) => ({ ...f, repeat: true }));
    push({
      sender: "player",
      author: asker,
      tone: "feature",
      text: `🔁 Repeat — "${lastQuestion}"`,
    });
    setPending({ kind: "repeat", text: lastQuestion });
    setPhase("answer");
  }

  function useStop() {
    if (features.stop) return;
    setFeatures((f) => ({ ...f, stop: true }));
    push({ sender: "player", author: asker, tone: "feature", text: "🛑 Stop — you lied too much!" });
    if (lies > MAX_LIES) {
      finish(true, `${moderator} lied ${lies} times — over the limit of ${MAX_LIES}. Stop wins!`);
    } else {
      push({
        sender: "system",
        author: "Table",
        tone: "bad",
        text: `Wrong call — ${moderator} is still within ${MAX_LIES} lies. Stop is burned; only naming the card can win now.`,
      });
    }
  }

  function finish(won: boolean, text: string) {
    setOutcome({ won, text });
    setShowCard(true);
    setPhase("over");
  }

  function submitGuess() {
    if (!card) return;
    push({
      sender: "player",
      author: asker,
      tone: "feature",
      text: `🔍 Final guess — ${guess.rank}${suitOf(guess.suit).symbol}`,
    });
    const right = card.rank === guess.rank && card.suit === guess.suit;
    finish(
      right,
      right
        ? `Correct! The card was ${cardLabel(card)}.`
        : `Not it — the card was ${cardLabel(card)}. ${moderator} keeps the round.`,
    );
  }

  if (phase === "setup") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-16">
        <div className="card-surface rounded-3xl p-5">
          <h2 className="text-lg font-semibold">Seat the table</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pass one device around. Player 1 is the moderator and holds the secret card.
          </p>
          <div className="mt-5 space-y-3">
            {names.map((n, i) => (
              <label key={i} className="block">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {i === 0 ? "Moderator" : `Guesser ${i}`}
                </span>
                <input
                  value={n}
                  onChange={(e) =>
                    setNames((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                  }
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>
          <button
            onClick={startGame}
            disabled={names.some((n) => !n.trim())}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-opacity disabled:opacity-50"
          >
            Deal the card
          </button>
        </div>

        <div className="card-surface mt-4 rounded-3xl p-5 text-sm text-muted-foreground">
          <h3 className="text-sm font-semibold text-foreground">How it plays</h3>
          <ul className="mt-2 space-y-1.5">
            <li>• 32 cards: 7 → A in ♥️ ♦️ ♣️ ♠️.</li>
            <li>• Guessers share {MAX_QUESTIONS} yes/no questions.</li>
            <li>• The moderator may lie up to {MAX_LIES} times.</li>
            <li>• 🪙 Loan, 🔁 Repeat and 🛑 Stop — one use each, ever.</li>
          </ul>
        </div>
      </div>
    );
  }

  const featureDisabled = phase !== "ask";

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4">
      {/* status */}
      <div className="card-surface flex items-center gap-3 rounded-2xl px-4 py-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Questions left</p>
          <p className="font-display text-lg font-bold">
            {questionsLeft}
            <span className="text-sm text-muted-foreground">/{MAX_QUESTIONS}</span>
          </p>
        </div>
        <div className="flex-1 border-l border-border pl-3">
          <p className="text-xs text-muted-foreground">Lies used</p>
          <p
            className={`font-display text-lg font-bold ${lies > MAX_LIES ? "text-destructive" : ""}`}
          >
            {lies}
            <span className="text-sm text-muted-foreground">/{MAX_LIES}</span>
          </p>
        </div>
        <button
          onClick={() => setShowCard((s) => !s)}
          className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground"
        >
          {showCard ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {showCard ? "Hide" : "Card"}
        </button>
      </div>

      {showCard && card && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-border p-3">
          <CardFace card={card} size="sm" />
          <p className="text-xs text-muted-foreground">
            {moderator}&apos;s eyes only — {cardLabel(card)}
          </p>
        </div>
      )}

      {/* chat */}
      <div ref={feedRef} className="mt-3 flex-1 space-y-3 overflow-y-auto py-1">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
      </div>

      {/* action panel */}
      {phase === "answer" && pending && (
        <div className="card-surface mt-3 rounded-3xl p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {moderator} answers {pending.kind === "repeat" ? "(repeat — truth only)" : ""}
          </p>
          <p className="mt-1 text-sm">&ldquo;{pending.text}&rdquo;</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => answer("Yes", false)}
              className="rounded-xl bg-success px-3 py-2.5 text-sm font-semibold text-success-foreground"
            >
              Yes
            </button>
            <button
              onClick={() => answer("No", false)}
              className="rounded-xl bg-success px-3 py-2.5 text-sm font-semibold text-success-foreground"
            >
              No
            </button>
            {pending.kind === "question" && (
              <>
                <button
                  onClick={() => answer("Yes", true)}
                  className="rounded-xl border border-destructive px-3 py-2.5 text-sm font-semibold text-destructive"
                >
                  Yes (lie)
                </button>
                <button
                  onClick={() => answer("No", true)}
                  className="rounded-xl border border-destructive px-3 py-2.5 text-sm font-semibold text-destructive"
                >
                  No (lie)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === "ask" && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <FeatureButton
              icon={<Hand className="size-4" />}
              label="Loan"
              hint="Did he lie?"
              used={features.loan}
              disabled={featureDisabled || lastWasLie === null}
              onClick={useLoan}
            />
            <FeatureButton
              icon={<Repeat className="size-4" />}
              label="Repeat"
              hint="Ask again"
              used={features.repeat}
              disabled={featureDisabled || !lastQuestion}
              onClick={useRepeat}
            />
            <FeatureButton
              icon={<Hand className="size-4 rotate-90" />}
              label="Stop"
              hint="Over 3 lies?"
              used={features.stop}
              disabled={featureDisabled}
              onClick={useStop}
            />
          </div>

          {guessOpen ? (
            <div className="card-surface rounded-3xl p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {asker}&apos;s final guess
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
                  onClick={() => setGuessOpen(false)}
                  className="flex-1 rounded-xl bg-secondary px-3 py-2.5 text-sm font-semibold text-secondary-foreground"
                >
                  Back
                </button>
                <button
                  onClick={submitGuess}
                  className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Lock it in
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <textarea
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      askQuestion();
                    }
                  }}
                  placeholder={
                    questionsLeft === 0
                      ? "No questions left — make your guess"
                      : `${asker}: ask a yes/no question…`
                  }
                  disabled={questionsLeft === 0}
                  className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-input bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
                <button
                  onClick={askQuestion}
                  disabled={!draft.trim() || questionsLeft === 0}
                  className="h-11 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Ask
                </button>
              </div>
              <button
                onClick={() => setGuessOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold"
              >
                <Search className="size-4" /> Name the card
              </button>
            </>
          )}
        </div>
      )}

      {phase === "over" && outcome && card && (
        <div className="card-surface mt-3 flex flex-col items-center rounded-3xl p-5 text-center">
          <CardFace card={card} size="lg" />
          <h2 className={`mt-4 text-xl font-bold ${outcome.won ? "text-success" : ""}`}>
            {outcome.won ? "Guessers win" : `${moderator} wins`}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{outcome.text}</p>
          <button
            onClick={startGame}
            className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <RotateCcw className="size-4" /> New round
          </button>
        </div>
      )}
    </div>
  );
}

function FeatureButton({
  icon,
  label,
  hint,
  used,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  used: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={used || disabled}
      className="card-surface flex flex-col items-start gap-1 rounded-2xl px-3 py-2.5 text-left transition-transform active:scale-95 disabled:opacity-45"
    >
      <span className="text-accent">{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[11px] text-muted-foreground">{used ? "used" : hint}</span>
    </button>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.sender === "system") {
    return (
      <p className="mx-auto max-w-[90%] rounded-xl bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
        {message.text}
      </p>
    );
  }
  const mine = message.sender === "player";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="px-2 pb-1 text-[11px] text-muted-foreground">{message.author}</span>
      <div
        className={`max-w-[82%] px-4 py-2.5 text-sm ${
          mine
            ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
            : "rounded-2xl rounded-bl-md bg-bubble-mod text-bubble-mod-foreground"
        } ${message.tone === "bad" ? "ring-1 ring-destructive" : ""} ${
          message.tone === "good" ? "ring-1 ring-success" : ""
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

export { HelpCircle };
