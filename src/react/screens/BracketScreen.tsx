import { BracketTree } from '../components/BracketTree';
import { useHotkeys } from '../hooks/useHotkeys';
import { matchPlayers, readyMatches, roundLabel, completedMatchCount } from '../../engine/bracket/selectors';
import type { Tournament } from '../../tournament/types';

interface Props {
  tournament: Tournament;
  onPickCategory: (matchId: string) => void;
  onNewTournament: () => void;
}

export function BracketScreen({ tournament, onPickCategory, onNewTournament }: Props) {
  const ready = readyMatches(tournament.bracket);
  const solePick = ready.length === 1 ? ready[0]! : null;
  const [a, b] = solePick ? matchPlayers(tournament.bracket, solePick) : [null, null];

  useHotkeys({ enter: solePick ? () => onPickCategory(solePick.id) : undefined });

  return (
    <div className="screen bracket-screen">
      <header className="screen-header row">
        <div>
          <h1>Bracket</h1>
          <p className="muted">
            {completedMatchCount(tournament.bracket)} of {tournament.bracket.order.length} matches settled
          </p>
        </div>
        <button type="button" className="button ghost small" onClick={onNewTournament}>
          New tournament
        </button>
      </header>

      {solePick && a && b && (
        <section className="panel next-up">
          <p className="muted">{roundLabel(tournament.bracket.size, solePick.round)}</p>
          <h2>
            {a.name} <span className="versus">vs</span> {b.name}
          </h2>
          <p className="hint">You pick the category before the duel starts.</p>
          <button type="button" className="button primary large" onClick={() => onPickCategory(solePick.id)}>
            Pick category <kbd>ENTER</kbd>
          </button>
        </section>
      )}

      {ready.length > 1 && (
        <section className="panel next-up next-up-choice">
          <p className="muted">{ready.length} pairs are ready — pick which one plays next</p>
          <ul className="ready-match-list">
            {ready.map((match) => {
              const [x, y] = matchPlayers(tournament.bracket, match);
              return (
                <li key={match.id}>
                  <button
                    type="button"
                    className="button primary ready-match-button"
                    data-testid="ready-match-button"
                    onClick={() => onPickCategory(match.id)}
                  >
                    <span className="muted">{roundLabel(tournament.bracket.size, match.round)}</span>
                    <span>
                      {x?.name} <span className="versus">vs</span> {y?.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <BracketTree bracket={tournament.bracket} readyMatchIds={ready.map((m) => m.id)} />
    </div>
  );
}
