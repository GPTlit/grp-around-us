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

export const suitOf = (id: SuitId | string) => SUITS.find((s) => s.id === id) ?? SUITS[0];

export const cardLabel = (c: Card) => `${c.rank}${suitOf(c.suit).symbol}`;

export const drawCard = (): Card => DECK[Math.floor(Math.random() * DECK.length)]!;

export const MAX_LIES = 3;
export const TARGET_SCORE = 3;

export type MessageKind = "text" | "voice" | "card" | "system" | "meme" | "action" | "guess";

export type Room = {
  id: string;
  code: string;
  moderator_id: string;
  player1_id: string | null;
  player2_id: string | null;
  score1: number;
  score2: number;
  lies1: number;
  lies2: number;
  turn: number;
  round: number;
  status: string;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id: string | null;
  kind: MessageKind;
  body: string | null;
  card_rank: string | null;
  card_suit: string | null;
  audio_url: string | null;
  created_at: string;
};

export type Seat = "moderator" | "player1" | "player2" | "spectator";

export function seatOf(room: Room, userId: string | undefined): Seat {
  if (!userId) return "spectator";
  if (room.moderator_id === userId) return "moderator";
  if (room.player1_id === userId) return "player1";
  if (room.player2_id === userId) return "player2";
  return "spectator";
}
