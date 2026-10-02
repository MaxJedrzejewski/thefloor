export type RevealOutcome = 'correct' | 'pass';

interface Props {
  outcome: RevealOutcome;
  answer: string;
}

/** The 2s flash after a judgement: big, colour-coded, and unmissable from the seats. */
export function RevealOverlay({ outcome, answer }: Props) {
  return (
    <div
      className={`reveal-overlay is-${outcome}`}
      data-testid="reveal-overlay"
      aria-live="assertive"
    >
      <p className="reveal-label">{outcome === 'correct' ? 'CORRECT' : 'PASS'}</p>
      <p className="reveal-answer">{answer}</p>
    </div>
  );
}
