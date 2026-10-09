import { BracketTree } from '../components/BracketTree';
import { useHotkeys } from '../hooks/useHotkeys';
import { wildcardCandidates, wildcardSlots } from '../../engine/bracket/wildcard';
import { matchPlayers, readyMatches, roundLabel, completedMatchCount } from '../../engine/bracket/selectors';
import type { Tournament } from '../../tournament/types';

interface Props {
  tournament: Tournament;
  onPickCategory: (matchId: string) => void;
  onAssignWildcard: (matchId: string, slot: 0 | 1, playerId: string | null) => void;
  onNewTournament: () => void;
}

export function BracketScreen({ tournament, onPickCategory, onAssignWildcard, onNewTournament }: Props) {
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

      <WildcardPanel tournament={tournament} onAssign={onAssignWildcard} />

      <BracketTree bracket={tournament.bracket} readyMatchIds={ready.map((m) => m.id)} />
    </div>
  );
}

function WildcardPanel({
  tournament,
  onAssign,
}: {
  tournament: Tournament;
  onAssign: Props['onAssignWildcard'];
}) {
  const { bracket } = tournament;
  const slots = wildcardSlots(bracket);
  if (slots.length === 0) return null;

  const empty = slots.filter((s) => !s.playerId).length;

  return (
    <section className="panel wildcard-panel" data-testid="wildcard-panel">
      <h2>Wildcards</h2>
      <p className="hint">
        {empty > 0
          ? `${empty} ${empty === 1 ? 'slot is' : 'slots are'} still open. Bring back a round-one loser — the duel with an open slot cannot start until you do. A first-round slot opens once every other first-round duel is done.`
          : 'All wildcard slots are filled.'}
      </p>
      <ul className="wildcard-fields">
        {slots.map((slot) => {
          const opponent = matchPlayers(bracket, bracket.matches[slot.matchId]!)[slot.slot === 0 ? 1 : 0];
          const candidates = wildcardCandidates(bracket, slot);
          const current = slot.playerId ? bracket.players[slot.playerId] : null;
          return (
            <li key={`${slot.matchId}:${slot.slot}`}>
              <label>
                <span>
                  {slot.waiting && !slot.playerId && 'After the other first-round duels · '}
                  {roundLabel(bracket.size, bracket.matches[slot.matchId]!.round)} · vs{' '}
                  {opponent?.name ?? 'winner TBD'}
                </span>
                <select
                  value={slot.playerId ?? ''}
                  disabled={slot.locked || (slot.waiting && !slot.playerId)}
                  onChange={(e) => onAssign(slot.matchId, slot.slot, e.target.value || null)}
                >
                  <option value="">Choose a loser…</option>
                  {current && <option value={current.id}>{current.name}</option>}
                  {candidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
