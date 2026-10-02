import { buildBracket } from '../engine/bracket/buildBracket';
import { reportResult } from '../engine/bracket/advance';
import { champion, matchPlayers } from '../engine/bracket/selectors';
import { buildDuelSetup, drawDuel, rngForDuel } from '../engine/pickCategory';
import type { CategoryIndex } from '../content/schema';
import type { DuelSummary } from '../engine/duel/types';
import type { Tournament, TournamentDraft } from './types';

export type TournamentEvent =
  | { type: 'OPEN_CATEGORY_PICK'; matchId: string }
  | { type: 'DRAW_NEXT_DUEL'; categoryId: string; categories: CategoryIndex }
  | { type: 'BEGIN_DUEL' }
  | { type: 'FINISH_DUEL'; summary: DuelSummary }
  | { type: 'CONTINUE' }
  | { type: 'ABANDON_DUEL' };

export function createTournament(draft: TournamentDraft): Tournament {
  const bracket = buildBracket(draft.players);
  return {
    id: `t_${draft.seed.toString(36)}`,
    name: draft.name,
    seed: draft.seed,
    phase: champion(bracket) ? 'champion' : 'bracket',
    bracket,
    enabledCategoryIds: [...draft.enabledCategoryIds],
    usedCategoryIds: [],
    usedPromptIds: [],
    duelsPlayed: 0,
    active: null,
    lastResult: null,
    selectedMatchId: null,
  };
}

export function tournamentReducer(state: Tournament, event: TournamentEvent): Tournament {
  switch (event.type) {
    case 'OPEN_CATEGORY_PICK': {
      if (state.phase !== 'bracket') return state;
      const match = state.bracket.matches[event.matchId];
      if (!match || match.status !== 'ready') return state;
      return { ...state, phase: 'categoryPick', selectedMatchId: match.id };
    }

    case 'DRAW_NEXT_DUEL': {
      if (state.phase !== 'categoryPick' || !state.selectedMatchId) return state;
      const match = state.bracket.matches[state.selectedMatchId];
      if (!match || match.status !== 'ready') return state;

      const [a, b] = matchPlayers(state.bracket, match);
      if (!a || !b) return state;

      const rng = rngForDuel(state.seed, state.duelsPlayed + 1);
      const draw = drawDuel(
        event.categoryId,
        state.enabledCategoryIds,
        event.categories,
        state.usedCategoryIds,
        state.usedPromptIds,
        rng,
      );
      if (!draw) return state;

      const setup = buildDuelSetup({
        duelId: `${state.id}-d${state.duelsPlayed + 1}`,
        matchId: match.id,
        draw,
        players: {
          A: { playerId: a.id, name: a.name },
          B: { playerId: b.id, name: b.name },
        },
      });

      return { ...state, phase: 'duelIntro', active: { setup, matchId: match.id } };
    }

    case 'BEGIN_DUEL': {
      if (state.phase !== 'duelIntro' || !state.active) return state;
      return { ...state, phase: 'duel' };
    }

    case 'ABANDON_DUEL': {
      if (state.phase !== 'categoryPick' && state.phase !== 'duelIntro' && state.phase !== 'duel') {
        return state;
      }
      return { ...state, phase: 'bracket', active: null, selectedMatchId: null };
    }

    case 'FINISH_DUEL': {
      if (state.phase !== 'duel' || !state.active) return state;

      const bracket = reportResult(
        state.bracket,
        state.active.matchId,
        event.summary.winnerId,
        event.summary,
      );

      return {
        ...state,
        phase: 'duelResult',
        bracket,
        active: null,
        lastResult: event.summary,
        duelsPlayed: state.duelsPlayed + 1,
        usedCategoryIds: [...new Set([...state.usedCategoryIds, event.summary.categoryId])],
        usedPromptIds: [...new Set([...state.usedPromptIds, ...event.summary.usedPromptIds])],
      };
    }

    case 'CONTINUE': {
      if (state.phase !== 'duelResult') return state;
      return { ...state, phase: champion(state.bracket) ? 'champion' : 'bracket' };
    }
  }
}
