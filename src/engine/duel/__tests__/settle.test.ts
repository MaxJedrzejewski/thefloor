import { describe, it, expect } from 'vitest';
import { settle, checkTimeout, advanceTo } from '../settle';
import { createDuelState } from '../duelReducer';
import { makeSetup, T0 } from './helpers';
import type { DuelState } from '../types';

function running(overrides: Partial<DuelState> = {}): DuelState {
  const base = createDuelState(makeSetup());
  return {
    ...base,
    phase: 'running',
    active: 'A',
    clockStartedAt: T0,
    ...overrides,
  };
}

describe('settle', () => {
  it('deducts elapsed time from the active clock only', () => {
    const next = settle(running(), T0 + 5_000);
    expect(next.remainingMs.A).toBe(40_000);
    expect(next.remainingMs.B).toBe(45_000);
  });

  it('re-anchors clockStartedAt to now', () => {
    const next = settle(running(), T0 + 5_000);
    expect(next.clockStartedAt).toBe(T0 + 5_000);
  });

  it('clamps at zero and never goes negative', () => {
    const next = settle(running(), T0 + 60_000);
    expect(next.remainingMs.A).toBe(0);
  });

  it('is a no-op when the duel is paused', () => {
    const paused = running({ phase: 'paused', clockStartedAt: null });
    const next = settle(paused, T0 + 5_000);
    expect(next).toBe(paused);
  });

  it('is a no-op when the duel is ready', () => {
    const ready = createDuelState(makeSetup());
    expect(settle(ready, T0 + 5_000)).toBe(ready);
  });

  it('is a no-op when the duel is finished', () => {
    const finished = running({ phase: 'finished', clockStartedAt: null });
    expect(settle(finished, T0 + 5_000)).toBe(finished);
  });

  it('ignores a backwards now rather than crediting free time', () => {
    const next = settle(running(), T0 - 5_000);
    expect(next.remainingMs.A).toBe(45_000);
    expect(next.clockStartedAt).toBe(T0 - 5_000);
  });

  it('is idempotent when called twice with the same now', () => {
    const once = settle(running(), T0 + 5_000);
    const twice = settle(once, T0 + 5_000);
    expect(twice.remainingMs).toEqual(once.remainingMs);
  });

  it('deducts from player B when B is active', () => {
    const next = settle(running({ active: 'B' }), T0 + 7_500);
    expect(next.remainingMs.B).toBe(37_500);
    expect(next.remainingMs.A).toBe(45_000);
  });
});

describe('checkTimeout', () => {
  it('finishes the duel when the active clock is at zero', () => {
    const drained = running({ remainingMs: { A: 0, B: 20_000 } });
    const next = checkTimeout(drained, T0);
    expect(next.phase).toBe('finished');
    expect(next.outcome).toMatchObject({ winner: 'B', loser: 'A', reason: 'timeout' });
    expect(next.clockStartedAt).toBeNull();
  });

  it('leaves a duel with time remaining untouched', () => {
    const live = running();
    expect(checkTimeout(live, T0)).toBe(live);
  });

  it('is idempotent', () => {
    const drained = running({ remainingMs: { A: 0, B: 20_000 } });
    const once = checkTimeout(drained, T0);
    expect(checkTimeout(once, T0)).toBe(once);
  });

  it('records both final clocks on the outcome', () => {
    const drained = running({ remainingMs: { A: 0, B: 12_345 } });
    const next = checkTimeout(drained, T0);
    expect(next.outcome?.finalRemainingMs).toEqual({ A: 0, B: 12_345 });
  });
});

describe('advanceTo', () => {
  it('settles then finishes a duel whose clock ran out in the gap', () => {
    const next = advanceTo(running({ remainingMs: { A: 100, B: 30_000 } }), T0 + 5_000);
    expect(next.phase).toBe('finished');
    expect(next.remainingMs.A).toBe(0);
    expect(next.outcome?.loser).toBe('A');
  });

  it('leaves a live duel running', () => {
    const next = advanceTo(running(), T0 + 1_000);
    expect(next.phase).toBe('running');
    expect(next.remainingMs.A).toBe(44_000);
  });
});
