import {
  APP_NAME,
  DISTRIBUTION_STEP,
  endedOnItsDay,
  getCategory,
  MAX_SCORE,
  rankScore,
  rarityTier,
  shareCells,
  shareText,
  solutionsFor,
  sortByPopularity,
  titleFor,
  type GameState,
} from '@pokeneuf/core';
import { useState } from 'react';
import { memberships, pokemonById, popularity } from '../data';
import { useScore, useStats } from '../hooks';
import { browserShareEnv, shareResult } from '../share';
import { RarityChip } from './RarityChip';
import { formatNumber } from '../format';
import { useGame } from '../GameContext';
import { fr } from '../i18n/fr';
import { Modal } from './Modal';
import { ResultGrid, ScoreGauge } from './ResultVisuals';
import { TitleIcon } from './TitleIcon';
import { TypeBadge } from './TypeBadge';

export function RulesDialog() {
  const closeRules = useGame((s) => s.closeRules);
  const [hide, setHide] = useState(false);
  return (
    <Modal title={fr.rulesTitle} onClose={() => closeRules(hide)} testId="rules-dialog">
      <ul className="mb-4 list-disc space-y-2 pl-5">
        {fr.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <label className="mb-4 flex items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-[var(--lcd-ink)]"
          checked={hide}
          onChange={(event) => setHide(event.target.checked)}
        />
        {fr.hideRules}
      </label>
      <button type="button" className="btn btn-primary w-full" onClick={() => closeRules(hide)}>
        {fr.play}
      </button>
    </Modal>
  );
}

export function AbandonDialog() {
  const closeDialog = useGame((s) => s.closeDialog);
  const confirmAbandon = useGame((s) => s.confirmAbandon);
  return (
    <Modal title={fr.abandonTitle} onClose={closeDialog} testId="abandon-dialog">
      <p className="mb-4">{fr.abandonQuestion}</p>
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button type="button" className="btn btn-danger flex-1" onClick={confirmAbandon}>
          {fr.abandonYes}
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={closeDialog}>
          {fr.abandonNo}
        </button>
      </div>
    </Modal>
  );
}

const END_TITLES: Record<Exclude<GameState['status'], 'playing'>, string> = {
  won: fr.endWon,
  lost: fr.endLost,
  abandoned: fr.endAbandoned,
};

function ShareButton() {
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  const showToast = useGame((s) => s.showToast);
  const score = useScore();
  const stats = useStats();
  const finishedOn = useGame((s) => s.finishedOn);

  const share = async () => {
    const text = shareText({
      appName: APP_NAME,
      gridId: grid.id,
      score: score.total,
      maxScore: MAX_SCORE,
      // An archive never extends the streak: do not claim it.
      streak: endedOnItsDay(finishedOn, grid.date) ? stats.streak : 0,
      cells: shareCells(
        game,
        score.cells.map((c) => c?.tier ?? null),
      ),
      url: `${window.location.origin}${import.meta.env.BASE_URL}`,
    });
    const outcome = await shareResult(text, browserShareEnv());
    if (outcome === 'copied') showToast(fr.copied);
    else if (outcome === 'shared') showToast(fr.shared);
    else if (outcome === 'failed') showToast(fr.shareFailed);
  };

  return (
    <button type="button" className="btn flex-1" onClick={() => void share()} data-testid="share">
      {fr.share}
    </button>
  );
}

export function EndDialog() {
  const game = useGame((s) => s.game);
  const closeDialog = useGame((s) => s.closeDialog);
  const openStats = useGame((s) => s.openStats);
  const grid = useGame((s) => s.grid);
  const finishedOn = useGame((s) => s.finishedOn);
  const score = useScore();
  if (game.status === 'playing') return null;
  const countsAsDaily = endedOnItsDay(finishedOn, grid.date);
  const endTitle = titleFor(score.total);
  const rarest = score.rarestCell === null ? null : (game.cells[score.rarestCell] ?? null);
  const rarestTier =
    score.rarestCell === null ? null : (score.cells[score.rarestCell]?.tier ?? null);
  return (
    <Modal title={END_TITLES[game.status]} onClose={closeDialog} testId="end-dialog">
      <div className="mb-3 flex items-center gap-4">
        <ResultGrid />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide uppercase text-lcd-soft">{fr.endScore}</p>
          <p className="title-pixel text-2xl" data-testid="score">
            {score.total}
            <span className="text-sm text-lcd-soft">/{MAX_SCORE}</span>
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm" data-testid="title">
            <TitleIcon title={endTitle} />
            <span>
              {fr.titleLabel} : <strong>{fr.titles[endTitle]}</strong>
            </span>
          </p>
        </div>
      </div>
      <div className="mb-3">
        <ScoreGauge score={score.total} />
      </div>
      <p className="mb-2">{fr.endFound(score.found, game.errors)}</p>
      {rarest !== null && rarestTier !== null && (
        <p className="mb-1 text-sm" data-testid="rarest">
          {fr.rarestAnswer} : <strong>{pokemonById(rarest).nameFr}</strong>{' '}
          <RarityChip tier={rarestTier} />
        </p>
      )}
      <p className="mb-2 text-xs text-lcd-soft">{fr.rarityEstimated}</p>
      {!countsAsDaily && (
        <p
          className="mb-3 border-2 border-lcd-ink bg-lcd-bg p-2 text-xs"
          data-testid="archive-note"
        >
          {fr.archiveNote}
        </p>
      )}
      <div className="mb-3 flex gap-3">
        <ShareButton />
        <button
          type="button"
          className="btn flex-1"
          onClick={openStats}
          data-testid="open-stats-end"
        >
          {fr.statsButton}
        </button>
      </div>
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={closeDialog}
        data-testid="see-solutions"
      >
        {fr.seeSolutions}
      </button>
    </Modal>
  );
}

export function StatsDialog() {
  const closeDialog = useGame((s) => s.closeDialog);
  const stats = useStats();
  const peak = Math.max(1, ...stats.distribution);
  const figures: [string, string][] = [
    [fr.statsPlayed, String(stats.played)],
    [fr.statsWinRate, `${stats.winRate} %`],
    [fr.statsAverage, String(stats.averageScore)],
    [fr.statsBest, String(stats.bestScore)],
    [fr.statsStreak, String(stats.streak)],
    [fr.statsMaxStreak, String(stats.maxStreak)],
  ];
  return (
    <Modal title={fr.statsTitle} onClose={closeDialog} testId="stats-dialog">
      {stats.played === 0 && <p className="mb-3 text-sm text-lcd-soft">{fr.statsEmpty}</p>}
      <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
        {figures.map(([label, value]) => (
          <div key={label} className="border-2 border-lcd-ink bg-lcd-bg p-2">
            <dd className="title-pixel text-base whitespace-nowrap" data-testid={`stat-${label}`}>
              {value}
            </dd>
            <dt className="mt-1 text-[0.65rem] leading-tight text-lcd-soft">{label}</dt>
          </div>
        ))}
      </dl>
      {stats.played > 0 && (
        <p className="mb-4 text-center text-sm" data-testid="best-title">
          {fr.bestTitle} : <strong>{fr.titles[titleFor(stats.bestScore)]}</strong>
        </p>
      )}
      <h3 className="mb-2 text-xs font-bold tracking-wide uppercase text-lcd-soft">
        {fr.statsDistribution}
      </h3>
      <ol className="mb-4 space-y-1" data-testid="distribution">
        {stats.distribution.map((count, bucket) => {
          const from = bucket * DISTRIBUTION_STEP;
          const to =
            bucket === stats.distribution.length - 1 ? MAX_SCORE : from + DISTRIBUTION_STEP - 1;
          return (
            <li key={from} className="flex items-center gap-2 text-xs" data-count={count}>
              <span className="w-16 shrink-0 tabular-nums">{fr.statsBucket(from, to)}</span>
              {count > 0 && (
                <span
                  className="h-4 border-2 border-lcd-ink bg-lcd-ink"
                  style={{ width: `${Math.max(4, (100 * count) / peak)}%` }}
                  aria-hidden="true"
                />
              )}
              <span className="tabular-nums">{count}</span>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn btn-primary w-full" onClick={closeDialog}>
        {fr.close}
      </button>
    </Modal>
  );
}

export function SolutionsDialog() {
  const cell = useGame((s) => s.solutionsCell);
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  const closeSolutions = useGame((s) => s.closeSolutions);
  if (cell === null) return null;

  const row = getCategory(grid.rows[Math.floor(cell / 3)] ?? '').label.fr;
  const col = getCategory(grid.cols[cell % 3] ?? '').label.fr;
  const answers = sortByPopularity(solutionsFor(grid, memberships, cell), popularity);
  const placed = game.cells[cell] ?? null;
  return (
    <Modal title={`${row} × ${col}`} onClose={closeSolutions} testId="solutions-dialog">
      <p className="mb-2 text-sm text-lcd-soft">
        {fr.solutionsCount(answers.length)}. {fr.solutionsSorted}
      </p>
      <ul className="mb-4 max-h-[50dvh] space-y-1 overflow-y-auto">
        {answers.map((id) => {
          const p = pokemonById(id);
          const tier = rarityTier(rankScore(id, answers, popularity));
          return (
            <li
              key={id}
              className={`flex items-center gap-2 border-2 border-lcd-ink px-2 py-1 ${
                id === placed ? 'bg-lcd-ink text-lcd-panel' : 'bg-lcd-panel'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="font-bold">{p.nameFr}</span>{' '}
                <span className="text-xs opacity-70">{p.nameEn}</span>
              </span>
              <span className="text-xs tabular-nums">{formatNumber(p.id)}</span>
              <span className="flex gap-1">
                {p.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </span>
              <RarityChip tier={tier} compact />
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-primary w-full" onClick={closeSolutions}>
        {fr.close}
      </button>
    </Modal>
  );
}
