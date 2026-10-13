import {
  APP_NAME,
  archiveDates,
  gridDateFor,
  hasNewGrid,
  isOver,
  LAUNCH_DATE,
  livesLeft,
  MAX_ERRORS,
  MAX_SCORE,
  parseRoute,
  RARITY_TIERS,
  type GridDate,
  type Route,
} from '@pokeneuf/core';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Board } from './components/Board';
import { DifficultyBadge } from './components/DifficultyBadge';
import {
  AbandonDialog,
  EndDialog,
  RulesDialog,
  SolutionsDialog,
  StatsDialog,
} from './components/Dialogs';
import { Toast } from './components/Toast';
import { RarityChip } from './components/RarityChip';
import { useScore, useStats } from './hooks';
import { GuessSheet } from './components/GuessSheet';
import { ArchivesPage } from './components/ArchivesPage';
import { Modal } from './components/Modal';
import { Notice, Shell } from './components/Shell';
import { demoGrid, memberships, pokemonById, popularity } from './data';
import { loadGrid, type GridLoad } from './gridLoader';
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

/** What the colours under the answers mean. */
function RarityLegend() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-1 text-xs" data-testid="legend">
      <span className="text-lcd-soft">{fr.rarityEstimated} :</span>
      {RARITY_TIERS.map((tier) => (
        <RarityChip key={tier} tier={tier} compact />
      ))}
    </p>
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

export type GameKind = 'daily' | 'demo' | 'archive';

function Game({ kind }: { kind: GameKind }) {
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  const dialog = useGame((s) => s.dialog);
  const openRules = useGame((s) => s.openRules);
  const askAbandon = useGame((s) => s.askAbandon);
  const openEnd = useGame((s) => s.openEnd);
  const openStats = useGame((s) => s.openStats);
  const score = useScore();
  const stats = useStats();
  const over = isOver(game);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-3 py-4 sm:max-w-2xl sm:px-6 sm:py-8">
      <header className="panel flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <h1 className="title-pixel text-base sm:text-xl">{APP_NAME}</h1>
          <p className="mt-1 text-xs text-lcd-soft">
            {fr.gridTitle(grid.id)} ·{' '}
            {kind === 'demo'
              ? fr.demoGrid
              : kind === 'archive'
                ? `${fr.archiveLabel} · ${fr.gridDate(grid.date)}`
                : fr.gridDate(grid.date)}
          </p>
          <DifficultyBadge />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right" data-testid="header-score" data-score={score.total}>
            <p className="title-pixel text-sm">
              {score.total}
              <span className="text-[0.6rem] text-lcd-soft">/{MAX_SCORE}</span>
            </p>
            {stats.streak > 0 && (
              <p className="text-[0.65rem] text-lcd-soft" data-testid="streak">
                <span aria-hidden="true">🔥 </span>
                {fr.streakLabel(stats.streak)}
              </p>
            )}
          </div>
          <span className="sr-only">{fr.errorsLabel}</span>
          <Lives />
        </div>
      </header>

      <Board />
      {score.found > 0 && <RarityLegend />}
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
        <button type="button" className="btn" onClick={openStats} data-testid="open-stats">
          {fr.statsButton}
        </button>
        {kind === 'demo' && (
          <a className="btn" href={import.meta.env.BASE_URL} data-testid="back-to-today">
            {fr.backToToday}
          </a>
        )}
        {kind !== 'demo' && (
          <a className="btn" href="#/archives" data-testid="open-archives">
            {kind === 'archive' ? fr.backToArchives : fr.archivesButton}
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
      {dialog === 'stats' && <StatsDialog />}
      <SolutionsDialog />
      <Toast />
    </main>
  );
}

const systemNow = () => new Date();

const RETRY_EVERY_MS = 60_000;
const RETRY_LIMIT = 60;

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
  // An automatic retry replaces the grid without flashing the loading screen again.
  const silent = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (!silent.current) setLoad(null);
    silent.current = false;
    void loadGrid(date, {
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

  // The grid of the day is published just after midnight (a scheduled deploy): when it is not there
  // yet, ask again every minute, for an hour at most, instead of leaving the player on a dead end.
  const waiting = load?.kind === 'missing' && !load.beforeLaunch;
  useEffect(() => {
    if (!enabled || !waiting) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      if (++tries > RETRY_LIMIT) return window.clearInterval(timer);
      silent.current = true;
      setAttempt((n) => n + 1);
    }, RETRY_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [enabled, waiting, date]);

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
          {!load.beforeLaunch && <p className="text-xs text-lcd-soft">{fr.noGridRetry}</p>}
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
    <GameSession key={load.grid.date} grid={load.grid} storage={storage} now={now} kind="daily">
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

/** A past grid played from the archives. Never today's grid, never a grid of the future. */
function ArchiveGame({
  date,
  storage,
  now,
  baseUrl,
  fetchImpl,
}: Required<Pick<AppProps, 'storage' | 'now' | 'baseUrl'>> &
  Pick<AppProps, 'fetchImpl'> & { date: GridDate }) {
  const today = gridDateFor(now());
  const allowed = archiveDates([date], today).length === 1;
  const [load, setLoad] = useState<GridLoad | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoad(null);
    void loadGrid(date, { memberships, baseUrl, ...(fetchImpl ? { fetchImpl } : {}) }).then(
      (result) => {
        if (!cancelled) setLoad(result);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [allowed, date, baseUrl, fetchImpl, attempt]);

  if (!allowed || load?.kind === 'missing') {
    return (
      <Shell>
        <Notice title={fr.gridUnavailableTitle}>
          <p data-testid="grid-unavailable">{fr.gridUnavailable}</p>
          <a className="btn btn-primary" href="#/archives">
            {fr.backToArchives}
          </a>
        </Notice>
      </Shell>
    );
  }
  if (load === null) {
    return (
      <Shell>
        <Notice title={fr.loading}>
          <span className="sr-only">{fr.loading}</span>
        </Notice>
      </Shell>
    );
  }
  if (load.kind === 'error') {
    return (
      <Shell>
        <Notice title={fr.gridUnavailableTitle}>
          <p data-testid="load-error">{fr.loadError}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {fr.retry}
          </button>
        </Notice>
      </Shell>
    );
  }
  return <GameSession grid={load.grid} storage={storage} now={now} kind="archive" />;
}

export function GameSession({
  grid,
  storage,
  now,
  kind,
  children,
}: {
  grid: typeof demoGrid;
  storage: KeyValueStorage;
  now: () => Date;
  kind: GameKind;
  children?: ReactNode;
}) {
  const store = useMemo(
    () => createGameStore({ grid, memberships, popularity, storage, now }),
    [grid, storage, now],
  );
  return (
    <GameStoreContext.Provider value={store}>
      <Game kind={kind} />
      {children}
    </GameStoreContext.Provider>
  );
}

/** The route of the page, from the URL hash; follows the back button and the links. */
function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

export function App({
  storage = browserStorage,
  now = systemNow,
  baseUrl = import.meta.env.BASE_URL,
  fetchImpl,
  demo = new URLSearchParams(window.location.search).has('demo'),
}: AppProps) {
  const demoStore = useMemo(() => demoStorage(storage), [storage]);
  const route = useRoute();
  if (demo) return <GameSession grid={demoGrid} storage={demoStore} now={now} kind="demo" />;
  if (route.kind === 'archives') {
    return (
      <ArchivesPage
        page={route.page}
        storage={storage}
        now={now}
        baseUrl={baseUrl}
        fetchImpl={fetchImpl}
      />
    );
  }
  if (route.kind === 'archive') {
    return (
      <ArchiveGame
        key={route.date}
        date={route.date}
        storage={storage}
        now={now}
        baseUrl={baseUrl}
        fetchImpl={fetchImpl}
      />
    );
  }
  return <DailyApp storage={storage} now={now} baseUrl={baseUrl} fetchImpl={fetchImpl} />;
}
