import { matchPlayers, matchesInRound, roundLabel } from '../../engine/bracket/selectors';
import type { Bracket, Match } from '../../engine/bracket/types';

interface Props {
  bracket: Bracket;
  readyMatchIds: string[];
}

function MatchCard({ bracket, match, isNext }: { bracket: Bracket; match: Match; isNext: boolean }) {
  const [a, b] = matchPlayers(bracket, match);
  const isBye = match.slots.some((s) => s.kind === 'bye');

  const row = (player: typeof a, slotIndex: 0 | 1) => {
    const slot = match.slots[slotIndex];
    const label =
      player?.name ?? (slot.kind === 'bye' ? 'Bye' : slot.kind === 'wildcard' ? 'Wildcard (host picks)' : 'TBD');
    const won = !!player && match.winnerId === player.id;
    const lost = !!player && match.status === 'done' && match.winnerId !== player.id;

    return (
      <p className={`bracket-slot ${won ? 'won' : ''} ${lost ? 'lost' : ''}`}>
        {player && <span className="seed-badge small">{player.seed}</span>}
        <span className="bracket-name">{label}</span>
      </p>
    );
  };

  return (
    <li className={`match-card ${isNext ? 'is-next' : ''} ${isBye ? 'is-bye' : ''}`} data-testid="match-card">
      {row(a, 0)}
      {row(b, 1)}
      {isBye && <p className="match-note" data-testid="bye-badge">Bye — advances automatically</p>}
      {isNext && <p className="match-note next">Up next</p>}
      {match.summary && (
        <p className="match-note">
          {match.summary.categoryName} · {(match.summary.finalRemainingMs.A / 1000).toFixed(1)}s vs{' '}
          {(match.summary.finalRemainingMs.B / 1000).toFixed(1)}s
        </p>
      )}
    </li>
  );
}

export function BracketTree({ bracket, readyMatchIds }: Props) {
  const rounds = Array.from({ length: bracket.rounds }, (_, i) => i + 1);

  return (
    <div className="bracket-tree">
      {rounds.map((round) => (
        <section key={round} className="bracket-round">
          <h3>{roundLabel(bracket.size, round)}</h3>
          <ul>
            {matchesInRound(bracket, round).map((match) => (
              <MatchCard
                key={match.id}
                bracket={bracket}
                match={match}
                isNext={readyMatchIds.includes(match.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
