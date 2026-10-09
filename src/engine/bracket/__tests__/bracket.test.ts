import { describe, it, expect } from 'vitest';
import { nextPowerOfTwo, standardSeedOrder } from '../seeding';
import { buildBracket } from '../buildBracket';
import { reportResult } from '../advance';
import { nextPendingMatch, readyMatches, champion, roundLabel, matchPlayers } from '../selectors';
import { assignWildcard, wildcardCandidates, wildcardSlots } from '../wildcard';
import type { Bracket, Player } from '../types';

function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    seed: i + 1,
  }));
}

/** Fill any open wildcard slot with the best-seeded round-one loser, as a host might. */
function fillWildcards(bracket: Bracket): Bracket {
  let current = bracket;
  for (const slot of wildcardSlots(current)) {
    const candidate = wildcardCandidates(current, slot)[0];
    if (!slot.playerId && !slot.locked && candidate) {
      current = assignWildcard(current, slot.matchId, slot.slot, candidate.id);
    }
  }
  return current;
}

/** Play every remaining match, always advancing the better seed. */
function playOutFavourites(bracket: Bracket): Bracket {
  let current = bracket;
  for (let guard = 0; guard < 100; guard++) {
    current = fillWildcards(current);
    const match = nextPendingMatch(current);
    if (!match) break;
    const [a, b] = matchPlayers(current, match);
    if (!a || !b) throw new Error('a ready match must have two players');
    const winner = a.seed < b.seed ? a : b;
    current = reportResult(current, match.id, winner.id, null);
  }
  return current;
}

describe('nextPowerOfTwo', () => {
  it('rounds up to the next power of two', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });
});

describe('standardSeedOrder', () => {
  it('pairs the top seed against the bottom seed', () => {
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it('produces the classic 8-team order', () => {
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('always contains each seed exactly once', () => {
    const order = standardSeedOrder(16);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe('buildBracket', () => {
  it('builds a full 8-player bracket with no byes', () => {
    const bracket = buildBracket(players(8));
    expect(bracket.size).toBe(8);
    expect(bracket.rounds).toBe(3);
    expect(bracket.order).toHaveLength(7);
    expect(Object.values(bracket.matches).every((m) => m.slots.every((s) => s.kind !== 'bye'))).toBe(true);
  });

  it('pairs the top seed against the bottom seed in round one', () => {
    const bracket = buildBracket(players(8));
    const first = bracket.matches[bracket.order[0]!]!;
    const [a, b] = matchPlayers(bracket, first);
    expect([a?.seed, b?.seed]).toEqual([1, 8]);
  });

  it('plays a full first round for 6 players, with one wildcard slot in round two', () => {
    const bracket = buildBracket(players(6));
    expect(bracket.size).toBe(8);
    const roundOne = Object.values(bracket.matches).filter((m) => m.round === 1);
    expect(roundOne).toHaveLength(3);
    expect(roundOne.every((m) => m.status === 'ready')).toBe(true);
    expect(Object.values(bracket.matches).some((m) => m.slots.some((s) => s.kind === 'bye'))).toBe(false);

    const wildcards = Object.values(bracket.matches).flatMap((m) => m.slots).filter((s) => s.kind === 'wildcard');
    expect(wildcards).toHaveLength(1);
  });

  it('pairs best against worst in round one', () => {
    const bracket = buildBracket(players(6));
    const seeds = ['r1m0', 'r1m1', 'r1m2'].map((id) => matchPlayers(bracket, bracket.matches[id]!).map((p) => p?.seed));
    expect(seeds).toEqual([[1, 6], [2, 5], [3, 4]]);
  });

  it('puts the wildcard against the strongest advancer, never against another wildcard', () => {
    for (const count of [5, 6, 9, 10, 11, 12, 13, 14, 15]) {
      const bracket = buildBracket(players(count));
      for (const match of Object.values(bracket.matches)) {
        expect(match.slots.filter((s) => s.kind === 'wildcard').length).toBeLessThanOrEqual(1);
      }
    }
    const bracket = buildBracket(players(6));
    expect(bracket.matches['r2m0']!.slots).toEqual([{ kind: 'winnerOf', matchId: 'r1m0' }, { kind: 'wildcard', playerId: null }]);
  });

  it('leaves the odd player an open wildcard opponent, played after every other round-one duel', () => {
    const bracket = buildBracket(players(7));
    expect(bracket.matches['r1m0']!.slots).toEqual([{ kind: 'player', playerId: 'p1' }, { kind: 'wildcard', playerId: null }]);
    const roundOne = bracket.order.filter((id) => bracket.matches[id]!.round === 1);
    expect(roundOne[roundOne.length - 1]).toBe('r1m0');
    expect(bracket.matches['r1m0']!.status).toBe('waiting');
    expect(Object.values(bracket.matches).some((m) => m.slots.some((s) => s.kind === 'bye'))).toBe(false);
  });

  it('never offers a match with an unfilled wildcard slot', () => {
    const bracket = buildBracket(players(5));
    expect(readyMatches(bracket).every((m) => m.slots.every((s) => s.kind !== 'wildcard'))).toBe(true);
  });

  it('marks only matches with two known players as ready', () => {
    const bracket = buildBracket(players(8));
    const ready = Object.values(bracket.matches).filter((m) => m.status === 'ready');
    const waiting = Object.values(bracket.matches).filter((m) => m.status === 'waiting');
    expect(ready).toHaveLength(4);
    expect(waiting).toHaveLength(3);
  });
});

describe('reportResult', () => {
  it('advances the winner into the parent slot', () => {
    const bracket = buildBracket(players(4));
    const first = nextPendingMatch(bracket)!;
    const [a] = matchPlayers(bracket, first);

    const after = reportResult(bracket, first.id, a!.id, null);
    const final = after.matches[after.order[after.order.length - 1]!]!;
    const finalists = matchPlayers(after, final);
    expect(finalists.map((p) => p?.id)).toContain(a!.id);
  });

  it('records the loser and the duel summary', () => {
    const bracket = buildBracket(players(4));
    const first = nextPendingMatch(bracket)!;
    const [a, b] = matchPlayers(bracket, first);

    const after = reportResult(bracket, first.id, b!.id, null);
    const match = after.matches[first.id]!;
    expect(match.status).toBe('done');
    expect(match.winnerId).toBe(b!.id);
    expect(match.loserId).toBe(a!.id);
  });

  it('rejects a winner who is not in the match', () => {
    const bracket = buildBracket(players(4));
    const first = nextPendingMatch(bracket)!;
    expect(() => reportResult(bracket, first.id, 'nobody', null)).toThrow();
  });

  it('rejects reporting the same match twice', () => {
    const bracket = buildBracket(players(4));
    const first = nextPendingMatch(bracket)!;
    const [a] = matchPlayers(bracket, first);
    const after = reportResult(bracket, first.id, a!.id, null);
    expect(() => reportResult(after, first.id, a!.id, null)).toThrow();
  });

  it('does not mutate the bracket it was given', () => {
    const bracket = buildBracket(players(4));
    const first = nextPendingMatch(bracket)!;
    const [a] = matchPlayers(bracket, first);
    reportResult(bracket, first.id, a!.id, null);
    expect(bracket.matches[first.id]!.status).toBe('ready');
  });
});

describe('playing a tournament to completion', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16])('crowns a champion with %i players', (count) => {
    const finished = playOutFavourites(buildBracket(players(count)));
    expect(nextPendingMatch(finished)).toBeNull();
    expect(champion(finished)).toBe('p1');
  });

  it('names an immediate champion for a one-player tournament', () => {
    const bracket = buildBracket(players(1));
    expect(nextPendingMatch(bracket)).toBeNull();
    expect(champion(bracket)).toBe('p1');
  });

  it('reports no champion until the final is played', () => {
    const bracket = buildBracket(players(4));
    expect(champion(bracket)).toBeNull();
  });
});

describe('nextPendingMatch', () => {
  it('returns matches in bracket order', () => {
    const bracket = buildBracket(players(4));
    expect(nextPendingMatch(bracket)!.id).toBe(bracket.order[0]);
  });
});

describe('roundLabel', () => {
  it('names the closing rounds', () => {
    expect(roundLabel(8, 3)).toBe('Final');
    expect(roundLabel(8, 2)).toBe('Semi-final');
    expect(roundLabel(8, 1)).toBe('Quarter-final');
    expect(roundLabel(16, 1)).toBe('Round of 16');
  });
});
