import { describe, it, expect } from 'vitest';
import { createSession, sessionReducer, UNDO_DEPTH } from '../session';
import { currentPrompt } from '../selectors';
import { makeSetup, T0 } from './helpers';
import type { DuelSession, SessionEvent } from '../session';

function run(session: DuelSession, ...events: SessionEvent[]): DuelSession {
  return events.reduce(sessionReducer, session);
}

function started() {
  return sessionReducer(createSession(makeSetup()), { type: 'START', now: T0 });
}

describe('undo', () => {
  it('is unavailable on an untouched duel', () => {
    const session = started();
    expect(session.past).toHaveLength(0);
    expect(sessionReducer(session, { type: 'UNDO', now: T0 + 1_000 })).toBe(session);
  });

  it('restores the active player and the queue after a mis-pressed CORRECT', () => {
    const session = run(started(), { type: 'CORRECT', now: T0 + 5_000 });
    expect(session.present.active).toBe('B');
    expect(currentPrompt(session.present)?.id).toBe('p2');

    const undone = sessionReducer(session, { type: 'UNDO', now: T0 + 8_000 });
    expect(undone.present.active).toBe('A');
    expect(currentPrompt(undone.present)?.id).toBe('p1');
    expect(undone.present.stats.A.correct).toBe(0);
  });

  it('restores the clock to its value at the moment the key was pressed', () => {
    const session = run(started(), { type: 'CORRECT', now: T0 + 5_000 });
    // Three more seconds pass while the host argues about the ruling.
    const undone = sessionReducer(session, { type: 'UNDO', now: T0 + 8_000 });
    expect(undone.present.remainingMs.A).toBe(40_000);
    expect(undone.present.remainingMs.B).toBe(45_000);
  });

  it('leaves the duel paused so the argument is charged to nobody', () => {
    const session = run(started(), { type: 'CORRECT', now: T0 + 5_000 });
    const undone = sessionReducer(session, { type: 'UNDO', now: T0 + 8_000 });
    expect(undone.present.phase).toBe('paused');
    expect(undone.present.pauseReason).toBe('undo');
    expect(undone.present.clockStartedAt).toBeNull();
  });

  it('gives back the 3s penalty after a mis-pressed PASS', () => {
    const session = run(started(), { type: 'PASS', now: T0 + 5_000 });
    expect(session.present.remainingMs.A).toBe(37_000);

    const undone = sessionReducer(session, { type: 'UNDO', now: T0 + 6_000 });
    expect(undone.present.remainingMs.A).toBe(40_000);
    expect(undone.present.stats.A.passes).toBe(0);
  });

  it('reopens a duel that a mis-pressed key had ended', () => {
    const session = run(started(), { type: 'TICK', now: T0 + 43_000 }, { type: 'PASS', now: T0 + 43_000 });
    expect(session.present.phase).toBe('finished');

    const undone = sessionReducer(session, { type: 'UNDO', now: T0 + 44_000 });
    expect(undone.present.phase).toBe('paused');
    expect(undone.present.outcome).toBeNull();
    expect(undone.present.remainingMs.A).toBe(2_000);
  });

  it('does not rewind one animation frame at a time', () => {
    const session = run(
      started(),
      { type: 'TICK', now: T0 + 1_000 },
      { type: 'TICK', now: T0 + 2_000 },
      { type: 'CORRECT', now: T0 + 3_000 },
      { type: 'TICK', now: T0 + 4_000 },
      { type: 'TICK', now: T0 + 5_000 },
    );
    expect(session.past).toHaveLength(1);

    const undone = sessionReducer(session, { type: 'UNDO', now: T0 + 6_000 });
    expect(undone.present.active).toBe('A');
    expect(undone.present.remainingMs.A).toBe(42_000);
  });

  it('steps back one judgement at a time through several presses', () => {
    const session = run(
      started(),
      { type: 'CORRECT', now: T0 + 1_000 },
      { type: 'CORRECT', now: T0 + 2_000 },
      { type: 'CORRECT', now: T0 + 3_000 },
    );
    const once = sessionReducer(session, { type: 'UNDO', now: T0 + 4_000 });
    expect(currentPrompt(once.present)?.id).toBe('p3');

    const twice = sessionReducer(once, { type: 'UNDO', now: T0 + 4_000 });
    expect(currentPrompt(twice.present)?.id).toBe('p2');
  });

  it('caps the history depth and drops the oldest entry', () => {
    let session = started();
    for (let i = 0; i < UNDO_DEPTH + 5; i++) {
      session = sessionReducer(session, { type: 'CORRECT', now: T0 + i * 100 });
    }
    expect(session.past).toHaveLength(UNDO_DEPTH);
  });

  it('does not stack history for PAUSE, RESUME or TICK', () => {
    const session = run(
      started(),
      { type: 'PAUSE', now: T0 + 1_000, reason: 'host' },
      { type: 'RESUME', now: T0 + 2_000 },
      { type: 'TICK', now: T0 + 3_000 },
    );
    expect(session.past).toHaveLength(0);
  });

  it('does not stack history for a judgement that was itself a no-op', () => {
    const finished = run(started(), { type: 'TICK', now: T0 + 45_000 });
    const after = sessionReducer(finished, { type: 'CORRECT', now: T0 + 45_100 });
    expect(after).toBe(finished);
    expect(after.past).toHaveLength(0);
  });
});
