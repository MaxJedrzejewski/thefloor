import type { DuelEvent, DuelSetup, DuelState } from './types';
import { advanceTo, checkTimeout, settle } from './settle';
import { currentPromptId, opponent } from './selectors';

export function createDuelState(setup: DuelSetup): DuelState {
  return {
    setup,
    phase: 'ready',
    active: setup.firstToAnswer,
    remainingMs: { A: setup.rules.startingMs, B: setup.rules.startingMs },
    clockStartedAt: null,
    pauseReason: null,
    queueIndex: 0,
    recycles: 0,
    stats: { A: { correct: 0, passes: 0 }, B: { correct: 0, passes: 0 } },
    outcome: null,
    timeline: [],
  };
}

/**
 * The duel rules, as a pure reducer.
 *
 * Every handler settles the clock before applying its effect, which is what makes
 * the "duel ends the instant a clock hits zero" rule exact: a judgement that lands
 * after the buzzer cannot rescue the player who ran out.
 *
 * Events that are illegal in the current phase return the same object reference,
 * so callers and tests can detect a no-op with Object.is.
 */
export function duelReducer(state: DuelState, event: DuelEvent): DuelState {
  switch (event.type) {
    case 'START': {
      if (state.phase !== 'ready') return state;
      return {
        ...state,
        phase: 'running',
        active: state.setup.firstToAnswer,
        clockStartedAt: event.now,
      };
    }

    case 'TICK':
      return advanceTo(state, event.now);

    case 'CORRECT': {
      if (state.phase !== 'running') return state;
      const settled = advanceTo(state, event.now);
      if (settled.phase !== 'running') return settled;

      const promptId = currentPromptId(settled);
      const slot = settled.active;

      return {
        ...settled,
        active: opponent(slot),
        queueIndex: settled.queueIndex + 1,
        // Re-anchoring to the same instant means the opponent's clock starts
        // exactly when this one stopped, with no dead time in between.
        clockStartedAt: event.now,
        stats: {
          ...settled.stats,
          [slot]: { ...settled.stats[slot], correct: settled.stats[slot].correct + 1 },
        },
        timeline: promptId
          ? [...settled.timeline, { kind: 'correct', slot, promptId, at: event.now }]
          : settled.timeline,
      };
    }

    case 'PASS': {
      if (state.phase !== 'running') return state;
      const settled = advanceTo(state, event.now);
      if (settled.phase !== 'running') return settled;

      const promptId = currentPromptId(settled);
      const slot = settled.active;
      const penalised = Math.max(0, settled.remainingMs[slot] - settled.setup.rules.passPenaltyMs);

      const next: DuelState = {
        ...settled,
        remainingMs: { ...settled.remainingMs, [slot]: penalised },
        queueIndex: settled.queueIndex + 1,
        clockStartedAt: event.now,
        stats: {
          ...settled.stats,
          [slot]: { ...settled.stats[slot], passes: settled.stats[slot].passes + 1 },
        },
        timeline: promptId
          ? [...settled.timeline, { kind: 'pass', slot, promptId, at: event.now }]
          : settled.timeline,
      };

      // A penalty that eats the last of the clock ends the duel immediately.
      return checkTimeout(next, event.now);
    }

    case 'PAUSE': {
      if (state.phase !== 'running') return state;
      const settled = advanceTo(state, event.now);
      if (settled.phase !== 'running') return settled;
      return { ...settled, phase: 'paused', clockStartedAt: null, pauseReason: event.reason };
    }

    case 'RESUME': {
      if (state.phase !== 'paused') return state;
      return { ...state, phase: 'running', clockStartedAt: event.now, pauseReason: null };
    }

    case 'REFILL_QUEUE': {
      if (state.phase === 'finished' || event.ids.length === 0) return state;
      const settled = settle(state, event.now);
      return {
        ...settled,
        setup: { ...settled.setup, queue: [...settled.setup.queue, ...event.ids] },
        recycles: settled.recycles + 1,
      };
    }
  }
}
