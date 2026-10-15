import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoGrid, memberships, popularity } from '../data';
import { GameStoreContext } from '../GameContext';
import { memoryStorage } from '../storage';
import { createGameStore } from '../store';
import { Modal } from './Modal';

afterEach(cleanup);

function Harness({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      {open && (
        <Modal
          title="Titre"
          testId="dialog"
          onClose={() => {
            onClosed?.();
            setOpen(false);
          }}
        >
          <button type="button" onClick={() => setOpen(false)}>
            first
          </button>
          <button type="button" data-autofocus>
            safe
          </button>
        </Modal>
      )}
    </>
  );
}

function renderWithStore(ui: React.ReactElement, strict = false) {
  const store = createGameStore({
    grid: demoGrid,
    memberships,
    popularity,
    storage: memoryStorage(),
  });
  const tree = <GameStoreContext.Provider value={store}>{ui}</GameStoreContext.Provider>;
  return { store, ...render(strict ? <StrictMode>{tree}</StrictMode> : tree) };
}

/** The `close` event of a native dialog arrives in a later task. */
const nextTask = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe('Modal focus (H6)', () => {
  it('gives the focus back to the control that opened it when the app closes it', async () => {
    renderWithStore(<Harness />);
    const opener = screen.getByText('opener');
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).not.toBe(opener); // the focus is inside the dialog
    fireEvent.click(screen.getByText('first')); // the app closes it (not Escape)
    expect(screen.queryByTestId('dialog')).toBeNull();
    await nextTask();
    expect(document.activeElement).toBe(opener);
  });

  it('puts the initial focus on the control marked data-autofocus', () => {
    renderWithStore(<Harness />);
    screen.getByText('opener').focus();
    fireEvent.click(screen.getByText('opener'));
    expect(document.activeElement).toBe(screen.getByText('safe'));
  });

  it('does not close itself in StrictMode (dev): the close event of the effect re-run is stale', async () => {
    const onClosed = vi.fn();
    renderWithStore(<Harness onClosed={onClosed} />, true);
    fireEvent.click(screen.getByText('opener'));
    await nextTask();
    await nextTask();
    expect(onClosed).not.toHaveBeenCalled();
    expect(screen.getByTestId('dialog').hasAttribute('open')).toBe(true);
  });

  it('still reports a real close (Escape, back button)', async () => {
    const onClosed = vi.fn();
    renderWithStore(<Harness onClosed={onClosed} />);
    fireEvent.click(screen.getByText('opener'));
    const dialog = screen.getByTestId('dialog') as HTMLDialogElement;
    dialog.close(); // what the browser does on Escape
    await nextTask();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});

describe('toast inside a dialog (M10)', () => {
  it('is shown, and announced, inside the open dialog: the page behind it is inert', () => {
    const { store } = renderWithStore(
      <>
        <Harness />
      </>,
    );
    fireEvent.click(screen.getByText('opener'));
    act(() => store.getState().showToast('copié'));
    const toast = screen.getByTestId('toast');
    expect(toast.closest('dialog')).toBe(screen.getByTestId('dialog'));
    expect(toast.parentElement?.getAttribute('role')).toBe('status');
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });
});
