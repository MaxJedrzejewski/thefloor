import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

/**
 * Whole-app coverage: a host sits down, enters players and plays a tournament
 * out to a champion using only the keyboard. The clock is driven manually so a
 * duel can be run out in milliseconds of real time.
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

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  clock = 1_000;
  frames = [];
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
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

async function startTournament(user: ReturnType<typeof userEvent.setup>, playerCount: number) {
  for (let i = 4; i < playerCount; i++) {
    await user.click(screen.getByRole('button', { name: /add player/i }));
    await user.type(screen.getByLabelText(`Player ${i + 1} name`), `Extra ${i + 1}`);
  }
  await user.click(screen.getByRole('button', { name: /^build bracket$/i }));
}

/** From the bracket: open the picker for a ready duel and choose the first category on offer. */
function pickFirstCategory() {
  const readyButtons = screen.queryAllByTestId('ready-match-button');
  if (readyButtons.length > 0) {
    act(() => readyButtons[0]!.click());
  } else {
    press('Enter'); // open the category picker for the lone ready duel
  }
  act(() => {
    screen.getAllByRole('button').find((b) => !/back to bracket/i.test(b.textContent ?? ''))!.click();
  });
}

/** Play the pending duel through, letting whoever is on the clock run out. */
function playDuelToTimeout() {
  pickFirstCategory();
  press('Enter'); // start the clock from the intro screen
  for (let i = 0; i < 5; i++) {
    act(() => vi.advanceTimersByTime(1_000)); // the get-ready countdown
  }
  advance(46_000);
  press('Enter'); // continue from the result screen
}

describe('App', () => {
  it('opens on setup with the bundled categories enabled', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'The Floor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Player 1 name')).toHaveValue('Maya');
    expect(screen.getByRole('checkbox', { name: /World Capitals/ })).toBeChecked();
  });

  it('will not build a bracket with no categories in play', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    for (const box of screen.getAllByRole('checkbox')) {
      await user.click(box);
    }
    expect(screen.getByRole('button', { name: /^build bracket$/i })).toBeDisabled();
  });

  it('will not build a bracket from a single player', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await user.clear(screen.getByLabelText('Player 2 name'));
    await user.clear(screen.getByLabelText('Player 3 name'));
    await user.clear(screen.getByLabelText('Player 4 name'));
    expect(screen.getByRole('button', { name: /^build bracket$/i })).toBeDisabled();
  });

  it('plays a full four-player tournament through to a champion', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);

    expect(screen.getByRole('heading', { name: 'Bracket' })).toBeInTheDocument();

    for (let i = 0; i < 3; i++) {
      playDuelToTimeout();
    }

    expect(screen.getByText('Champion')).toBeInTheDocument();
    expect(screen.getByText(/3 duels/)).toBeInTheDocument();
  });

  it('shows the picked category on the intro screen before the clock starts', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);

    pickFirstCategory();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText(/takes the first clue/)).toBeInTheDocument();
  });

  it('lets the host pick the category for a match', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);

    await user.click(screen.getAllByTestId('ready-match-button')[0]!);
    await user.click(screen.getByRole('button', { name: 'World Capitals' }));
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('World Capitals')).toBeInTheDocument();
  });

  it('hides a category from the picker once it has been played', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);

    await user.click(screen.getAllByTestId('ready-match-button')[0]!);
    await user.click(screen.getByRole('button', { name: 'World Capitals' }));
    press('Enter');
    for (let i = 0; i < 5; i++) act(() => vi.advanceTimersByTime(1_000));
    advance(46_000);
    press('Enter'); // continue from the result screen

    press('Enter');
    expect(screen.queryByRole('button', { name: 'World Capitals' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zwierzęta' })).toBeInTheDocument();
  });

  it('runs a duel and names the player whose clock survived', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);

    pickFirstCategory();
    press('Enter');
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(1_000)); // the get-ready countdown
    }

    // Whoever is on the clock at the start answers once, then stalls out.
    const before = screen.getByTestId('clock-left').dataset.active === 'true' ? 'left' : 'right';
    advance(46_000);

    const survivor = before === 'left' ? 'right' : 'left';
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/advances/);
    expect(survivor).toBeTruthy();
  });

  it('abandons a duel back to the bracket without recording a result', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);

    pickFirstCategory();
    press('Enter');
    await user.click(screen.getByRole('button', { name: /abandon duel/i }));

    expect(screen.getByRole('heading', { name: 'Bracket' })).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 matches settled/)).toBeInTheDocument();
  });

  it('gives a six-player bracket two byes and still reaches a champion', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 6);

    expect(screen.getAllByTestId('bye-badge')).toHaveLength(2);

    for (let i = 0; i < 5; i++) {
      playDuelToTimeout();
    }
    expect(screen.getByText('Champion')).toBeInTheDocument();
    expect(screen.getByText(/5 duels/)).toBeInTheDocument();
  });

  it('restores a tournament in progress after a reload, back on the bracket', async () => {
    const user = userEvent.setup({ delay: null });
    const first = render(<App />);
    await startTournament(user, 4);
    playDuelToTimeout();

    first.unmount();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Bracket' })).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 matches settled/)).toBeInTheDocument();
  });

  it('does not resume a running clock after a reload mid-duel', async () => {
    const user = userEvent.setup({ delay: null });
    const first = render(<App />);
    await startTournament(user, 4);
    pickFirstCategory();
    press('Enter');
    expect(screen.getByTestId('prompt-stage')).toBeInTheDocument();

    first.unmount();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Bracket' })).toBeInTheDocument();
    expect(screen.queryByTestId('prompt-stage')).not.toBeInTheDocument();
  });

  it('lets a host add a category and use it in a tournament', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await user.click(screen.getByRole('button', { name: /edit categories/i }));
    await user.click(screen.getByRole('button', { name: /new category/i }));
    await user.type(screen.getByLabelText(/category name/i), 'House Rules');
    await user.type(screen.getByLabelText(/clue/i), 'Whose round is it?');
    await user.type(screen.getByLabelText(/answer/i), 'Yours');
    await user.click(screen.getByRole('button', { name: /save category/i }));

    expect(screen.getByRole('heading', { name: 'House Rules' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /done/i }));

    // One prompt is not enough to be playable, so it is not offered for a duel.
    expect(screen.queryByRole('checkbox', { name: /House Rules/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /World Capitals/ })).toBeInTheDocument();
  });

  it('starts a fresh tournament from the champion screen', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await startTournament(user, 4);
    for (let i = 0; i < 3; i++) playDuelToTimeout();

    await user.click(screen.getByRole('button', { name: /new tournament/i }));
    expect(screen.getByLabelText('Player 1 name')).toBeInTheDocument();
  });
});
