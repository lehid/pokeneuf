import {
  APP_NAME,
  gridDateFor,
  hasNewGrid,
  isOver,
  LAUNCH_DATE,
  livesLeft,
  MAX_ERRORS,
  type GridDate,
} from '@pokeneuf/core';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Board } from './components/Board';
import { AbandonDialog, EndDialog, RulesDialog, SolutionsDialog } from './components/Dialogs';
import { GuessSheet } from './components/GuessSheet';
import { Modal } from './components/Modal';
import { demoGrid, memberships, pokemonById } from './data';
import { loadDailyGrid, type GridLoad } from './gridLoader';
import { GameStoreContext, useGame } from './GameContext';
import { fr } from './i18n/fr';
import { browserStorage, demoStorage, type KeyValueStorage } from './storage';
import { createGameStore } from './store';

function Lives() {
  const game = useGame((s) => s.game);
  const left = livesLeft(game);
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={fr.lives(left, MAX_ERRORS)}
      data-testid="lives"
      data-left={left}
    >
      {Array.from({ length: MAX_ERRORS }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`size-4 border-[3px] border-lcd-ink ${i < left ? 'bg-lcd-danger' : 'bg-transparent'}`}
        />
      ))}
    </div>
  );
}

/** Spoken feedback for the last guess (the visual feedback is the cell animation). */
function Announcer() {
  const last = useGame((s) => s.lastGuess);
  const game = useGame((s) => s.game);
  let text = '';
  if (last && last.result !== 'ignored') {
    const name = pokemonById(last.pokemonId).nameFr;
    text =
      last.result === 'correct'
        ? fr.announceCorrect(name)
        : fr.announceWrong(name, livesLeft(game));
  }
  return (
    <p className="sr-only" role="status" aria-live="polite" data-testid="announcer">
      {text}
    </p>
  );
}

function Game({ demo }: { demo: boolean }) {
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  const dialog = useGame((s) => s.dialog);
  const openRules = useGame((s) => s.openRules);
  const askAbandon = useGame((s) => s.askAbandon);
  const openEnd = useGame((s) => s.openEnd);
  const over = isOver(game);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-3 py-4 sm:max-w-2xl sm:px-6 sm:py-8">
      <header className="panel flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <h1 className="title-pixel text-base sm:text-xl">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-lcd-soft">
            {fr.gridTitle(grid.id)} · {demo ? fr.demoGrid : fr.gridDate(grid.date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="sr-only">{fr.errorsLabel}</span>
          <Lives />
        </div>
      </header>

      <Board />
      <Announcer />

      {over && (
        <p className="panel p-3 text-center text-sm" data-testid="review-hint">
          {fr.reviewHint}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn" onClick={openRules} data-testid="open-rules">
          {fr.rulesButton}
        </button>
        {demo && (
          <a className="btn" href={import.meta.env.BASE_URL} data-testid="back-to-today">
            {fr.backToToday}
          </a>
        )}
        {over ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={openEnd}
            data-testid="open-end"
          >
            {fr.resultButton}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-danger"
            onClick={askAbandon}
            data-testid="abandon"
          >
            {fr.abandonButton}
          </button>
        )}
      </div>

      <footer className="mt-auto pt-4 text-center text-xs text-lcd-soft">{fr.disclaimer}</footer>

      <GuessSheet />
      {dialog === 'rules' && <RulesDialog />}
      {dialog === 'abandon' && <AbandonDialog />}
      {dialog === 'end' && <EndDialog />}
      <SolutionsDialog />
    </main>
  );
}

/** Page frame for every screen that is not the game itself. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-8">
      <header className="panel p-3">
        <h1 className="title-pixel text-base sm:text-xl">{APP_NAME}</h1>
        <p className="mt-1 text-xs text-lcd-soft">{fr.tagline}</p>
      </header>
      {children}
      <footer className="mt-auto pt-4 text-center text-xs text-lcd-soft">{fr.disclaimer}</footer>
    </main>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel flex flex-col items-center gap-3 p-5 text-center" role="status">
      <h2 className="title-pixel text-sm">{title}</h2>
      {children}
    </section>
  );
}

const systemNow = () => new Date();

export interface AppProps {
  storage?: KeyValueStorage;
  /** The clock, injectable for tests. */
  now?: () => Date;
  baseUrl?: string;
  fetchImpl?: typeof fetch | undefined;
  /** Play the built-in demo grid instead of the daily one. Default: `?demo` in the URL. */
  demo?: boolean;
}

/** Loads the grid of the day, and notices when a new day starts while the page stays open. */
function useDailyGrid(
  now: () => Date,
  baseUrl: string,
  fetchImpl: typeof fetch | undefined,
  enabled: boolean,
) {
  const [date, setDate] = useState<GridDate>(() => gridDateFor(now()));
  const [load, setLoad] = useState<GridLoad | null>(null);
  const [offer, setOffer] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoad(null);
    void loadDailyGrid(date, {
      memberships,
      baseUrl,
      ...(fetchImpl ? { fetchImpl } : {}),
    }).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [date, attempt, baseUrl, fetchImpl, enabled]);

  const ready = load?.kind === 'ready';
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      if (document.visibilityState !== 'visible' || !hasNewGrid(date, now())) return;
      // A game may be in progress: offer. With nothing on screen to lose, just move on.
      if (ready) setOffer(true);
      else setDate(gridDateFor(now()));
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [date, ready, now, enabled]);

  return {
    load,
    offer,
    retry: () => setAttempt((n) => n + 1),
    playNewGrid: useCallback(() => {
      setOffer(false);
      setDate(gridDateFor(now()));
    }, [now]),
    later: () => setOffer(false),
  };
}

function DailyApp({
  storage,
  now,
  baseUrl,
  fetchImpl,
}: Required<Pick<AppProps, 'storage' | 'now' | 'baseUrl'>> & Pick<AppProps, 'fetchImpl'>) {
  const { load, offer, retry, playNewGrid, later } = useDailyGrid(now, baseUrl, fetchImpl, true);

  if (load === null) {
    return (
      <Shell>
        <Notice title={fr.loading}>
          <span className="sr-only">{fr.loading}</span>
        </Notice>
      </Shell>
    );
  }
  if (load.kind === 'missing') {
    return (
      <Shell>
        <Notice title={fr.noGridTitle}>
          <p data-testid="no-grid">
            {load.beforeLaunch ? fr.notLaunched(fr.launchDate(LAUNCH_DATE)) : fr.noGrid}
          </p>
          {load.beforeLaunch && (
            <a className="btn btn-primary" href="?demo" data-testid="try-demo">
              {fr.tryDemo}
            </a>
          )}
        </Notice>
      </Shell>
    );
  }
  if (load.kind === 'error') {
    return (
      <Shell>
        <Notice title={fr.noGridTitle}>
          <p data-testid="load-error">{fr.loadError}</p>
          <button type="button" className="btn btn-primary" onClick={retry}>
            {fr.retry}
          </button>
        </Notice>
      </Shell>
    );
  }
  return (
    <GameSession key={load.grid.date} grid={load.grid} storage={storage} demo={false}>
      {offer && (
        <Modal title={fr.newGridTitle} onClose={later} testId="new-grid-dialog">
          <p className="mb-4">{fr.newGridText}</p>
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            <button type="button" className="btn btn-primary flex-1" onClick={playNewGrid}>
              {fr.newGridPlay}
            </button>
            <button type="button" className="btn flex-1" onClick={later}>
              {fr.newGridLater}
            </button>
          </div>
        </Modal>
      )}
    </GameSession>
  );
}

function GameSession({
  grid,
  storage,
  demo,
  children,
}: {
  grid: typeof demoGrid;
  storage: KeyValueStorage;
  demo: boolean;
  children?: ReactNode;
}) {
  const store = useMemo(() => createGameStore({ grid, memberships, storage }), [grid, storage]);
  return (
    <GameStoreContext.Provider value={store}>
      <Game demo={demo} />
      {children}
    </GameStoreContext.Provider>
  );
}

export function App({
  storage = browserStorage,
  now = systemNow,
  baseUrl = import.meta.env.BASE_URL,
  fetchImpl,
  demo = new URLSearchParams(window.location.search).has('demo'),
}: AppProps) {
  const demoStore = useMemo(() => demoStorage(storage), [storage]);
  if (demo) return <GameSession grid={demoGrid} storage={demoStore} demo />;
  return <DailyApp storage={storage} now={now} baseUrl={baseUrl} fetchImpl={fetchImpl} />;
}
