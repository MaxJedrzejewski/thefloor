import { describe, it, expect, beforeEach } from 'vitest';
import { saveTournament, loadTournament, clearTournament, TOURNAMENT_KEY } from '../tournamentStore';
import { createTournament, tournamentReducer, type TournamentEvent } from '../tournamentReducer';
import { readyMatches } from '../../engine/bracket/selectors';
import { loadCategories } from '../../content/categoryStore';
import { BUNDLED_CATEGORIES } from '../../content/bundled';
import type { Tournament } from '../types';

function makeTournament(): Tournament {
  return createTournament({
    name: 'Friday Night',
    seed: 99,
    enabledCategoryIds: BUNDLED_CATEGORIES.map((c) => c.id),
    players: [
      { id: 'p1', name: 'Maya', seed: 1 },
      { id: 'p2', name: 'Jon', seed: 2 },
      { id: 'p3', name: 'Ada', seed: 3 },
      { id: 'p4', name: 'Sam', seed: 4 },
    ],
  });
}

beforeEach(() => localStorage.clear());

describe('tournamentStore', () => {
  it('round-trips a tournament', () => {
    const original = makeTournament();
    saveTournament(original);
    expect(loadTournament()).toEqual(original);
  });

  it('returns null when nothing has been saved', () => {
    expect(loadTournament()).toBeNull();
  });

  it('returns null for corrupt storage rather than throwing', () => {
    localStorage.setItem(TOURNAMENT_KEY, 'not json');
    expect(loadTournament()).toBeNull();
  });

  it('returns null for a payload that is not shaped like a tournament', () => {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify({ version: 1, tournament: { name: 'x' } }));
    expect(loadTournament()).toBeNull();
  });

  it('drops an in-flight duel back to the bracket so a reload cannot resume a clock', () => {
    const start = makeTournament();
    const inDuel = [
      { type: 'OPEN_CATEGORY_PICK', matchId: readyMatches(start.bracket)[0]!.id },
      { type: 'DRAW_NEXT_DUEL', categoryId: BUNDLED_CATEGORIES[0]!.id, categories: loadCategories() },
      { type: 'BEGIN_DUEL' },
    ].reduce((t, e) => tournamentReducer(t, e as TournamentEvent), start);
    expect(inDuel.phase).toBe('duel');

    saveTournament(inDuel);
    const restored = loadTournament();
    expect(restored?.phase).toBe('bracket');
    expect(restored?.active).toBeNull();
  });

  it('drops an open category picker back to the bracket', () => {
    const start = makeTournament();
    const picking = tournamentReducer(start, {
      type: 'OPEN_CATEGORY_PICK',
      matchId: readyMatches(start.bracket)[0]!.id,
    });
    expect(picking.phase).toBe('categoryPick');
    saveTournament(picking);
    expect(loadTournament()?.phase).toBe('bracket');
  });

  it('preserves completed results across a reload', () => {
    const played = { ...makeTournament(), duelsPlayed: 2, usedCategoryIds: ['bundled-movies'] };
    saveTournament(played);
    expect(loadTournament()?.duelsPlayed).toBe(2);
    expect(loadTournament()?.usedCategoryIds).toEqual(['bundled-movies']);
  });

  it('clears a saved tournament', () => {
    saveTournament(makeTournament());
    clearTournament();
    expect(loadTournament()).toBeNull();
  });
});
