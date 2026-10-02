import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { createSession, sessionReducer, type SessionEvent } from '../../engine/duel/session';
import { displayRemainingMs, currentPromptId, isQueueExhausted } from '../../engine/duel/selectors';
import { refillQueue } from '../../engine/pickCategory';
import { mulberry32 } from '../../engine/rng';
import type { DuelSetup, PauseReason, PlayerSlot } from '../../engine/duel/types';

/** Milliseconds of display resolution — one tenth, matching what the clock renders. */
const DISPLAY_STEP_MS = 100;

/** Omit distributed over the union, so each variant keeps its own extra fields. */
type Unstamped<T> = T extends unknown ? Omit<T, 'now'> : never;

export interface DuelController {
  state: ReturnType<typeof createSession>['present'];
  canUndo: boolean;
  correct: () => void;
  pass: () => void;
  start: () => void;
  pause: (reason?: PauseReason) => void;
  resume: () => void;
  undo: () => void;
  /** Clock values interpolated to the current frame, for smooth rendering. */
  displayMs: Record<PlayerSlot, number>;
}

export function useDuelSession(setup: DuelSetup, seed: number): DuelController {
  const [session, dispatch] = useReducer(sessionReducer, setup, createSession);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Stamping the timestamp here means no call site can forget it or reach for Date.now.
  const send = useCallback((event: Unstamped<SessionEvent>) => {
    dispatch({ ...event, now: performance.now() } as SessionEvent);
  }, []);

  const { phase } = session.present;

  useEffect(() => {
    if (phase !== 'running') return;

    let frame = 0;
    let lastStep = -1;

    const tick = () => {
      const now = performance.now();
      const state = sessionRef.current.present;
      const remaining = displayRemainingMs(state, now)[state.active];
      const step = Math.ceil(remaining / DISPLAY_STEP_MS);

      // Dispatching only when the rendered tenth changes keeps this at ~10 renders
      // per second instead of 60, while still guaranteeing the zero crossing lands.
      if (step !== lastStep) {
        lastStep = step;
        dispatch({ type: 'TICK', now });
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // Reshuffling needs randomness, which cannot live inside a pure reducer.
  useEffect(() => {
    const state = session.present;
    if (state.phase === 'finished' || !isQueueExhausted(state)) return;

    const previousId = state.setup.queue[state.queueIndex - 1] ?? null;
    const rng = mulberry32((seed + state.recycles * 7919) >>> 0);
    const ids = refillQueue(state.setup.prompts, previousId, rng);
    if (ids.length > 0) send({ type: 'REFILL_QUEUE', ids });
  }, [session.present, seed, send]);

  const displayMs = displayRemainingMs(session.present, performance.now());

  return useMemo<DuelController>(
    () => ({
      state: session.present,
      canUndo: session.past.length > 0,
      correct: () => send({ type: 'CORRECT' }),
      pass: () => send({ type: 'PASS' }),
      start: () => send({ type: 'START' }),
      pause: (reason: PauseReason = 'host') => send({ type: 'PAUSE', reason }),
      resume: () => send({ type: 'RESUME' }),
      undo: () => send({ type: 'UNDO' }),
      displayMs,
    }),
    // displayMs is recomputed each render on purpose; the memo exists to keep the
    // callback identities stable for the components below.
    [session, send, displayMs],
  );
}

export { currentPromptId };
