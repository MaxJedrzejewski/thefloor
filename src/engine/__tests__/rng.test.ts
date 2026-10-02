import { describe, it, expect } from 'vitest';
import { mulberry32, shuffle, pickOne, randomSeed } from '../rng';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it('stays within [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('is a permutation of the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(input, mulberry32(7));
    expect([...out].sort((x, y) => x - y)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input, mulberry32(7));
    expect(input).toEqual(copy);
  });

  it('is deterministic for a fixed seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(shuffle(input, mulberry32(42))).toEqual(shuffle(input, mulberry32(42)));
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    expect(shuffle(['only'], mulberry32(1))).toEqual(['only']);
  });
});

describe('pickOne', () => {
  it('returns an element of the array', () => {
    const items = ['a', 'b', 'c'];
    const rng = mulberry32(3);
    for (let i = 0; i < 20; i++) {
      expect(items).toContain(pickOne(items, rng));
    }
  });

  it('returns null for an empty array', () => {
    expect(pickOne([], mulberry32(1))).toBeNull();
  });
});

describe('randomSeed', () => {
  it('returns a non-negative integer', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });
});
