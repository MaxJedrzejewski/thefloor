export type PlayerSlot = 'A' | 'B';

export interface Prompt {
  id: string;
  kind: 'text' | 'image';
  /** The clue text, or the image source for image prompts. */
  body: string;
  /** Shown to the judge only. */
  answer: string;
  /** Alt text for image prompts. */
  alt?: string;
}

export interface DuelRules {
  startingMs: number;
  passPenaltyMs: number;
}

export interface DuelPlayer {
  playerId: string;
  name: string;
}

export interface DuelSetup {
  duelId: string;
  matchId: string;
  rules: DuelRules;
  categoryId: string;
  categoryName: string;
  players: Record<PlayerSlot, DuelPlayer>;
  firstToAnswer: PlayerSlot;
  /** Pre-shuffled prompt ids. Shuffling happens outside the reducer. */
  queue: string[];
  /** Every prompt reachable in this duel, keyed by id. */
  prompts: Record<string, Prompt>;
}

export type DuelPhase = 'ready' | 'running' | 'paused' | 'finished';
export type PauseReason = 'host' | 'hidden' | 'undo' | 'reveal';
export type EndReason = 'timeout';

export interface DuelOutcome {
  winner: PlayerSlot;
  loser: PlayerSlot;
  reason: EndReason;
  finalRemainingMs: Record<PlayerSlot, number>;
}

export type TimelineEntry =
  | { kind: 'correct'; slot: PlayerSlot; promptId: string; at: number }
  | { kind: 'pass'; slot: PlayerSlot; promptId: string; at: number };

export interface DuelStats {
  correct: number;
  passes: number;
}

export interface DuelState {
  setup: DuelSetup;
  phase: DuelPhase;
  active: PlayerSlot;
  remainingMs: Record<PlayerSlot, number>;
  /**
   * The timestamp the active clock was last settled to. Null unless the duel is
   * running — clearing it is what makes a paused interval invisible to the engine.
   */
  clockStartedAt: number | null;
  pauseReason: PauseReason | null;
  queueIndex: number;
  recycles: number;
  stats: Record<PlayerSlot, DuelStats>;
  outcome: DuelOutcome | null;
  timeline: TimelineEntry[];
}

export type DuelEvent =
  | { type: 'START'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'CORRECT'; now: number }
  | { type: 'PASS'; now: number }
  | { type: 'PAUSE'; now: number; reason: PauseReason }
  | { type: 'RESUME'; now: number }
  | { type: 'REFILL_QUEUE'; now: number; ids: string[] };

/** A duel result, flattened for the bracket and the result screen. */
export interface DuelSummary {
  duelId: string;
  categoryId: string;
  categoryName: string;
  winnerId: string;
  loserId: string;
  finalRemainingMs: Record<PlayerSlot, number>;
  players: Record<PlayerSlot, DuelPlayer>;
  stats: Record<PlayerSlot, DuelStats>;
  /** Prompt ids consumed, so a later duel does not repeat them. */
  usedPromptIds: string[];
}
