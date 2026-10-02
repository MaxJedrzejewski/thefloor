import type { Bracket, Match, Player, SlotRef } from './types';

/** The player occupying a slot, or null if it is a bye or still undecided. */
export function slotPlayer(bracket: Bracket, slot: SlotRef): Player | null {
  switch (slot.kind) {
    case 'bye':
      return null;
    case 'player':
      return bracket.players[slot.playerId] ?? null;
    case 'winnerOf': {
      const source = bracket.matches[slot.matchId];
      if (!source?.winnerId) return null;
      return bracket.players[source.winnerId] ?? null;
    }
  }
}

export function matchPlayers(bracket: Bracket, match: Match): [Player | null, Player | null] {
  return [slotPlayer(bracket, match.slots[0]), slotPlayer(bracket, match.slots[1])];
}

/** The next match a host should actually play, in bracket order. */
export function nextPendingMatch(bracket: Bracket): Match | null {
  return readyMatches(bracket)[0] ?? null;
}

/** Every match currently playable (both slots filled, no result yet), in bracket order. */
export function readyMatches(bracket: Bracket): Match[] {
  return bracket.order
    .map((id) => bracket.matches[id])
    .filter((m): m is Match => !!m && m.status === 'ready');
}

export function finalMatch(bracket: Bracket): Match | null {
  const id = bracket.order[bracket.order.length - 1];
  return id ? (bracket.matches[id] ?? null) : null;
}

export function champion(bracket: Bracket): string | null {
  const final = finalMatch(bracket);
  if (!final) {
    // A one-player tournament has no matches at all.
    const only = Object.values(bracket.players);
    return only.length === 1 ? only[0]!.id : null;
  }
  return final.status === 'done' ? final.winnerId : null;
}

export function matchesInRound(bracket: Bracket, round: number): Match[] {
  return bracket.order
    .map((id) => bracket.matches[id])
    .filter((m): m is Match => !!m && m.round === round)
    .sort((a, b) => a.indexInRound - b.indexInRound);
}

export function roundLabel(size: number, round: number): string {
  const rounds = Math.log2(size);
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-final';
  if (fromEnd === 2) return 'Quarter-final';
  return `Round of ${2 ** (fromEnd + 1)}`;
}

export function completedMatchCount(bracket: Bracket): number {
  return Object.values(bracket.matches).filter((m) => m.status === 'done').length;
}
