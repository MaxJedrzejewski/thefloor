import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DuelScreen } from '../DuelScreen';
import { DEFAULT_RULES } from '../../../engine/duel/rules';
import type { DuelSetup, DuelSummary, Prompt } from '../../../engine/duel/types';
import * as feedbackSounds from '../../audio/feedbackSounds';

vi.mock('../../audio/feedbackSounds', () => ({
  playCorrectSound: vi.fn(),
  playPassSound: vi.fn(),
}));

/**
 * The clock is driven by performance.now plus requestAnimationFrame, so both are
 * replaced with a manually advanced counter and a manual frame queue. No test in
 * this file asserts on elapsed milliseconds — that is the engine's job.
 */
let clock = 0;
let frames: FrameRequestCallback[] = [];

function advance(ms: number) {
  clock += ms;
  act(() => {
    const due = frames;
    frames = [];
    for (const frame of due) frame(clock);
  });
}

/** Let the rAF loop notice the current time without moving the clock. */
function flushFrames() {
  advance(0);
}

function makePrompts(count: number): Prompt[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    kind: 'text' as const,
    body: `Question ${i + 1}?`,
    answer: `Answer ${i + 1}`,
  }));
}

function makeSetup(): DuelSetup {
  const prompts = makePrompts(20);
  return {
    duelId: 'd1',
    matchId: 'm1',
    rules: DEFAULT_RULES,
    categoryId: 'c1',
    categoryName: 'World Capitals',
    players: { A: { playerId: 'pa', name: 'Maya' }, B: { playerId: 'pb', name: 'Jon' } },
    firstToAnswer: 'A',
    queue: prompts.map((p) => p.id),
    prompts: Object.fromEntries(prompts.map((p) => [p.id, p])),
  };
}

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

/** Judgements land after the 2s reveal beat; tests fast-forward through it. */
function passRevealBeat() {
  act(() => {
    vi.advanceTimersByTime(2_000);
  });
}

/** Every scenario except the countdown tests themselves wants the duel already running. */
function passCountdown() {
  for (let i = 0; i < 5; i++) {
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
  }
  flushFrames();
}

function renderDuel() {
  const onFinished = vi.fn();
  const onAbandon = vi.fn();
  render(
    <DuelScreen
      setup={makeSetup()}
      seed={1}
      roundLabel="Semi-final"
      onFinished={onFinished}
      onAbandon={onAbandon}
    />,
  );
  flushFrames();
  passCountdown();
  return { onFinished, onAbandon };
}

function activeSide(): 'left' | 'right' {
  return screen.getByTestId('clock-left').dataset.active === 'true' ? 'left' : 'right';
}

beforeEach(() => {
  clock = 1_000;
  frames = [];
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DuelScreen', () => {
  it('starts the first player automatically', () => {
    renderDuel();
    expect(activeSide()).toBe('left');
    expect(screen.getByText('Question 1?')).toBeInTheDocument();
  });

  it('marks the answer correct on SPACE and swaps the running clock', () => {
    renderDuel();
    advance(4_000);
    press(' ');
    passRevealBeat();
    flushFrames();

    expect(activeSide()).toBe('right');
    expect(screen.getByText('Question 2?')).toBeInTheDocument();
  });

  it('advances the clue on P but keeps the same clock running', () => {
    renderDuel();
    advance(2_000);
    press('p');
    passRevealBeat();
    flushFrames();

    expect(activeSide()).toBe('left');
    expect(screen.getByText('Question 2?')).toBeInTheDocument();
  });

  it('freezes the clock, shows the answer, and plays a tone for 2s on a correct call', () => {
    renderDuel();
    advance(4_000);
    press(' ');

    expect(screen.getByTestId('reveal-overlay')).toHaveClass('is-correct');
    expect(screen.getByTestId('reveal-overlay')).toHaveTextContent('Answer 1');
    expect(feedbackSounds.playCorrectSound).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('clock-left').dataset.active).toBe('false');
    expect(screen.getByTestId('clock-right').dataset.active).toBe('false');
    expect(screen.getByText('Question 1?')).toBeInTheDocument();

    passRevealBeat();
    flushFrames();

    expect(screen.queryByTestId('reveal-overlay')).not.toBeInTheDocument();
    expect(activeSide()).toBe('right');
    expect(screen.getByText('Question 2?')).toBeInTheDocument();
  });

  it('shows a red reveal and plays a buzz for 2s on a pass', () => {
    renderDuel();
    advance(2_000);
    press('p');

    expect(screen.getByTestId('reveal-overlay')).toHaveClass('is-pass');
    expect(feedbackSounds.playPassSound).toHaveBeenCalledTimes(1);

    passRevealBeat();
    flushFrames();

    expect(screen.queryByTestId('reveal-overlay')).not.toBeInTheDocument();
  });

  it('ignores judge keys during the reveal beat', () => {
    renderDuel();
    advance(4_000);
    press(' ');

    press(' ');
    press('p');

    expect(feedbackSounds.playCorrectSound).toHaveBeenCalledTimes(1);
    expect(feedbackSounds.playPassSound).not.toHaveBeenCalled();

    passRevealBeat();
    flushFrames();

    expect(activeSide()).toBe('right');
    expect(screen.getByText('Question 2?')).toBeInTheDocument();
  });

  it('undoes a mis-pressed judgement and leaves the duel paused', () => {
    renderDuel();
    advance(3_000);
    press(' ');
    passRevealBeat();
    flushFrames();
    expect(activeSide()).toBe('right');

    press('z');
    flushFrames();

    expect(screen.getByTestId('paused-overlay')).toBeInTheDocument();
    expect(screen.getByText('Question 1?')).toBeInTheDocument();
  });

  it('shows the judge the answer without making it the dominant element', () => {
    renderDuel();
    expect(screen.getByTestId('judge-answer')).toHaveTextContent('Answer 1');
    expect(screen.getByTestId('prompt-stage')).toHaveTextContent('Question 1?');
  });

  it('hides and restores the answer on A', () => {
    renderDuel();
    press('a');
    expect(screen.getByTestId('judge-answer')).not.toHaveTextContent('Answer 1');

    press('a');
    expect(screen.getByTestId('judge-answer')).toHaveTextContent('Answer 1');
  });

  it('pauses and resumes on ESC', () => {
    renderDuel();
    press('Escape');
    flushFrames();
    expect(screen.getByTestId('paused-overlay')).toBeInTheDocument();

    press('Escape');
    flushFrames();
    expect(screen.queryByTestId('paused-overlay')).not.toBeInTheDocument();
  });

  it('ignores judge keys while paused', () => {
    renderDuel();
    press('Escape');
    flushFrames();

    press(' ');
    press('p');
    flushFrames();
    expect(screen.getByTestId('paused-overlay')).toBeInTheDocument();

    // Resuming shows the presses changed nothing: same clue, same player.
    press('Escape');
    flushFrames();
    expect(activeSide()).toBe('left');
    expect(screen.getByText('Question 1?')).toBeInTheDocument();
  });

  it('reports the result when a clock runs out', () => {
    const { onFinished } = renderDuel();
    advance(45_000);

    expect(onFinished).toHaveBeenCalledTimes(1);
    const summary = onFinished.mock.calls[0]![0] as DuelSummary;
    expect(summary.winnerId).toBe('pb');
    expect(summary.loserId).toBe('pa');
    expect(summary.finalRemainingMs.A).toBe(0);
  });

  it('reports a result ended by a pass penalty', () => {
    const { onFinished } = renderDuel();
    advance(43_000);
    press('p');
    passRevealBeat();
    flushFrames();

    expect(onFinished).toHaveBeenCalledTimes(1);
    const summary = onFinished.mock.calls[0]![0] as DuelSummary;
    expect(summary.loserId).toBe('pa');
    expect(summary.finalRemainingMs.A).toBe(0);
  });

  it('stops responding to judge keys once a winner is decided', () => {
    const { onFinished } = renderDuel();
    advance(45_000);
    onFinished.mockClear();

    press(' ');
    press('p');
    flushFrames();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it('reports which prompts were used so the tournament can skip them', () => {
    const { onFinished } = renderDuel();
    advance(1_000); // A answers p1
    press(' ');
    passRevealBeat();
    advance(1_000); // B answers p2
    press(' ');
    passRevealBeat();
    advance(44_000); // A, back on the clock with 44s, never answers p3

    const summary = onFinished.mock.calls[0]![0] as DuelSummary;
    expect(summary.usedPromptIds).toEqual(['p1', 'p2']);
  });

  it('pauses and resumes by clicking the pause button', () => {
    renderDuel();
    expect(screen.getByText('Question 1?')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: /^pause$/i }).click();
    });
    flushFrames();
    expect(screen.getByTestId('paused-overlay')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: /^resume$/i }).click();
    });
    flushFrames();
    expect(screen.queryByTestId('paused-overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Question 1?')).toBeInTheDocument();
  });

  it('lets the host abandon the duel', () => {
    const { onAbandon } = renderDuel();
    screen.getByRole('button', { name: /abandon duel/i }).click();
    expect(onAbandon).toHaveBeenCalled();
  });
});

describe('DuelScreen countdown', () => {
  function renderWithoutCountdown() {
    const onFinished = vi.fn();
    const onAbandon = vi.fn();
    render(
      <DuelScreen
        setup={makeSetup()}
        seed={1}
        roundLabel="Semi-final"
        onFinished={onFinished}
        onAbandon={onAbandon}
      />,
    );
    flushFrames();
    return { onFinished, onAbandon };
  }

  it('shows a 5 second countdown before the clocks start', () => {
    renderWithoutCountdown();

    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('5');
    expect(screen.getByTestId('clock-left').dataset.active).toBe('false');
    expect(screen.getByTestId('clock-right').dataset.active).toBe('false');
  });

  it('counts down each second', () => {
    renderWithoutCountdown();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('4');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByTestId('countdown-overlay')).toHaveTextContent('3');
  });

  it('starts the clock once the countdown finishes', () => {
    renderWithoutCountdown();

    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
    }
    flushFrames();

    expect(screen.queryByTestId('countdown-overlay')).not.toBeInTheDocument();
    expect(activeSide()).toBe('left');
    expect(screen.getByTestId('clock-left').dataset.active).toBe('true');
  });
});

describe('DuelScreen when the tab is hidden', () => {
  it('pauses so the hidden interval is charged to nobody', () => {
    renderDuel();
    advance(5_000);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    flushFrames();

    expect(screen.getByTestId('paused-overlay')).toBeInTheDocument();
    const before = screen.getByTestId('clock-digits-left').textContent;

    // Time passes with the tab in the background, then it comes back.
    clock += 300_000;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    flushFrames();

    expect(screen.getByTestId('clock-digits-left')).toHaveTextContent(before!);
  });
});
