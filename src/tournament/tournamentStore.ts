import type { Tournament } from './types';

export const TOURNAMENT_KEY = 'thefloor.tournament.v1';

interface StoredShape {
  version: 1;
  tournament: Tournament;
}

/**
 * Persisted between duels rather than every tick: a mid-duel reload should not
 * silently resume a clock, so an in-flight duel is dropped back to the bracket.
 */
export function saveTournament(tournament: Tournament): void {
  const persisted: Tournament =
    tournament.phase === 'duel' ||
    tournament.phase === 'duelIntro' ||
    tournament.phase === 'categoryPick'
      ? { ...tournament, phase: 'bracket', active: null }
      : tournament;

  try {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify({ version: 1, tournament: persisted }));
  } catch {
    // A full or unavailable storage must not take the game down mid-night.
  }
}

export function loadTournament(): Tournament | null {
  const raw = localStorage.getItem(TOURNAMENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredShape>;
    const tournament = parsed.tournament;
    if (!tournament?.bracket?.matches || !Array.isArray(tournament.bracket.order)) return null;
    return tournament;
  } catch {
    return null;
  }
}

export function clearTournament(): void {
  localStorage.removeItem(TOURNAMENT_KEY);
}
