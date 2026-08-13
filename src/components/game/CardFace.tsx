import { suitOf, type Card } from "@/lib/game";

export function CardFace({ card, size = "md" }: { card: Card; size?: "sm" | "md" | "lg" }) {
  const suit = suitOf(card.suit);
  const dims =
    size === "lg"
      ? "h-40 w-28 text-4xl"
      : size === "sm"
        ? "h-14 w-10 text-base"
        : "h-24 w-17 text-2xl";

  return (
    <div
      className={`${dims} flex flex-col items-center justify-center rounded-2xl border border-border bg-surface shadow-soft`}
    >
      <span
        className={`font-display font-bold ${suit.red ? "text-destructive" : "text-foreground"}`}
      >
        {card.rank}
      </span>
      <span className="leading-none">{suit.symbol}</span>
    </div>
  );
}
