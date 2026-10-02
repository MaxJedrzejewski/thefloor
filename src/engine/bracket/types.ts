import type { DuelSummary } from '../duel/types';

export interface Player {
  id: string;
  name: string;
  /** 1 is the top seed. */
  seed: number;
}

export type SlotRef =
  | { kind: 'player'; playerId: string }
  | { kind: 'winnerOf'; matchId: string }
  | { kind: 'bye' };

export type MatchStatus = 'waiting' | 'ready' | 'done';

export interface Match {
  id: string;
  round: number;
  indexInRound: number;
  slots: [SlotRef, SlotRef];
  status: MatchStatus;
  winnerId: string | null;
  loserId: string | null;
  summary: DuelSummary | null;
}

export interface Bracket {
  /** Padded to a power of two. */
  size: number;
  rounds: number;
  players: Record<string, Player>;
  matches: Record<string, Match>;
  /** Match ids in play order. */
  order: string[];
}
