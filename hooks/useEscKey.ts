import { useEffect } from 'react';

/**
 * Calls handler when user presses Escape. Pass `enabled=false` to skip
 * (e.g., when a modal is closed).
 */
export function useEscKey(handler: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handler, enabled]);
}
