import { useEffect } from 'react';
import type { PauseReason } from '../../engine/duel/types';

/**
 * Pause the duel when the tab goes away.
 *
 * The engine is deliberately honest: if animation frames stop for thirty seconds
 * it will deduct thirty seconds. `visibilitychange` and `pagehide` fire *before*
 * the browser throttles rAF, so pausing here settles the clock at the true moment
 * of backgrounding and the hidden interval is charged to nobody.
 */
export function useVisibilityPause(
  active: boolean,
  pause: (reason: PauseReason) => void,
): void {
  useEffect(() => {
    if (!active) return;

    const onHide = () => {
      if (document.visibilityState === 'hidden') pause('hidden');
    };
    const onPageHide = () => pause('hidden');

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [active, pause]);
}
