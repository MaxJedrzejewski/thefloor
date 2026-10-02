import { useEffect, useRef } from 'react';

export type HotkeyMap = Record<string, (() => void) | undefined>;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/**
 * Bind keyboard shortcuts, keyed by lowercased `event.key`.
 *
 * Handlers are skipped while the host is typing in a form, so the category editor
 * and the duel screen can coexist without the judge keys firing mid-word.
 */
export function useHotkeys(map: HotkeyMap, enabled = true): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      const handler = mapRef.current[event.key.toLowerCase()];
      if (!handler) return;

      // Space would otherwise scroll the page out from under the prompt.
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
