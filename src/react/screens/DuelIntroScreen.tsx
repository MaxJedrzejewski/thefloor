import { useHotkeys } from '../hooks/useHotkeys';
import type { DuelSetup } from '../../engine/duel/types';

interface Props {
  setup: DuelSetup;
  roundLabel: string;
  onBegin: () => void;
  onAbandon: () => void;
}

export function DuelIntroScreen({ setup, roundLabel, onBegin, onAbandon }: Props) {
  useHotkeys({ enter: onBegin, escape: onAbandon });
  const firstName = setup.players[setup.firstToAnswer].name;

  return (
    <div className="screen intro-screen">
      <p className="muted">{roundLabel}</p>

      <h1 className="intro-versus">
        {setup.players.A.name} <span className="versus">vs</span> {setup.players.B.name}
      </h1>

      <section className="panel intro-draw">
        <p className="muted">Category</p>
        <p className="intro-category">{setup.categoryName}</p>
        <p className="muted">
          {firstName} takes the first clue — decided by the draw.
        </p>
      </section>

      <ul className="rules-reminder">
        <li>45 seconds each. Only one clock runs at a time.</li>
        <li>A correct answer stops your clock and starts theirs.</li>
        <li>A wrong answer costs nothing but the seconds it burns — guess as often as you like.</li>
        <li>A pass costs a flat 3 seconds and keeps your turn.</li>
        <li>First clock to zero loses. There is no last question.</li>
      </ul>

      <div className="actions">
        <button type="button" className="button primary large" onClick={onBegin}>
          Start the clock <kbd>ENTER</kbd>
        </button>
        <button type="button" className="button ghost" onClick={onAbandon}>
          Back to bracket
        </button>
      </div>
    </div>
  );
}
