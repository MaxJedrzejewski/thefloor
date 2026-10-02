import type { Bracket, Player } from '../engine/bracket/types';
import type { DuelSetup, DuelSummary } from '../engine/duel/types';

export type TournamentPhase = 'setup' | 'bracket' | 'categoryPick' | 'duelIntro' | 'duel' | 'duelResult' | 'champion';

export interface ActiveDuel {
  setup: DuelSetup;
  matchId: string;
}

export interface Tournament {
  id: string;
  name: string;
  seed: number;
  phase: TournamentPhase;
  bracket: Bracket;
  /** Category ids the host enabled for this tournament. */
  enabledCategoryIds: string[];
  usedCategoryIds: string[];
  usedPromptIds: string[];
  duelsPlayed: number;
  active: ActiveDuel | null;
  lastResult: DuelSummary | null;
  /** The match the host chose to play next, while in the category picker. */
  selectedMatchId: string | null;
}

export interface TournamentDraft {
  name: string;
  players: Player[];
  enabledCategoryIds: string[];
  seed: number;
}
