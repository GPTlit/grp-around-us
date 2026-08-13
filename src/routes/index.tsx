import { createFileRoute } from "@tanstack/react-router";
import { GameBoard } from "@/components/game/GameBoard";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liar's Deck — 32-Card Group Chat Guessing Game" },
      {
        name: "description",
        content:
          "A group chat card game for 3: the moderator hides one of 32 cards, guessers get 10 questions, and Loan, Repeat and Stop are one use each.",
      },
      { property: "og:title", content: "Liar's Deck — 32-Card Group Chat Guessing Game" },
      {
        property: "og:description",
        content:
          "Three players, one secret card, ten questions and three lies. Play Liar's Deck on one device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-4">
        <div>
          <h1 className="font-display text-xl font-bold">
            Liar&apos;s Deck <span className="text-accent">♠️</span>
          </h1>
          <p className="text-xs text-muted-foreground">3 players · 32 cards · 10 questions</p>
        </div>
        <ThemeToggle />
      </header>
      <GameBoard />
    </main>
  );
}
