import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Top-anchored sheet (guess input) instead of a centred box. */
  sheet?: boolean;
  testId?: string;
}

/** A native `<dialog>`: focus trap, Escape and inert background come from the browser. */
export function Modal({ title, onClose, children, sheet = false, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

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
      </div>
    </dialog>
  );
}
