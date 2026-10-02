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

  it('marks the two byes in a 6-player bracket', () => {
    renderBracket(6);
    expect(screen.getAllByTestId('bye-badge')).toHaveLength(2);
  });

  it('offers a choice between both ready duels, never a bye', () => {
    renderBracket(6);

    // Seeds 1 and 2 hold the byes, so they cannot be in either ready duel.
    const choices = screen.getByText(/pairs are ready/i).closest('section')!;
    expect(choices).not.toHaveTextContent('Player 1');
    expect(choices).not.toHaveTextContent('Player 2');
    expect(screen.getAllByTestId('ready-match-button')).toHaveLength(2);
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

  it('counts settled matches, byes included', () => {
    renderBracket(6);
    expect(screen.getByText(/2 of 7 matches settled/i)).toBeInTheDocument();
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
