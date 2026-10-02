import { describe, it, expect } from 'vitest';
import { createSession, sessionReducer } from '../session';
import { currentPrompt, consumedPromptIds } from '../selectors';
import { makeSetup, makePrompts, T0 } from './helpers';
import type { DuelSession, SessionEvent } from '../session';

function play(...events: SessionEvent[]): DuelSession {
  const prompts = makePrompts(40);
  const setup = makeSetup({
    queue: prompts.map((p) => p.id),
    prompts: Object.fromEntries(prompts.map((p) => [p.id, p])),
  });
  return events.reduce(sessionReducer, createSession(setup));
}

describe('a full duel', () => {
  it('plays out a long rally and ends on a genuine timeout', () => {
    // A and B trade correct answers, with A thinking noticeably longer each turn.
    // Clock arithmetic below is hand-computed, in milliseconds from T0.
    const session = play(
      { type: 'START', now: T0 },
      { type: 'CORRECT', now: T0 + 4_000 }, //  A answers in 4.0  -> A 41.0, B's turn
      { type: 'CORRECT', now: T0 + 6_000 }, //  B answers in 2.0  -> B 43.0, A's turn
      { type: 'CORRECT', now: T0 + 13_000 }, // A answers in 7.0  -> A 34.0
      { type: 'CORRECT', now: T0 + 14_500 }, // B answers in 1.5  -> B 41.5
      { type: 'PASS', now: T0 + 20_500 }, //    A passes after 6.0, -3.0 -> A 25.0
      { type: 'CORRECT', now: T0 + 23_500 }, // A answers in 3.0  -> A 22.0
      { type: 'CORRECT', now: T0 + 25_500 }, // B answers in 2.0  -> B 39.5
      { type: 'TICK', now: T0 + 40_000 }, //    A stalls 14.5     -> A  7.5
      { type: 'TICK', now: T0 + 45_000 }, //    A stalls 5.0 more -> A  2.5
    );

    expect(session.present.phase).toBe('running');
    expect(session.present.active).toBe('A');
    expect(session.present.remainingMs).toEqual({ A: 2_500, B: 39_500 });
    expect(session.present.stats).toEqual({
      A: { correct: 3, passes: 1 },
      B: { correct: 3, passes: 0 },
    });
    // Seven prompts consumed: five correct by A/B plus the pass, plus the one in play.
    expect(currentPrompt(session.present)?.id).toBe('p8');

    // A never finds the answer.
    const final = sessionReducer(session, { type: 'TICK', now: T0 + 47_500 });
    expect(final.present.phase).toBe('finished');
    expect(final.present.remainingMs).toEqual({ A: 0, B: 39_500 });
    expect(final.present.outcome).toMatchObject({ winner: 'B', loser: 'A', reason: 'timeout' });
  });

  it('ends on a pass penalty with the clock reading exactly zero', () => {
    const session = play(
      { type: 'START', now: T0 },
      { type: 'CORRECT', now: T0 + 1_000 }, // A -> 44.0, B's turn
      { type: 'PASS', now: T0 + 5_000 }, //    B burns 4.0, -3.0 -> B 38.0
      { type: 'PASS', now: T0 + 8_000 }, //    B burns 3.0, -3.0 -> B 32.0
      { type: 'TICK', now: T0 + 39_500 }, //   B burns 31.5      -> B  0.5
      { type: 'PASS', now: T0 + 39_500 }, //   penalty exceeds what is left
    );

    expect(session.present.phase).toBe('finished');
    expect(session.present.remainingMs.B).toBe(0);
    expect(session.present.remainingMs.A).toBe(44_000);
    expect(session.present.outcome).toMatchObject({ winner: 'A', loser: 'B' });
    // The pass that ended the duel still counts as a pass.
    expect(session.present.stats.B.passes).toBe(3);
  });

  it('charges nobody for a pause in the middle of a rally', () => {
    const session = play(
      { type: 'START', now: T0 },
      { type: 'CORRECT', now: T0 + 5_000 },
      { type: 'PAUSE', now: T0 + 7_000, reason: 'hidden' },
      { type: 'RESUME', now: T0 + 300_000 },
      { type: 'CORRECT', now: T0 + 301_000 },
    );

    expect(session.present.remainingMs).toEqual({ A: 40_000, B: 42_000 });
    expect(session.present.active).toBe('A');
  });

  it('never lets a clock go negative across a long random rally', () => {
    let session = play({ type: 'START', now: T0 });
    let now = T0;
    const kinds = ['CORRECT', 'PASS', 'TICK'] as const;

    for (let i = 0; i < 300 && session.present.phase === 'running'; i++) {
      now += 100 + ((i * 137) % 900);
      session = sessionReducer(session, { type: kinds[i % 3] as 'CORRECT', now });
      expect(session.present.remainingMs.A).toBeGreaterThanOrEqual(0);
      expect(session.present.remainingMs.B).toBeGreaterThanOrEqual(0);
    }

    expect(session.present.phase).toBe('finished');
    expect(session.present.outcome).not.toBeNull();
  });

  it('reports every prompt it consumed so a later duel can skip them', () => {
    const session = play(
      { type: 'START', now: T0 },
      { type: 'CORRECT', now: T0 + 1_000 },
      { type: 'PASS', now: T0 + 2_000 },
      { type: 'CORRECT', now: T0 + 3_000 },
    );
    expect(consumedPromptIds(session.present)).toEqual(['p1', 'p2', 'p3']);
  });
});
