import { describe, it, expect } from 'vitest';
import { createDuelState, duelReducer } from '../duelReducer';
import { currentPrompt, opponent } from '../selectors';
import { makeSetup, T0 } from './helpers';
import type { DuelState, DuelEvent } from '../types';

/** Apply a list of events in order, for readable multi-step tests. */
function run(state: DuelState, ...events: DuelEvent[]): DuelState {
  return events.reduce(duelReducer, state);
}

function started(overrides = {}): DuelState {
  const state = createDuelState(makeSetup(overrides));
  return duelReducer(state, { type: 'START', now: T0 });
}

describe('createDuelState', () => {
  it('starts both clocks at the configured time, ready and unstarted', () => {
    const state = createDuelState(makeSetup());
    expect(state.phase).toBe('ready');
    expect(state.remainingMs).toEqual({ A: 45_000, B: 45_000 });
    expect(state.clockStartedAt).toBeNull();
    expect(state.outcome).toBeNull();
    expect(state.queueIndex).toBe(0);
  });
});

describe('START', () => {
  it('begins with the configured first player and anchors the clock', () => {
    const state = started({ firstToAnswer: 'B' });
    expect(state.phase).toBe('running');
    expect(state.active).toBe('B');
    expect(state.clockStartedAt).toBe(T0);
  });

  it('ignores START when already running', () => {
    const state = started();
    expect(duelReducer(state, { type: 'START', now: T0 + 500 })).toBe(state);
  });
});

describe('TICK', () => {
  it('drains only the active clock', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 3_000 });
    expect(state.remainingMs).toEqual({ A: 42_000, B: 45_000 });
  });

  it('deducts the full elapsed time when a frame arrives late', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 250 }, { type: 'TICK', now: T0 + 10_000 });
    expect(state.remainingMs.A).toBe(35_000);
  });

  it('ends the duel the instant the active clock reaches zero', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 45_000 });
    expect(state.phase).toBe('finished');
    expect(state.remainingMs.A).toBe(0);
    expect(state.outcome).toMatchObject({ loser: 'A', winner: 'B', reason: 'timeout' });
  });

  it('never leaves a clock negative even after a hugely delayed tick', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 500_000 });
    expect(state.remainingMs.A).toBe(0);
    expect(state.remainingMs.B).toBe(45_000);
  });

  it('does nothing before the duel has started', () => {
    const ready = createDuelState(makeSetup());
    expect(duelReducer(ready, { type: 'TICK', now: T0 + 5_000 })).toBe(ready);
  });
});

describe('CORRECT', () => {
  it('stops the active clock and starts the opponent at the same instant', () => {
    const state = run(started(), { type: 'CORRECT', now: T0 + 6_000 });
    expect(state.remainingMs).toEqual({ A: 39_000, B: 45_000 });
    expect(state.active).toBe('B');
    expect(state.clockStartedAt).toBe(T0 + 6_000);
  });

  it('advances to the next prompt', () => {
    const before = started();
    expect(currentPrompt(before)?.id).toBe('p1');
    const after = duelReducer(before, { type: 'CORRECT', now: T0 + 1_000 });
    expect(currentPrompt(after)?.id).toBe('p2');
  });

  it('ping-pongs control back and forth', () => {
    const state = run(
      started(),
      { type: 'CORRECT', now: T0 + 1_000 },
      { type: 'CORRECT', now: T0 + 2_000 },
      { type: 'CORRECT', now: T0 + 3_500 },
    );
    expect(state.active).toBe('B');
    expect(state.remainingMs).toEqual({ A: 44_000 - 1_500, B: 44_000 });
  });

  it('counts a correct answer for the answering player', () => {
    const state = run(started(), { type: 'CORRECT', now: T0 + 1_000 });
    expect(state.stats.A.correct).toBe(1);
    expect(state.stats.B.correct).toBe(0);
  });

  it('records a timeline entry naming the prompt answered', () => {
    const state = run(started(), { type: 'CORRECT', now: T0 + 1_000 });
    expect(state.timeline).toEqual([{ kind: 'correct', slot: 'A', promptId: 'p1', at: T0 + 1_000 }]);
  });

  it('does not save a player whose clock already expired', () => {
    const state = run(started(), { type: 'CORRECT', now: T0 + 45_000 });
    expect(state.phase).toBe('finished');
    expect(state.outcome?.loser).toBe('A');
    expect(state.stats.A.correct).toBe(0);
  });

  it('ignores CORRECT after the duel has finished', () => {
    const finished = run(started(), { type: 'TICK', now: T0 + 45_000 });
    expect(duelReducer(finished, { type: 'CORRECT', now: T0 + 45_100 })).toBe(finished);
  });

  it('ignores CORRECT while paused', () => {
    const paused = run(started(), { type: 'PAUSE', now: T0 + 1_000, reason: 'host' });
    expect(duelReducer(paused, { type: 'CORRECT', now: T0 + 2_000 })).toBe(paused);
  });
});

describe('PASS', () => {
  it('deducts the 3s penalty and keeps the same player active', () => {
    const state = run(started(), { type: 'PASS', now: T0 + 4_000 });
    expect(state.active).toBe('A');
    expect(state.remainingMs.A).toBe(45_000 - 4_000 - 3_000);
    expect(state.remainingMs.B).toBe(45_000);
  });

  it('advances to the next prompt without handing over control', () => {
    const state = run(started(), { type: 'PASS', now: T0 + 1_000 }, { type: 'PASS', now: T0 + 2_000 });
    expect(currentPrompt(state)?.id).toBe('p3');
    expect(state.active).toBe('A');
  });

  it('keeps the clock anchored so the passing player keeps burning time', () => {
    const state = run(started(), { type: 'PASS', now: T0 + 1_000 }, { type: 'TICK', now: T0 + 3_000 });
    expect(state.remainingMs.A).toBe(45_000 - 1_000 - 3_000 - 2_000);
  });

  it('counts a pass for the passing player', () => {
    const state = run(started(), { type: 'PASS', now: T0 + 1_000 });
    expect(state.stats.A.passes).toBe(1);
  });

  it('ends the duel with the clock at exactly zero when the penalty exhausts it', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 43_000 }, { type: 'PASS', now: T0 + 43_000 });
    expect(state.phase).toBe('finished');
    expect(state.remainingMs.A).toBe(0);
    expect(state.outcome?.loser).toBe('A');
  });

  it('ends the duel when exactly the penalty remains', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 42_000 }, { type: 'PASS', now: T0 + 42_000 });
    expect(state.remainingMs.A).toBe(0);
    expect(state.phase).toBe('finished');
  });

  it('survives when just over the penalty remains', () => {
    const state = run(started(), { type: 'TICK', now: T0 + 41_900 }, { type: 'PASS', now: T0 + 41_900 });
    expect(state.remainingMs.A).toBe(100);
    expect(state.phase).toBe('running');
  });

  it('ignores PASS after the duel has finished', () => {
    const finished = run(started(), { type: 'TICK', now: T0 + 45_000 });
    expect(duelReducer(finished, { type: 'PASS', now: T0 + 45_100 })).toBe(finished);
  });
});

describe('PAUSE and RESUME', () => {
  it('PAUSE settles the clock and clears the anchor', () => {
    const state = run(started(), { type: 'PAUSE', now: T0 + 5_000, reason: 'host' });
    expect(state.phase).toBe('paused');
    expect(state.pauseReason).toBe('host');
    expect(state.remainingMs.A).toBe(40_000);
    expect(state.clockStartedAt).toBeNull();
  });

  it('RESUME charges nobody for the paused interval', () => {
    const state = run(
      started(),
      { type: 'PAUSE', now: T0 + 5_000, reason: 'hidden' },
      { type: 'RESUME', now: T0 + 605_000 },
      { type: 'TICK', now: T0 + 606_000 },
    );
    expect(state.remainingMs.A).toBe(39_000);
    expect(state.phase).toBe('running');
    expect(state.pauseReason).toBeNull();
  });

  it('ignores RESUME when not paused', () => {
    const state = started();
    expect(duelReducer(state, { type: 'RESUME', now: T0 + 1_000 })).toBe(state);
  });

  it('ignores PAUSE when not running', () => {
    const ready = createDuelState(makeSetup());
    expect(duelReducer(ready, { type: 'PAUSE', now: T0, reason: 'host' })).toBe(ready);
  });

  it('finishes rather than pausing when the clock expired during the gap', () => {
    const state = run(started(), { type: 'PAUSE', now: T0 + 45_000, reason: 'host' });
    expect(state.phase).toBe('finished');
    expect(state.outcome?.loser).toBe('A');
  });
});

describe('queue exhaustion', () => {
  it('reports an empty prompt once the queue is spent', () => {
    const short = started({ queue: ['p1'] });
    const state = duelReducer(short, { type: 'CORRECT', now: T0 + 1_000 });
    expect(currentPrompt(state)).toBeNull();
  });

  it('REFILL_QUEUE appends prompts and keeps play going', () => {
    const short = started({ queue: ['p1'] });
    const spent = duelReducer(short, { type: 'CORRECT', now: T0 + 1_000 });
    const refilled = duelReducer(spent, { type: 'REFILL_QUEUE', now: T0 + 1_000, ids: ['p3', 'p2'] });
    expect(currentPrompt(refilled)?.id).toBe('p3');
    expect(refilled.recycles).toBe(1);
  });

  it('ignores REFILL_QUEUE once the duel is finished', () => {
    const finished = run(started(), { type: 'TICK', now: T0 + 45_000 });
    expect(duelReducer(finished, { type: 'REFILL_QUEUE', now: T0, ids: ['p2'] })).toBe(finished);
  });
});

describe('opponent', () => {
  it('swaps slots', () => {
    expect(opponent('A')).toBe('B');
    expect(opponent('B')).toBe('A');
  });
});
