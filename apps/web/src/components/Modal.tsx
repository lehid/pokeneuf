import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  focusChainFor,
  pushModal,
  rememberFocusChain,
  removeModal,
  restoreFocus,
} from '../modalStack';
import { Toast } from './Toast';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Top-anchored sheet (guess input) instead of a centred box. */
  sheet?: boolean;
  testId?: string;
}

/**
 * A native `<dialog>`: focus trap, Escape and inert background come from the browser.
 *
 * - Focus: the browser would give the focus back to the opener on `close()`, but React has already
 *   removed the open dialog from the page when the cleanup runs, and then it does not. So the
 *   opener is remembered and focused again by hand.
 * - Initial focus goes to the first control, or to the one marked `data-autofocus` (the safe choice
 *   of a destructive question).
 * - The `close` event is only trusted when the dialog really is closed: in StrictMode (dev) the
 *   effect runs `showModal` → `close()` → `showModal`, and the `close` event of that `close()` is
 *   delivered later, after the dialog was opened again.
 */
export function Modal({ title, onClose, children, sheet = false, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const modalId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Who had the focus before the dialog existed. Read at the first render, not in the effect: by
  // then an `autoFocus` control inside the dialog may already have taken the focus.
  const [focusChain] = useState(() =>
    focusChainFor(document.activeElement instanceof HTMLElement ? document.activeElement : null),
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    rememberFocusChain(dialog, focusChain);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    pushModal(modalId);
    const handleClose = () => {
      if (dialog.open) return;
      onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      removeModal(modalId);
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
      restoreFocus(focusChain);
    };
  }, [modalId, focusChain]);

  return (
    <dialog
      ref={ref}
      className={`modal ${sheet ? 'sheet' : ''}`}
      aria-labelledby={titleId}
      data-testid={testId}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="p-4">
        <h2 id={titleId} className="title-pixel mb-3 text-[0.8rem] sm:text-sm">
          {title}
        </h2>
        {children}
        <Toast owner={modalId} />
      </div>
    </dialog>
  );
}
