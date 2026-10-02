import { BracketTree } from '../components/BracketTree';
import { useHotkeys } from '../hooks/useHotkeys';
import { champion } from '../../engine/bracket/selectors';
import type { Tournament } from '../../tournament/types';

interface Props {
  tournament: Tournament;
  onNewTournament: () => void;
}

export function ChampionScreen({ tournament, onNewTournament }: Props) {
  useHotkeys({ enter: onNewTournament });
  const winnerId = champion(tournament.bracket);
  const winner = winnerId ? tournament.bracket.players[winnerId] : null;

  return (
    <div className="screen champion-screen">
      <p className="muted">Champion</p>
      <h1 className="champion-name">{winner?.name ?? 'Nobody'}</h1>
      <p className="muted">
        {tournament.duelsPlayed} {tournament.duelsPlayed === 1 ? 'duel' : 'duels'} ·{' '}
        {tournament.usedCategoryIds.length}{' '}
        {tournament.usedCategoryIds.length === 1 ? 'category' : 'categories'} played
      </p>

      <BracketTree bracket={tournament.bracket} readyMatchIds={[]} />

      <button type="button" className="button primary large" onClick={onNewTournament}>
        New tournament <kbd>ENTER</kbd>
      </button>
    </div>
  );
}
