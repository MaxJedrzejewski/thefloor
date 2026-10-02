import type { DuelState, PlayerSlot, Prompt } from './types';

export function opponent(slot: PlayerSlot): PlayerSlot {
  return slot === 'A' ? 'B' : 'A';
}

export const SLOTS: readonly PlayerSlot[] = ['A', 'B'];

export function currentPromptId(state: DuelState): string | null {
  return state.setup.queue[state.queueIndex] ?? null;
}

export function currentPrompt(state: DuelState): Prompt | null {
  const id = currentPromptId(state);
  return id === null ? null : (state.setup.prompts[id] ?? null);
}

export function isOver(state: DuelState): boolean {
  return state.phase === 'finished';
}

export function isQueueExhausted(state: DuelState): boolean {
  return state.queueIndex >= state.setup.queue.length;
}

/**
 * Clock values for rendering between ticks. The reducer remains authoritative —
 * this exists only so the display can stay smooth without dispatching every frame.
 */
export function displayRemainingMs(state: DuelState, now: number): Record<PlayerSlot, number> {
  if (state.phase !== 'running' || state.clockStartedAt === null) {
    return state.remainingMs;
  }
  const elapsed = Math.max(0, now - state.clockStartedAt);
  return {
    ...state.remainingMs,
    [state.active]: Math.max(0, state.remainingMs[state.active] - elapsed),
  };
}

/** Prompt ids consumed so far, so a tournament can avoid repeating them. */
export function consumedPromptIds(state: DuelState): string[] {
  return state.setup.queue.slice(0, state.queueIndex);
}
