import type { PauseReason } from '../../engine/duel/types';

/** The reveal pause has its own overlay (RevealOverlay); this one covers the rest. */
type StillPauseReason = Exclude<PauseReason, 'reveal'>;

interface Props {
  reason: StillPauseReason | null;
  onResume: () => void;
}

const MESSAGES: Record<StillPauseReason, { title: string; detail: string }> = {
  host: { title: 'Paused', detail: 'Neither clock is running.' },
  hidden: { title: 'Paused', detail: 'The tab lost focus, so both clocks stopped. Nobody was charged.' },
  undo: { title: 'Ruling undone', detail: 'Settle the argument, then resume. The clock is not running.' },
};

/** Opaque on purpose: a paused clue must not be free thinking time. */
export function PausedOverlay({ reason, onResume }: Props) {
  const message = MESSAGES[reason ?? 'host'];

  return (
    <div className="paused-overlay" data-testid="paused-overlay">
      <div className="paused-card">
        <h2>{message.title}</h2>
        <p>{message.detail}</p>
        <button type="button" className="button primary" onClick={onResume}>
          Resume <kbd>ESC</kbd>
        </button>
      </div>
    </div>
  );
}
