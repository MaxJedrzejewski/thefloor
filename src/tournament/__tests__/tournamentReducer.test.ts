import { describe, it, expect } from 'vitest';
import { createTournament, tournamentReducer, type TournamentEvent } from '../tournamentReducer';
import { availableCategories } from '../../engine/pickCategory';
import { champion, nextPendingMatch, readyMatches } from '../../engine/bracket/selectors';
import { BUNDLED_CATEGORIES } from '../../content/bundled';
import { wildcardCandidates, wildcardSlots } from '../../engine/bracket/wildcard';
import { loadCategories } from '../../content/categoryStore';
import type { Tournament } from '../types';
import type { DuelSummary } from '../../engine/duel/types';

const categories = loadCategories();
const enabledCategoryIds = BUNDLED_CATEGORIES.map((c) => c.id);
const PICK = enabledCategoryIds[0]!;

function makeTournament(playerCount = 4): Tournament {
  return createTournament({
    name: 'Friday Night',
    seed: 4242,
    enabledCategoryIds,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      seed: i + 1,
    })),
  });
}

/** Open the picker for the next ready match and choose the first category still on offer. */
function pickEvents(state: Tournament): TournamentEvent[] {
  const [first] = availableCategories(state.enabledCategoryIds, categories, state.usedCategoryIds);
  const matchId = readyMatches(state.bracket)[0]!.id;
  return [
    { type: 'OPEN_CATEGORY_PICK', matchId },
    { type: 'DRAW_NEXT_DUEL', categoryId: first!.id, categories },
  ];
}

function run(state: Tournament, ...events: TournamentEvent[]): Tournament {
  return events.reduce(tournamentReducer, state);
}

/** Open the category picker for whichever match is first in ready order. */
function openFirst(state: Tournament): TournamentEvent {
  return { type: 'OPEN_CATEGORY_PICK', matchId: readyMatches(state.bracket)[0]!.id };
}

/** A summary in which slot A always wins, for driving a tournament forward. */
function summaryFor(state: Tournament): DuelSummary {
  const setup = state.active!.setup;
  return {
    duelId: setup.duelId,
    categoryId: setup.categoryId,
    categoryName: setup.categoryName,
    winnerId: setup.players.A.playerId,
    loserId: setup.players.B.playerId,
    finalRemainingMs: { A: 12_000, B: 0 },
    players: setup.players,
    stats: { A: { correct: 6, passes: 1 }, B: { correct: 4, passes: 2 } },
    usedPromptIds: setup.queue.slice(0, 11),
  };
}

/** Fill every open wildcard slot with the best-seeded round-one loser, as a host would. */
function fillWildcards(state: Tournament): Tournament {
  let current = state;
  for (const slot of wildcardSlots(current.bracket)) {
    const candidate = wildcardCandidates(current.bracket, slot)[0];
    if (!slot.playerId && candidate) {
      current = tournamentReducer(current, {
        type: 'ASSIGN_WILDCARD',
        matchId: slot.matchId,
        slot: slot.slot,
        playerId: candidate.id,
      });
    }
  }
  return current;
}

function playOneDuel(initial: Tournament): Tournament {
  const state = fillWildcards(initial);
  const drawn = run(state, ...pickEvents(state), { type: 'BEGIN_DUEL' });
  return run(drawn, { type: 'FINISH_DUEL', summary: summaryFor(drawn) }, { type: 'CONTINUE' });
}

describe('createTournament', () => {
  it('opens on the bracket with nothing played', () => {
    const state = makeTournament();
    expect(state.phase).toBe('bracket');
    expect(state.duelsPlayed).toBe(0);
    expect(state.active).toBeNull();
  });

  it('goes straight to a champion for a single player', () => {
    expect(makeTournament(1).phase).toBe('champion');
  });
});

describe('DRAW_NEXT_DUEL', () => {
  it('sets up the next pending match with two real players', () => {
    const initial = makeTournament();
    const state = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories });
    expect(state.phase).toBe('duelIntro');
    expect(state.active?.setup.players.A.name).toBeTruthy();
    expect(state.active?.setup.players.B.name).toBeTruthy();
    expect(state.active?.matchId).toBe(nextPendingMatch(state.bracket)?.id);
  });

  it('uses the category the host picked', () => {
    const other = enabledCategoryIds[3]!;
    const initial = makeTournament();
    const state = run(
      initial,
      openFirst(initial),
      { type: 'DRAW_NEXT_DUEL', categoryId: other, categories },
    );
    expect(state.active?.setup.categoryId).toBe(other);
  });

  it('ignores a pick that is not available', () => {
    const initial = makeTournament();
    const picking = run(initial, openFirst(initial));
    expect(run(picking, { type: 'DRAW_NEXT_DUEL', categoryId: 'ghost', categories })).toBe(picking);
  });

  it('ignores a category the tournament has already used', () => {
    const initial = { ...makeTournament(), usedCategoryIds: [PICK] };
    const picking = run(initial, openFirst(initial));
    expect(run(picking, { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories })).toBe(picking);
  });

  it('cannot draw without opening the picker first', () => {
    const state = makeTournament();
    expect(run(state, { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories })).toBe(state);
  });

  it('can back out of the picker to the bracket', () => {
    const initial = makeTournament();
    const state = run(initial, openFirst(initial), { type: 'ABANDON_DUEL' });
    expect(state.phase).toBe('bracket');
  });

  it('opens a 6-player bracket with the top seed against the bottom seed, no bye', () => {
    const initial = makeTournament(6);
    const state = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories });
    const ids = [state.active!.setup.players.A.playerId, state.active!.setup.players.B.playerId];
    expect(ids.sort()).toEqual(['p1', 'p6']);
  });

  it('does nothing when no categories are enabled', () => {
    const barren = { ...makeTournament(), enabledCategoryIds: [] };
    const picking = run(barren, openFirst(barren));
    expect(run(picking, { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories })).toBe(picking);
  });

  it('is ignored while a duel is already in progress', () => {
    const initial = makeTournament();
    const state = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories }, { type: 'BEGIN_DUEL' });
    expect(run(state, { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories })).toBe(state);
  });
});

describe('FINISH_DUEL', () => {
  it('advances the bracket and records the summary', () => {
    const initial = makeTournament();
    const drawn = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories }, { type: 'BEGIN_DUEL' });
    const summary = summaryFor(drawn);
    const state = run(drawn, { type: 'FINISH_DUEL', summary });

    expect(state.phase).toBe('duelResult');
    expect(state.duelsPlayed).toBe(1);
    expect(state.lastResult).toEqual(summary);
    expect(state.bracket.matches[drawn.active!.matchId]!.winnerId).toBe(summary.winnerId);
  });

  it('remembers the category and prompts so they are not reused', () => {
    const initial = makeTournament();
    const drawn = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories }, { type: 'BEGIN_DUEL' });
    const summary = summaryFor(drawn);
    const state = run(drawn, { type: 'FINISH_DUEL', summary });

    expect(state.usedCategoryIds).toEqual([summary.categoryId]);
    expect(state.usedPromptIds).toEqual(summary.usedPromptIds);
  });

  it('is ignored before the duel has actually begun', () => {
    const initial = makeTournament();
    const drawn = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories });
    expect(run(drawn, { type: 'FINISH_DUEL', summary: summaryFor(drawn) })).toBe(drawn);
  });
});

describe('ABANDON_DUEL', () => {
  it('returns to the bracket without recording a result', () => {
    const initial = makeTournament();
    const drawn = run(initial, openFirst(initial), { type: 'DRAW_NEXT_DUEL', categoryId: PICK, categories }, { type: 'BEGIN_DUEL' });
    const state = run(drawn, { type: 'ABANDON_DUEL' });
    expect(state.phase).toBe('bracket');
    expect(state.duelsPlayed).toBe(0);
    expect(state.active).toBeNull();
  });
});

describe('playing a tournament through', () => {
  it('reaches a champion after every match', () => {
    let state = makeTournament(4);
    for (let i = 0; i < 10 && state.phase !== 'champion'; i++) {
      state = playOneDuel(state);
    }
    expect(state.phase).toBe('champion');
    expect(champion(state.bracket)).toBe('p1');
    expect(state.duelsPlayed).toBe(3);
  });

  it('plays 6 duels for 6 players, because the wildcard plays again', () => {
    let state = makeTournament(6);
    for (let i = 0; i < 20 && state.phase !== 'champion'; i++) {
      state = playOneDuel(state);
    }
    expect(state.phase).toBe('champion');
    expect(state.duelsPlayed).toBe(6);
  });

  it('does not repeat a category until the pool is used up', () => {
    let state = makeTournament(8);
    const drawnCategories: string[] = [];
    for (let i = 0; i < 7 && state.phase !== 'champion'; i++) {
      const drawn = run(state, ...pickEvents(state), { type: 'BEGIN_DUEL' });
      drawnCategories.push(drawn.active!.setup.categoryId);
      state = run(drawn, { type: 'FINISH_DUEL', summary: summaryFor(drawn) }, { type: 'CONTINUE' });
    }
    const firstSix = drawnCategories.slice(0, BUNDLED_CATEGORIES.length);
    expect(new Set(firstSix).size).toBe(firstSix.length);
  });

  it('does not repeat a prompt across duels in the same category', () => {
    let state = makeTournament(8);
    const seen = new Set<string>();
    for (let i = 0; i < 7 && state.phase !== 'champion'; i++) {
      const drawn = run(state, ...pickEvents(state), { type: 'BEGIN_DUEL' });
      const summary = summaryFor(drawn);
      for (const id of summary.usedPromptIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
      state = run(drawn, { type: 'FINISH_DUEL', summary }, { type: 'CONTINUE' });
    }
    expect(seen.size).toBeGreaterThan(0);
  });
});

describe('ASSIGN_WILDCARD', () => {
  const assign = { type: 'ASSIGN_WILDCARD', matchId: 'r2m0', slot: 1, playerId: 'p5' } as const;

  it('ignores an invalid assignment instead of throwing', () => {
    const state = makeTournament(6);
    expect(tournamentReducer(state, assign)).toBe(state); // nobody has lost yet
  });

  it('only applies from the bracket phase', () => {
    const state = { ...makeTournament(6), phase: 'duel' } as Tournament;
    expect(tournamentReducer(state, assign)).toBe(state);
  });

  it('fills the slot once a round-one loser exists', () => {
    let state = makeTournament(6);
    const first = readyMatches(state.bracket)[0]!;
    state = tournamentReducer(state, { type: 'OPEN_CATEGORY_PICK', matchId: first.id });
    state = { ...state, phase: 'bracket', selectedMatchId: null };
    const bracketWithLoser = {
      ...state.bracket,
      matches: { ...state.bracket.matches, [first.id]: { ...first, status: 'done' as const, winnerId: 'p1', loserId: 'p6' } },
    };
    const next = tournamentReducer({ ...state, bracket: bracketWithLoser }, { ...assign, playerId: 'p6' });
    expect(next.bracket.matches['r2m0']!.slots[1]).toEqual({ kind: 'wildcard', playerId: 'p6' });
  });
});
