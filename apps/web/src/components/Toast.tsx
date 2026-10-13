import { useEffect } from 'react';
import { useGame } from '../GameContext';

const DURATION_MS = 3000;

/** A short confirmation, announced to screen readers, gone after a few seconds. */
export function Toast() {
  const toast = useGame((s) => s.toast);
  const clearToast = useGame((s) => s.clearToast);
  useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(clearToast, DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      {toast !== null && (
        <p
          className="panel bg-lcd-ink px-4 py-2 text-sm font-bold text-lcd-panel"
          data-testid="toast"
        >
          {toast.text}
        </p>
      )}
    </div>
  );
}
