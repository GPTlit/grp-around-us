export const SUITS = [
  { id: "hearts", symbol: "♥️", label: "Hearts", red: true },
  { id: "diamonds", symbol: "♦️", label: "Diamonds", red: true },
  { id: "clubs", symbol: "♣️", label: "Clubs", red: false },
  { id: "spades", symbol: "♠️", label: "Spades", red: false },
] as const;

export const RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;

export type SuitId = (typeof SUITS)[number]["id"];
export type Rank = (typeof RANKS)[number];
export type Card = { rank: Rank; suit: SuitId };

export const DECK: Card[] = SUITS.flatMap((s) => RANKS.map((r) => ({ rank: r, suit: s.id })));

export const suitOf = (id: SuitId) => SUITS.find((s) => s.id === id)!;

export const cardLabel = (c: Card) => `${c.rank}${suitOf(c.suit).symbol}`;

export const drawCard = (): Card => DECK[Math.floor(Math.random() * DECK.length)]!;

export const MAX_QUESTIONS = 10;
export const MAX_LIES = 3;

export type Sender = "system" | "player" | "moderator";

export type Message = {
  id: number;
  sender: Sender;
  author: string;
  text: string;
  tone?: "info" | "good" | "bad" | "feature";
};
