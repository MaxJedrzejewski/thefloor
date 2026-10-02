import { duelReducer, createDuelState } from './duelReducer';
import { advanceTo } from './settle';
import type { DuelEvent, DuelSetup, DuelState } from './types';

export const UNDO_DEPTH = 20;

/**
 * Undo lives one layer above the duel reducer so DuelState itself stays flat and
 * serialisable rather than containing its own history.
 */
export interface DuelSession {
  present: DuelState;
  past: DuelState[];
}

export type SessionEvent = DuelEvent | { type: 'UNDO'; now: number };

/** Only judge presses are undoable — snapshotting ticks would rewind frame by frame. */
const UNDOABLE = new Set(['CORRECT', 'PASS']);

export function createSession(setup: DuelSetup): DuelSession {
  return { present: createDuelState(setup), past: [] };
}

export function sessionReducer(session: DuelSession, event: SessionEvent): DuelSession {
  if (event.type === 'UNDO') {
    const restored = session.past[session.past.length - 1];
    if (!restored) return session;

    // Undo always lands paused. After a mispress the host is mid-discussion with
    // a player, and those seconds must not be charged to either clock.
    return {
      present: { ...restored, phase: 'paused', clockStartedAt: null, pauseReason: 'undo' },
      past: session.past.slice(0, -1),
    };
  }

  const present = duelReducer(session.present, event);
  if (present === session.present) return session;

  if (!UNDOABLE.has(event.type)) return { ...session, present };

  // Snapshot the state as it stood at the instant the key was pressed, so undo
  // restores the clock to that moment rather than to the previous frame.
  const snapshot = advanceTo(session.present, event.now);
  const past = [...session.past, snapshot].slice(-UNDO_DEPTH);
  return { present, past };
}
