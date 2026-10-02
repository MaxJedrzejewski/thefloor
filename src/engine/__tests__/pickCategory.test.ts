import { describe, it, expect } from 'vitest';
import { availableCategories, drawDuel, refillQueue, rngForDuel } from '../pickCategory';
import { mulberry32 } from '../rng';
import type { Category, CategoryIndex } from '../../content/schema';
import type { Prompt } from '../duel/types';

function category(id: string, promptCount = 20): Category {
  return {
    id,
    name: id.toUpperCase(),
    source: 'custom',
    prompts: Array.from({ length: promptCount }, (_, i) => ({
      id: `${id}-${i}`,
      kind: 'text' as const,
      body: `Clue ${i}`,
      answer: `Answer ${i}`,
    })),
  };
}

function index(...categories: Category[]): CategoryIndex {
  return Object.fromEntries(categories.map((c) => [c.id, c]));
}

describe('availableCategories', () => {
  const pool = index(category('alpha'), category('beta'), category('gamma'));
  const ids = ['alpha', 'beta', 'gamma'];
  const names = (list: Category[]) => list.map((c) => c.id);

  it('lists every enabled playable category', () => {
    expect(names(availableCategories(ids, pool, []))).toEqual(ids);
  });

  it('hides categories the tournament has used', () => {
    expect(names(availableCategories(ids, pool, ['alpha']))).toEqual(['beta', 'gamma']);
  });

  it('opens the whole pool again once every category is used', () => {
    expect(names(availableCategories(ids, pool, ids))).toEqual(ids);
  });

  it('skips unknown ids and unplayable categories', () => {
    const mixed = index(category('alpha'), category('thin', 3));
    expect(names(availableCategories(['ghost', 'thin', 'alpha'], mixed, []))).toEqual(['alpha']);
  });
});

describe('drawDuel', () => {
  const pool = index(category('alpha'), category('beta'), category('gamma'));
  const ids = ['alpha', 'beta', 'gamma'];

  it('draws the category that was picked', () => {
    expect(drawDuel('beta', ids, pool, [], [], mulberry32(1))?.category.id).toBe('beta');
  });

  it('refuses a category that is not available', () => {
    expect(drawDuel('ghost', ids, pool, [], [], mulberry32(1))).toBeNull();
    expect(drawDuel('beta', ids, pool, ['alpha'], [], mulberry32(1))).not.toBeNull();
    expect(drawDuel('alpha', ids, pool, ['alpha'], [], mulberry32(1))).toBeNull();
    expect(drawDuel('alpha', ['beta'], pool, [], [], mulberry32(1))).toBeNull();
  });

  it('refuses an unplayable category', () => {
    const thin = index(category('thin', 3));
    expect(drawDuel('thin', ['thin'], thin, [], [], mulberry32(1))).toBeNull();
  });

  it('skips prompts already seen in this tournament', () => {
    const seen = ['alpha-0', 'alpha-1', 'alpha-2'];
    const draw = drawDuel('alpha', ['alpha'], pool, [], seen, mulberry32(3));
    for (const id of seen) expect(draw?.queue).not.toContain(id);
  });

  it('falls back to the full set rather than running on a handful of clues', () => {
    const seen = category('alpha').prompts.slice(0, 15).map((p) => p.id);
    const draw = drawDuel('alpha', ['alpha'], pool, [], seen, mulberry32(3));
    expect(draw?.queue).toHaveLength(20);
  });

  it('shuffles the queue rather than playing in authored order', () => {
    const draw = drawDuel('alpha', ['alpha'], pool, [], [], mulberry32(9));
    const authored = category('alpha').prompts.map((p) => p.id);
    expect(draw?.queue).not.toEqual(authored);
    expect([...draw!.queue].sort()).toEqual([...authored].sort());
  });

  it('exposes every prompt in the category so a refill can reach them', () => {
    const draw = drawDuel('alpha', ['alpha'], pool, [], ['alpha-0'], mulberry32(3));
    expect(Object.keys(draw!.prompts)).toHaveLength(20);
  });

  it('picks a first answerer', () => {
    const draw = drawDuel('alpha', ids, pool, [], [], mulberry32(1));
    expect(['A', 'B']).toContain(draw?.firstToAnswer);
  });

  it('gives both players the first turn across many draws', () => {
    const firsts = new Set(
      Array.from({ length: 40 }, (_, i) => drawDuel('alpha', ids, pool, [], [], mulberry32(i))?.firstToAnswer),
    );
    expect(firsts).toEqual(new Set(['A', 'B']));
  });

  it('is deterministic for a given seed', () => {
    expect(drawDuel('alpha', ids, pool, [], [], mulberry32(77))).toEqual(
      drawDuel('alpha', ids, pool, [], [], mulberry32(77)),
    );
  });
});

describe('refillQueue', () => {
  const prompts: Record<string, Prompt> = Object.fromEntries(
    category('alpha', 5).prompts.map((p) => [p.id, p]),
  );

  it('returns every prompt in the category', () => {
    expect(refillQueue(prompts, null, mulberry32(1)).sort()).toEqual(Object.keys(prompts).sort());
  });

  it('never repeats the clue that was just shown', () => {
    for (let seed = 0; seed < 30; seed++) {
      const refilled = refillQueue(prompts, 'alpha-2', mulberry32(seed));
      expect(refilled[0]).not.toBe('alpha-2');
    }
  });

  it('handles an empty prompt set', () => {
    expect(refillQueue({}, null, mulberry32(1))).toEqual([]);
  });
});

describe('rngForDuel', () => {
  it('gives each duel in a tournament its own stream', () => {
    const a = rngForDuel(1234, 1);
    const b = rngForDuel(1234, 2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('replays the same duel identically', () => {
    const a = rngForDuel(1234, 3);
    const b = rngForDuel(1234, 3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
