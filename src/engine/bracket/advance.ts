import type { Bracket, Match, MatchStatus } from './types';
import type { DuelSummary } from '../duel/types';
import { slotPlayer } from './selectors';

/** A match is playable only once both of its slots hold a real player. */
function statusFor(bracket: Bracket, match: Match): MatchStatus {
  if (match.status === 'done') return 'done';
  const [a, b] = [slotPlayer(bracket, match.slots[0]), slotPlayer(bracket, match.slots[1])];
  return a && b ? 'ready' : 'waiting';
}

/**
 * Walk the bracket, settling byes and recomputing which matches are playable.
 *
 * A player facing a bye advances without a duel, which can cascade — so this
 * repeats until nothing changes.
 */
export function resolveByes(bracket: Bracket): Bracket {
  let current = bracket;

  for (let pass = 0; pass < current.order.length + 1; pass++) {
    let changed = false;
    const matches: Record<string, Match> = { ...current.matches };

    for (const id of current.order) {
      const match = matches[id]!;
      if (match.status === 'done') continue;

      const [a, b] = [slotPlayer(current, match.slots[0]), slotPlayer(current, match.slots[1])];
      const hasBye = match.slots.some((s) => s.kind === 'bye');
      const soleEntrant = a ?? b;

      if (hasBye && soleEntrant) {
        matches[id] = { ...match, status: 'done', winnerId: soleEntrant.id, loserId: null };
        changed = true;
        continue;
      }

      const status = statusFor(current, match);
      if (status !== match.status) {
        matches[id] = { ...match, status };
        changed = true;
      }
    }

    if (!changed) return current;
    current = { ...current, matches };
  }

  return current;
}

export function reportResult(
  bracket: Bracket,
  matchId: string,
  winnerId: string,
  summary: DuelSummary | null,
): Bracket {
  const match = bracket.matches[matchId];
  if (!match) throw new Error(`No such match: ${matchId}`);
  if (match.status === 'done') throw new Error(`Match ${matchId} already has a result`);

  const [a, b] = [slotPlayer(bracket, match.slots[0]), slotPlayer(bracket, match.slots[1])];
  if (!a || !b) throw new Error(`Match ${matchId} does not yet have two players`);
  if (winnerId !== a.id && winnerId !== b.id) {
    throw new Error(`${winnerId} is not playing in match ${matchId}`);
  }

  const loserId = winnerId === a.id ? b.id : a.id;

  return resolveByes({
    ...bracket,
    matches: {
      ...bracket.matches,
      [matchId]: { ...match, status: 'done', winnerId, loserId, summary },
    },
  });
}
