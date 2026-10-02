import type { DuelState } from './types';
import { opponent } from './selectors';

/**
 * The time primitive the whole duel engine is built on.
 *
 * The reducer never reads a clock. Instead every event carries the timestamp it
 * happened at, and elapsed time is always the difference between that timestamp
 * and the last one the clock was settled to. A slow or dropped animation frame
 * therefore deducts exactly the time that really passed, so a clock can never
 * silently overshoot zero.
 */

/** Deduct elapsed wall time from the active clock and re-anchor. */
export function settle(state: DuelState, now: number): DuelState {
  if (state.phase !== 'running' || state.clockStartedAt === null) return state;

  // Clamping guards a non-monotonic timestamp, which must never credit free time.
  const elapsed = Math.max(0, now - state.clockStartedAt);
  const remaining = Math.max(0, state.remainingMs[state.active] - elapsed);

  return {
    ...state,
    remainingMs: { ...state.remainingMs, [state.active]: remaining },
    clockStartedAt: now,
  };
}

/** Finish the duel if the active clock has run out. Idempotent. */
export function checkTimeout(state: DuelState, _now: number): DuelState {
  if (state.phase === 'finished') return state;
  if (state.remainingMs[state.active] > 0) return state;

  const loser = state.active;
  const winner = opponent(loser);

  return {
    ...state,
    phase: 'finished',
    clockStartedAt: null,
    pauseReason: null,
    outcome: {
      winner,
      loser,
      reason: 'timeout',
      finalRemainingMs: { ...state.remainingMs },
    },
  };
}

/** Settle then check for a timeout — the prelude to every event handler. */
export function advanceTo(state: DuelState, now: number): DuelState {
  return checkTimeout(settle(state, now), now);
}
