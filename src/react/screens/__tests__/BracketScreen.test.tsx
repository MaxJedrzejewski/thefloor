import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BracketScreen } from '../BracketScreen';
import { createTournament, tournamentReducer } from '../../../tournament/tournamentReducer';
import { readyMatches } from '../../../engine/bracket/selectors';
import { loadCategories } from '../../../content/categoryStore';
import { BUNDLED_CATEGORIES } from '../../../content/bundled';
import type { Tournament } from '../../../tournament/types';

function makeTournament(playerCount: number): Tournament {
  return createTournament({
    name: 'Friday Night',
    seed: 7,
    enabledCategoryIds: BUNDLED_CATEGORIES.map((c) => c.id),
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      seed: i + 1,
    })),
  });
}

function renderBracket(playerCount: number, tournament?: Tournament) {
  const onPickCategory = vi.fn();
  const onNewTournament = vi.fn();
  render(
    <BracketScreen
      tournament={tournament ?? makeTournament(playerCount)}
      onPickCategory={onPickCategory}
      onAssignWildcard={vi.fn()}
      onNewTournament={onNewTournament}
    />,
  );
  return { onPickCategory, onNewTournament, user: userEvent.setup() };
}

describe('BracketScreen', () => {
  it('shows a round for every stage of an 8-player bracket', () => {
    renderBracket(8);
    expect(screen.getByRole('heading', { name: 'Quarter-final' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Semi-final' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Final' })).toBeInTheDocument();
  });

  it('plays a full first round and shows the open wildcard slot for 6 players', () => {
    renderBracket(6);
    expect(screen.queryByTestId('bye-badge')).not.toBeInTheDocument();
    expect(screen.getByText('Wildcard (host picks)')).toBeInTheDocument();
    expect(screen.getByTestId('wildcard-panel')).toHaveTextContent(/1 slot is still open/i);
  });

  it('offers all three first-round duels', () => {
    renderBracket(6);
    expect(screen.getAllByTestId('ready-match-button')).toHaveLength(3);
  });

  it('shows no wildcard panel when the field needs none', () => {
    renderBracket(8);
    expect(screen.queryByTestId('wildcard-panel')).not.toBeInTheDocument();
  });

  it('reports the chosen wildcard to the host callback', async () => {
    let tournament = makeTournament(6);
    for (const id of ['r1m0', 'r1m1', 'r1m2']) {
      const m = tournament.bracket.matches[id]!;
      tournament = {
        ...tournament,
        bracket: {
          ...tournament.bracket,
          matches: { ...tournament.bracket.matches, [id]: { ...m, status: 'done', winnerId: m.slots[0].kind === 'player' ? m.slots[0].playerId : null, loserId: m.slots[1].kind === 'player' ? m.slots[1].playerId : null } },
        },
      };
    }
    const onAssignWildcard = vi.fn();
    const user = userEvent.setup();
    render(
      <BracketScreen tournament={tournament} onPickCategory={vi.fn()} onAssignWildcard={onAssignWildcard} onNewTournament={vi.fn()} />,
    );
    await user.selectOptions(screen.getByRole('combobox'), 'Player 5');
    expect(onAssignWildcard).toHaveBeenCalledWith('r2m0', 1, 'p5');
  });

  it('lets the host pick which of several ready duels plays next', async () => {
    const tournament = makeTournament(4);
    const [first, second] = readyMatches(tournament.bracket);
    const { onPickCategory, user } = renderBracket(4, tournament);

    const buttons = screen.getAllByTestId('ready-match-button');
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);

    expect(onPickCategory).toHaveBeenCalledWith(second!.id);
    expect(onPickCategory).not.toHaveBeenCalledWith(first!.id);
  });

  it('opens the category picker on click when only one duel is ready', async () => {
    const tournament = makeTournament(3);
    const { onPickCategory, user } = renderBracket(3, tournament);
    await user.click(screen.getByRole('button', { name: /pick category/i }));
    expect(onPickCategory).toHaveBeenCalledWith(readyMatches(tournament.bracket)[0]!.id);
  });

  it('opens the category picker on ENTER when only one duel is ready', async () => {
    const { onPickCategory, user } = renderBracket(3);
    await user.keyboard('{Enter}');
    expect(onPickCategory).toHaveBeenCalledTimes(1);
  });

  it('tells the host they pick the category', () => {
    renderBracket(3);
    expect(screen.getByText(/you pick the category/i)).toBeInTheDocument();
  });

  it('counts every match in the bracket, wildcard rounds included', () => {
    renderBracket(6);
    expect(screen.getByText(/0 of 6 matches settled/i)).toBeInTheDocument();
  });

  it('shows a completed duel result on the bracket', () => {
    const initial = makeTournament(4);
    let tournament = tournamentReducer(initial, {
      type: 'OPEN_CATEGORY_PICK',
      matchId: readyMatches(initial.bracket)[0]!.id,
    });
    tournament = tournamentReducer(tournament, {
      type: 'DRAW_NEXT_DUEL',
      categoryId: BUNDLED_CATEGORIES[0]!.id,
      categories: loadCategories(),
    });
    tournament = tournamentReducer(tournament, { type: 'BEGIN_DUEL' });
    const setup = tournament.active!.setup;
    tournament = tournamentReducer(tournament, {
      type: 'FINISH_DUEL',
      summary: {
        duelId: setup.duelId,
        categoryId: setup.categoryId,
        categoryName: setup.categoryName,
        winnerId: setup.players.A.playerId,
        loserId: setup.players.B.playerId,
        finalRemainingMs: { A: 8_400, B: 0 },
        players: setup.players,
        stats: { A: { correct: 5, passes: 0 }, B: { correct: 3, passes: 2 } },
        usedPromptIds: setup.queue.slice(0, 9),
      },
    });
    tournament = tournamentReducer(tournament, { type: 'CONTINUE' });

    renderBracket(4, tournament);
    expect(screen.getByText(/8\.4s vs 0\.0s/)).toBeInTheDocument();
  });
});
