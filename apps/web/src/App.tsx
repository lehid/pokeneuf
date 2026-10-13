import { APP_NAME, isOver, livesLeft, MAX_ERRORS } from '@pokeneuf/core';
import { useMemo } from 'react';
import { Board } from './components/Board';
import { AbandonDialog, EndDialog, RulesDialog, SolutionsDialog } from './components/Dialogs';
import { GuessSheet } from './components/GuessSheet';
import { demoGrid, memberships, pokemonById } from './data';
import { GameStoreContext, useGame } from './GameContext';
import { fr } from './i18n/fr';
import { browserStorage, type KeyValueStorage } from './storage';
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

function Game() {
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
            {fr.gridTitle(grid.id)} · {fr.demoGrid}
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

export function App({ storage = browserStorage }: { storage?: KeyValueStorage }) {
  const store = useMemo(() => createGameStore({ grid: demoGrid, memberships, storage }), [storage]);
  return (
    <GameStoreContext.Provider value={store}>
      <Game />
    </GameStoreContext.Provider>
  );
}
