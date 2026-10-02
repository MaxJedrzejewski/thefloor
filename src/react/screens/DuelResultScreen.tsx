import { useHotkeys } from '../hooks/useHotkeys';
import { formatClock } from '../format/formatClock';
import type { DuelSummary, PlayerSlot } from '../../engine/duel/types';

interface Props {
  summary: DuelSummary;
  onContinue: () => void;
}

const SLOTS: PlayerSlot[] = ['A', 'B'];

export function DuelResultScreen({ summary, onContinue }: Props) {
  useHotkeys({ enter: onContinue });
  const winnerSlot = SLOTS.find((s) => summary.players[s].playerId === summary.winnerId)!;

  return (
    <div className="screen result-screen">
      <p className="muted">{summary.categoryName}</p>
      <h1 className="result-winner">{summary.players[winnerSlot].name} advances</h1>

      <div className="result-grid">
        {SLOTS.map((slot) => (
          <section key={slot} className={`panel result-card ${slot === winnerSlot ? 'won' : 'lost'}`}>
            <h2>{summary.players[slot].name}</h2>
            <p className="result-clock">{formatClock(summary.finalRemainingMs[slot])}</p>
            <p className="muted">
              {summary.stats[slot].correct} correct · {summary.stats[slot].passes}{' '}
              {summary.stats[slot].passes === 1 ? 'pass' : 'passes'}
            </p>
          </section>
        ))}
      </div>

      <button type="button" className="button primary large" onClick={onContinue}>
        Back to bracket <kbd>ENTER</kbd>
      </button>
    </div>
  );
}
