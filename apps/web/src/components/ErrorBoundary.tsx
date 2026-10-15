import { APP_NAME } from '@pokeneuf/core';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { fr } from '../i18n/fr';
import { clearGameData } from '../storage';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Erases what the game saved. Default: every `pokeneuf:v1:` key of `localStorage`. */
  clearData?: () => void;
  /** Reloads the page after the data was cleared. Default: `location.reload()`. */
  reload?: () => void;
}

interface ErrorBoundaryState {
  failed: boolean;
  /** The player pressed "Effacer les données du jeu" and is asked to confirm. */
  confirming: boolean;
}

/**
 * The last line of defence: whatever throws while rendering (a corrupt save that got through, a
 * data mismatch…) must not leave a blank page that comes back on every load. It offers to try
 * again, or, as a clearly labelled and confirmed last resort, to erase the game's data.
 * It depends on nothing of the game (no store, no context): it has to work when those are broken.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, confirming: false };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true, confirming: false };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  private retry = (): void => this.setState({ failed: false, confirming: false });

  private clearAndReload = (): void => {
    (this.props.clearData ?? clearGameData)();
    (this.props.reload ?? (() => window.location.reload()))();
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-8">
        <header className="panel p-3">
          <h1 className="title-pixel text-base sm:text-xl">{APP_NAME}</h1>
        </header>
        <section
          className="panel flex flex-col items-center gap-3 p-5 text-center"
          role="alert"
          data-testid="crash"
        >
          <h2 className="title-pixel text-sm">{fr.crashTitle}</h2>
          <p>{fr.crashText}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.retry}
            data-testid="crash-retry"
          >
            {fr.crashRetry}
          </button>
          {this.state.confirming ? (
            <div className="flex flex-col items-center gap-3 border-2 border-lcd-ink bg-lcd-bg p-3">
              <p className="text-sm font-bold">{fr.crashClearWarning}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => this.setState({ confirming: false })}
                  data-testid="crash-clear-cancel"
                >
                  {fr.crashClearCancel}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={this.clearAndReload}
                  data-testid="crash-clear-confirm"
                >
                  {fr.crashClearConfirm}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => this.setState({ confirming: true })}
              data-testid="crash-clear"
            >
              {fr.crashClear}
            </button>
          )}
        </section>
      </main>
    );
  }
}
