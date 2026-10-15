import { useEffect } from 'react';
import { useGame } from '../GameContext';
import { useInnermostModal } from '../modalStack';

const DURATION_MS = 3000;

/**
 * A short confirmation, announced to screen readers, gone after a few seconds.
 *
 * One toast is shown at a time, in the place a screen reader can reach: inside the innermost open
 * dialog (`owner` = that dialog's id; the rest of the page is inert while it is open), or in the
 * page (`owner` = `null`) when no dialog is open. The live region itself is always present, so that
 * the text added to it is announced.
 */
export function Toast({ owner }: { owner: string | null }) {
  const toast = useGame((s) => s.toast);
  const clearToast = useGame((s) => s.clearToast);
  const active = useInnermostModal() === owner;

  useEffect(() => {
    if (!active || toast === null) return;
    const timer = window.setTimeout(clearToast, DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active, toast, clearToast]);

  return (
    <div
      className={
        owner === null
          ? 'pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4'
          : 'mt-3 flex justify-center'
      }
      role="status"
      aria-live="polite"
    >
      {active && toast !== null && (
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
