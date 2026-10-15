import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fr } from '../i18n/fr';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(cleanup);
beforeEach(() => {
  // React and the boundary log the error on purpose.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

let broken = true;
function Bomb() {
  if (broken) throw new Error('Invalid grid date: 2026-00-01');
  return <p>all good</p>;
}

describe('ErrorBoundary (M3)', () => {
  it('shows a French fallback instead of a blank page', () => {
    broken = true;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain(fr.crashTitle);
    expect(screen.getByRole('button', { name: fr.crashRetry })).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.crashClear })).toBeTruthy();
  });

  it('renders its children untouched when nothing is wrong', () => {
    broken = false;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeTruthy();
    expect(screen.queryByTestId('crash')).toBeNull();
  });

  it('retries: the page comes back once the cause is gone', () => {
    broken = true;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    broken = false;
    fireEvent.click(screen.getByRole('button', { name: fr.crashRetry }));
    expect(screen.getByText('all good')).toBeTruthy();
  });

  it('stays on the fallback when the retry fails again', () => {
    broken = true;
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: fr.crashRetry }));
    expect(screen.getByTestId('crash')).toBeTruthy();
  });

  it('erases the game data only after a confirmation, then reloads', () => {
    broken = true;
    const clearData = vi.fn();
    const reload = vi.fn();
    render(
      <ErrorBoundary clearData={clearData} reload={reload}>
        <Bomb />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: fr.crashClear }));
    expect(clearData).not.toHaveBeenCalled();
    expect(screen.getByText(fr.crashClearWarning)).toBeTruthy();

    // Changing one's mind costs nothing.
    fireEvent.click(screen.getByRole('button', { name: fr.crashClearCancel }));
    expect(clearData).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: fr.crashClear })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: fr.crashClear }));
    fireEvent.click(screen.getByRole('button', { name: fr.crashClearConfirm }));
    expect(clearData).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
