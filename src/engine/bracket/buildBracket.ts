import type { Bracket, Match, Player, SlotRef } from './types';
import { nextPowerOfTwo, standardSeedOrder } from './seeding';
import { resolveByes } from './advance';

function matchId(round: number, index: number): string {
  return `r${round}m${index}`;
}

function emptyMatch(id: string, round: number, index: number, slots: [SlotRef, SlotRef]): Match {
  return {
    id,
    round,
    indexInRound: index,
    slots,
    status: 'waiting',
    winnerId: null,
    loserId: null,
    summary: null,
  };
}

const player = (p: Player): SlotRef => ({ kind: 'player', playerId: p.id });

/**
 * Seed a tournament whose field need not be a power of two.
 *
 * Round one pairs everybody up (best seed against worst). With an odd field the top
 * seed is left over: their match has an open wildcard slot and is played last, so the
 * host can pick the opponent from every player who has lost. The M winners then feed
 * round two, which needs the next power of two P of slots: the missing P - M slots are wildcards, left open for the host to
 * fill from the round-one losers. Wildcards are laid out against the strongest
 * advancers, never against each other.
 */
export function buildBracket(players: readonly Player[]): Bracket {
  const ranked = [...players].sort((a, b) => a.seed - b.seed);
  const size = nextPowerOfTwo(ranked.length);
  const rounds = Math.log2(size);

  const matches: Record<string, Match> = {};
  const order: string[] = [];
  const add = (match: Match) => {
    matches[match.id] = match;
    order.push(match.id);
  };

  if (ranked.length < 2) {
    return { size, rounds, players: Object.fromEntries(ranked.map((p) => [p.id, p])), matches, order };
  }

  // Round one.
  const odd = ranked.length % 2 === 1;
  const paired = odd ? ranked.slice(1) : ranked;
  const firstRound: [SlotRef, SlotRef][] = [];
  if (odd) firstRound.push([player(ranked[0]!), { kind: 'wildcard', playerId: null }]);
  for (let i = 0; i < paired.length / 2; i++) {
    firstRound.push([player(paired[i]!), player(paired[paired.length - 1 - i]!)]);
  }
  // The leftover player's match keeps the first id (it is advancer seed 1) but is
  // played after every other round-one duel.
  const playOrder = firstRound.map((_, i) => i);
  if (odd) playOrder.push(playOrder.shift()!);
  playOrder.forEach((i) => add(emptyMatch(matchId(1, i), 1, i, firstRound[i]!)));

  // Round two: advancer k is the winner of round-one match k; seeds beyond M are wildcards.
  const advancers = firstRound.length;
  const slotsInRoundTwo = nextPowerOfTwo(advancers);
  if (rounds >= 2) {
    const entrants: SlotRef[] = standardSeedOrder(slotsInRoundTwo).map((seed) =>
      seed <= advancers
        ? { kind: 'winnerOf', matchId: matchId(1, seed - 1) }
        : { kind: 'wildcard', playerId: null },
    );
    for (let i = 0; i < slotsInRoundTwo / 2; i++) {
      add(emptyMatch(matchId(2, i), 2, i, [entrants[i * 2]!, entrants[i * 2 + 1]!]));
    }
  }

  // Everything after that is an ordinary knockout.
  for (let round = 3; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let i = 0; i < count; i++) {
      add(
        emptyMatch(matchId(round, i), round, i, [
          { kind: 'winnerOf', matchId: matchId(round - 1, i * 2) },
          { kind: 'winnerOf', matchId: matchId(round - 1, i * 2 + 1) },
        ]),
      );
    }
  }

  return resolveByes({
    size,
    rounds,
    players: Object.fromEntries(ranked.map((p) => [p.id, p])),
    matches,
    order,
  });
}
