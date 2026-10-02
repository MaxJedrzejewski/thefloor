import { memo } from 'react';
import { formatClock } from '../format/formatClock';

interface Props {
  name: string;
  remainingMs: number;
  startingMs: number;
  active: boolean;
  side: 'left' | 'right';
}

const DANGER_MS = 10_000;

/**
 * One player's clock.
 *
 * Which clock is running has to read from across a room, so it is signalled three
 * ways at once — size, brightness and the depletion bar — rather than by colour alone.
 */
export const ClockPanel = memo(function ClockPanel({
  name,
  remainingMs,
  startingMs,
  active,
  side,
}: Props) {
  const fraction = Math.max(0, Math.min(1, remainingMs / startingMs));
  const danger = active && remainingMs <= DANGER_MS;

  return (
    <div
      className={`clock-panel ${side} ${active ? 'is-active' : 'is-idle'} ${danger ? 'is-danger' : ''}`}
      data-testid={`clock-${side}`}
      data-active={active}
    >
      <p className="clock-name">{name}</p>
      <p className="clock-digits" data-testid={`clock-digits-${side}`}>
        {formatClock(remainingMs)}
      </p>
      <p className="clock-status">{active ? 'ON THE CLOCK' : 'WAITING'}</p>
      <div className="clock-bar" aria-hidden="true">
        <div className="clock-bar-fill" style={{ transform: `scaleY(${fraction})` }} />
      </div>
    </div>
  );
});
