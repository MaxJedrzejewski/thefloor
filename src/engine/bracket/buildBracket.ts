import type { Bracket, Match, Player, SlotRef } from './types';
import { nextPowerOfTwo, standardSeedOrder } from './seeding';
import { resolveByes } from './advance';

function matchId(round: number, index: number): string {
  return `r${round}m${index}`;
}

/**
 * Seed a single-elimination bracket.
 *
 * The field is padded up to a power of two with byes. Because entrants are laid
 * out in standard seed order, the padding naturally lands opposite the strongest
 * players, so the top seeds get the byes.
 */
export function buildBracket(players: readonly Player[]): Bracket {
  const ranked = [...players].sort((a, b) => a.seed - b.seed);
  const size = nextPowerOfTwo(ranked.length);
  const rounds = Math.log2(size);
  const bySeed = new Map(ranked.map((p) => [p.seed, p]));

  const entrants: SlotRef[] = standardSeedOrder(size).map((seed) => {
    const player = bySeed.get(seed);
    return player ? { kind: 'player', playerId: player.id } : { kind: 'bye' };
  });

  const matches: Record<string, Match> = {};
  const order: string[] = [];

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let index = 0; index < count; index++) {
      const id = matchId(round, index);
      const slots: [SlotRef, SlotRef] =
        round === 1
          ? [entrants[index * 2]!, entrants[index * 2 + 1]!]
          : [
              { kind: 'winnerOf', matchId: matchId(round - 1, index * 2) },
              { kind: 'winnerOf', matchId: matchId(round - 1, index * 2 + 1) },
            ];

      matches[id] = {
        id,
        round,
        indexInRound: index,
        slots,
        status: 'waiting',
        winnerId: null,
        loserId: null,
        summary: null,
      };
      order.push(id);
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
