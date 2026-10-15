import {
  CATEGORY_FAMILIES,
  flaggedCellCount,
  getCategory,
  hasFlag,
  parseReviewed,
  REVIEW,
  REVIEW_FILTER_KINDS,
  REVIEWED_KEY,
  reviewGrid,
  reviewMarkdown,
  serializeReviewed,
  summarizeReviews,
  type CellFlagKind,
  type CellReview,
  type Grid,
  type GridDate,
  type GridReview,
  type LineReview,
  type ReviewFilterKind,
} from '@pokeneuf/core';
import { useEffect, useId, useMemo, useState } from 'react';
import { RarityChip } from '../components/RarityChip';
import { memberships, pokemonById, popularity } from '../data';
import { formatNumber } from '../format';
import { fr, frPreview } from '../i18n/fr';
import { browserStorage, type KeyValueStorage } from '../storage';
import { loadPreviewGrids, type PreviewLoad } from './loadGrids';

const t = frPreview;

/** Unique string a production-build check looks for to prove this module is not shipped. */
export const PREVIEW_MARKER = 'pokeneuf-grid-preview-dev-only';

const percentFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const percent = (share: number) => percentFormat.format(share * 100);

/** Human help for a kind of flag, built from the numbers the core helpers really use. */
function flagHelp(kind: ReviewFilterKind): string {
  switch (kind) {
    case 'few':
      return t.flagHelp.few(REVIEW.fewAnswers);
    case 'obvious':
      return t.flagHelp.obvious(REVIEW.obviousPopularity, REVIEW.obviousMaxAnswers);
    case 'redundant':
      return t.flagHelp.redundant(Math.round(REVIEW.redundantShare * 100));
    default:
      return t.flagHelp[kind];
  }
}

function flagName(kind: ReviewFilterKind): string {
  return kind === 'few' ? t.flag.few(REVIEW.fewAnswers) : t.flag[kind];
}

/** A reviewed grid is a plain grid for the review: a grid that cannot be reviewed is listed apart. */
function reviewAll(grids: readonly Grid[]): { reviews: GridReview[]; broken: GridDate[] } {
  const reviews: GridReview[] = [];
  const broken: GridDate[] = [];
  for (const grid of grids) {
    try {
      reviews.push(reviewGrid(grid, memberships, popularity));
    } catch {
      broken.push(grid.date);
    }
  }
  return { reviews, broken };
}

function FlagTag({ children }: { children: string }) {
  return (
    <span className="inline-block border-2 border-lcd-danger px-1.5 text-xs font-bold text-lcd-danger">
      {children}
    </span>
  );
}

function LineDetails({ line }: { line: LineReview }) {
  const category = getCategory(line.categoryId);
  return (
    <details className="panel p-2" data-testid={`line-${line.axis}-${line.position}`}>
      <summary className="cursor-pointer text-sm font-bold">
        <span className="text-lcd-soft">
          {line.axis === 'row' ? t.row(line.position + 1) : t.col(line.position + 1)} ·{' '}
        </span>
        {category.label.fr}
        {line.surprise !== null && (
          <>
            {' '}
            <FlagTag>{t.flag.surprise}</FlagTag>
          </>
        )}
      </summary>
      <div className="mt-2 flex flex-col gap-1 text-sm">
        <p className="text-xs font-bold tracking-wide text-lcd-soft uppercase">{t.definition}</p>
        <p>{category.definition.fr}</p>
        <p className="text-xs text-lcd-soft">
          {t.family[line.family]} · {t.members(line.members)}
        </p>
        {line.surprise !== null && <p className="text-xs">{t.surprise[line.surprise]}</p>}
      </div>
    </details>
  );
}

function CellDetails({ cell, grid }: { cell: CellReview; grid: Grid }) {
  const row = getCategory(grid.rows[Math.floor(cell.index / 3)] ?? '').label.fr;
  const col = getCategory(grid.cols[cell.index % 3] ?? '').label.fr;
  const flagged = cell.flags.length > 0;
  return (
    <section
      className={`panel p-2 ${flagged ? 'border-dashed' : ''}`}
      data-testid={`cell-${cell.index}`}
      data-flags={cell.flags.join(' ')}
      data-size={cell.size}
    >
      <h5 className="text-sm font-bold">{t.cellHeading(cell.index + 1, row, col)}</h5>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
        <span className="font-bold">{t.cellAnswers(cell.size)}</span>
        {cell.flags.map((flag) => (
          <FlagTag key={flag}>{t.cellFlagShort[flag]}</FlagTag>
        ))}
      </p>
      <ol className="mt-2 flex flex-wrap gap-1" aria-label={t.answersLabel}>
        {cell.answers.map((answer) => {
          const pokemon = pokemonById(answer.id);
          return (
            <li
              key={answer.id}
              className="flex items-center gap-1 border-2 border-lcd-ink bg-lcd-panel-2 px-1 py-0.5 text-xs"
              title={t.popularity(answer.popularity.toFixed(2))}
              data-tier={answer.tier}
            >
              <span className="font-bold">{pokemon.nameFr}</span>
              <span className="text-lcd-soft">{formatNumber(answer.id)}</span>
              <RarityChip tier={answer.tier} compact />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GridDetails({ grid, review, id }: { grid: Grid; review: GridReview; id: string }) {
  return (
    <div id={id} className="mt-3 flex flex-col gap-3">
      {review.problems.length > 0 && (
        <div className="panel border-lcd-danger p-2" data-testid="problems">
          <h4 className="text-sm font-bold text-lcd-danger">{t.problemsTitle}</h4>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {review.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h4 className="mb-2 text-sm font-bold">{t.linesTitle}</h4>
        <div className="flex flex-col gap-2">
          {review.lines.map((line) => (
            <LineDetails key={`${line.axis}${line.position}`} line={line} />
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-bold">{t.cellsTitle}</h4>
        <div className="flex flex-col gap-2">
          {review.cells.map((cell) => (
            <CellDetails key={cell.index} cell={cell} grid={grid} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface GridItemProps {
  grid: Grid;
  review: GridReview;
  open: boolean;
  reviewed: boolean;
  onToggleOpen: () => void;
  onToggleReviewed: () => void;
}

function GridItem({ grid, review, open, reviewed, onToggleOpen, onToggleReviewed }: GridItemProps) {
  const uid = useId();
  const headingId = `${uid}-title`;
  const detailId = `${uid}-detail`;
  const flaggedCells = flaggedCellCount(review);
  const flagged = hasFlag(review);
  const kinds = REVIEW_FILTER_KINDS.filter((kind) => hasFlag(review, kind));
  const level = review.difficulty.level;
  return (
    <li
      id={`grid-${grid.date}`}
      className="panel p-3"
      data-testid={`preview-grid-${grid.date}`}
      data-flagged={flagged}
      data-reviewed={reviewed}
    >
      <h3 id={headingId} className="text-base font-bold">
        {t.gridHeading(grid.id, fr.gridDate(grid.date))}
      </h3>
      <p className="mt-1 text-xs text-lcd-soft" data-testid="grid-meta">
        {fr.difficultyLabel} : {t.difficulty(fr.difficulty[level], review.difficulty.score)}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
        {kinds.length > 0 ? (
          <>
            {flaggedCells > 0 && <FlagTag>{t.flaggedCells(flaggedCells)}</FlagTag>}
            {kinds.map((kind) => (
              <FlagTag key={kind}>{flagName(kind)}</FlagTag>
            ))}
          </>
        ) : (
          <span className="text-lcd-soft">{t.noFlag}</span>
        )}
      </p>
      <p className="mt-1 text-xs text-lcd-soft">
        {review.lines.map((l) => getCategory(l.categoryId).label.fr).join(' · ')}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="size-5 accent-[var(--lcd-ink)]"
            checked={reviewed}
            onChange={onToggleReviewed}
            aria-describedby={headingId}
            data-testid="reviewed"
          />
          {t.markReviewed}
        </label>
        <button
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls={detailId}
          onClick={onToggleOpen}
          data-testid="toggle-detail"
        >
          {open ? t.collapse : t.expand}
        </button>
      </div>
      {open && <GridDetails grid={grid} review={review} id={detailId} />}
    </li>
  );
}

function Summary({ reviews, reviewedCount }: { reviews: GridReview[]; reviewedCount: number }) {
  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);
  return (
    <section className="panel p-4" aria-labelledby="preview-summary" data-testid="summary">
      <h2 id="preview-summary" className="title-pixel mb-3 text-sm">
        {t.summaryTitle}
      </h2>
      <ul className="flex flex-col gap-1 text-sm">
        <li data-testid="summary-reviewed">{t.reviewedCount(reviewedCount, summary.grids)}</li>
        <li data-testid="summary-flagged">{t.flaggedGrids(summary.flaggedGrids, summary.grids)}</li>
        <li>{t.meanCellSize(summary.meanCellSize.toFixed(1))}</li>
        <li data-testid="summary-name">
          {t.nameShare(percent(summary.nameShare), summary.gridsWithName)}
        </li>
        <li>{t.surprisingLines(summary.surprisingLines)}</li>
      </ul>

      <h3 className="mt-4 mb-2 text-sm font-bold">{t.flagsTitle}</h3>
      <dl className="flex flex-col gap-2 text-sm" data-testid="summary-flags">
        {REVIEW_FILTER_KINDS.map((kind) => (
          <div key={kind} data-kind={kind}>
            <dt className="font-bold">{flagName(kind)}</dt>
            <dd>
              {kind === 'surprise' || kind === 'problem'
                ? t.flagsGrids(summary.gridsByFlag[kind])
                : t.flagsCells(
                    summary.cellsByFlag[kind as CellFlagKind],
                    summary.gridsByFlag[kind],
                  )}
            </dd>
            <dd className="text-xs text-lcd-soft">{flagHelp(kind)}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-4 mb-2 text-sm font-bold">{t.familyMixTitle}</h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="summary-families">
        {CATEGORY_FAMILIES.map((family) => (
          <li key={family}>
            {t.familyCount(
              t.family[family],
              summary.familyMix[family],
              percent(summary.lines === 0 ? 0 : summary.familyMix[family] / summary.lines),
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface PreviewPageProps {
  storage?: KeyValueStorage;
  baseUrl?: string;
  fetchImpl?: typeof fetch | undefined;
  /** A grid to open and scroll to (`#/preview/2026-11-05`). */
  focusDate?: GridDate | null;
}

/**
 * Development-only page to read the committed grids by eye before they become public history
 * (ROADMAP §3.4). It is only ever loaded behind `import.meta.env.DEV` (see `App.tsx`).
 */
export function PreviewPage({
  storage = browserStorage,
  baseUrl = import.meta.env.BASE_URL,
  fetchImpl,
  focusDate = null,
}: PreviewPageProps) {
  const [load, setLoad] = useState<PreviewLoad | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [reviewed, setReviewed] = useState<Set<GridDate>>(() =>
    parseReviewed(storage.get(REVIEWED_KEY)),
  );
  const [open, setOpen] = useState<Set<GridDate>>(() => new Set(focusDate ? [focusDate] : []));
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [flagKind, setFlagKind] = useState<ReviewFilterKind | 'any'>('any');
  const [hideReviewed, setHideReviewed] = useState(false);
  const [exported, setExported] = useState<{ text: string; copied: boolean } | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = t.title;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    void loadPreviewGrids({ baseUrl, ...(fetchImpl ? { fetchImpl } : {}) }).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, fetchImpl, attempt]);

  const grids = load?.kind === 'ready' ? load.grids : null;
  const { reviews, broken } = useMemo(
    () => (grids ? reviewAll(grids) : { reviews: [], broken: [] }),
    [grids],
  );
  const gridByDate = useMemo(() => new Map((grids ?? []).map((g) => [g.date, g])), [grids]);

  // Scroll to the grid named in the URL once the list is on screen.
  const ready = reviews.length > 0;
  useEffect(() => {
    if (!ready || focusDate === null) return;
    document.getElementById(`grid-${focusDate}`)?.scrollIntoView?.();
  }, [ready, focusDate]);

  const visible = reviews.filter(
    (review) =>
      (!hideReviewed || !reviewed.has(review.date)) &&
      (!onlyFlagged || hasFlag(review, flagKind === 'any' ? null : flagKind)),
  );
  const reviewedInList = reviews.filter((r) => reviewed.has(r.date)).length;

  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (!next.delete(value)) next.add(value);
    return next;
  }

  function toggleReviewed(date: GridDate) {
    const next = toggle(reviewed, date);
    setReviewed(next);
    storage.set(REVIEWED_KEY, serializeReviewed(next));
  }

  async function copyList() {
    const text = reviewMarkdown(
      reviews.map((r) => ({ date: r.date, id: r.id })),
      reviewed,
      {
        title: t.exportTitle,
        reviewed: t.exportReviewed,
        pending: t.exportPending,
        entry: (e) => t.exportEntry(e.id, e.date),
      },
    );
    let copied = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      copied = false;
    }
    setExported({ text, copied });
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-8"
      data-preview={PREVIEW_MARKER}
    >
      <header className="panel p-3">
        <h1 className="title-pixel text-base sm:text-xl">{t.title}</h1>
        <p className="mt-2 text-xs font-bold text-lcd-danger" data-testid="dev-only">
          {t.devOnly}
        </p>
        <p className="mt-2 text-sm text-lcd-soft">{t.intro}</p>
        <a className="btn mt-3 inline-block" href="#/" data-testid="back-to-game">
          {t.backToGame}
        </a>
      </header>

      {load === null && (
        <p className="panel p-4 text-center" role="status">
          {t.loading}
        </p>
      )}
      {load?.kind === 'error' && (
        <div className="panel flex flex-col items-center gap-3 p-4 text-center" role="alert">
          <p data-testid="load-error">{t.loadError}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t.retry}
          </button>
        </div>
      )}
      {load?.kind === 'ready' && (load.unreadable.length > 0 || broken.length > 0) && (
        <p className="panel p-3 text-sm text-lcd-danger" role="alert" data-testid="unreadable">
          {t.failedGrids([...load.unreadable, ...broken].join(', '))}
        </p>
      )}

      {load?.kind === 'ready' && (
        <>
          <Summary reviews={reviews} reviewedCount={reviewedInList} />

          <section className="panel p-4" aria-labelledby="preview-filters">
            <h2 id="preview-filters" className="title-pixel mb-3 text-sm">
              {t.filtersTitle}
            </h2>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex min-h-11 items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--lcd-ink)]"
                  checked={onlyFlagged}
                  onChange={(e) => setOnlyFlagged(e.target.checked)}
                  data-testid="only-flagged"
                />
                {t.onlyFlagged}
              </label>
              <p className="text-xs text-lcd-soft">
                {t.onlyFlaggedHelp(REVIEW.manyFewCells, REVIEW.fewAnswers)}
              </p>
              <label className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{t.flagFilter}</span>
                <select
                  className="min-h-11 border-[3px] border-lcd-ink bg-lcd-panel px-2 text-lcd-ink disabled:opacity-50"
                  value={flagKind}
                  disabled={!onlyFlagged}
                  onChange={(e) => setFlagKind(e.target.value as ReviewFilterKind | 'any')}
                  data-testid="flag-kind"
                >
                  <option value="any">{t.anyFlag}</option>
                  {REVIEW_FILTER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {flagName(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--lcd-ink)]"
                  checked={hideReviewed}
                  onChange={(e) => setHideReviewed(e.target.checked)}
                  data-testid="hide-reviewed"
                />
                {t.hideReviewed}
              </label>
              <div>
                <button type="button" className="btn" onClick={copyList} data-testid="export">
                  {t.exportButton}
                </button>
              </div>
              {exported && (
                <div className="flex flex-col gap-2">
                  <p role="status" data-testid="export-status">
                    {exported.copied ? t.exportCopied : t.exportFailed}
                  </p>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold">{t.exportLabel}</span>
                    <textarea
                      readOnly
                      rows={8}
                      className="w-full border-[3px] border-lcd-ink bg-lcd-panel p-2 font-mono text-xs text-lcd-ink"
                      value={exported.text}
                      data-testid="export-text"
                    />
                  </label>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="preview-grids">
            <h2 id="preview-grids" className="title-pixel mb-1 text-sm">
              {t.gridsTitle}
            </h2>
            <p className="mb-3 text-xs text-lcd-soft" data-testid="grids-count">
              {t.gridsCount(visible.length, reviews.length)}
            </p>
            {visible.length === 0 ? (
              <p className="panel p-4 text-center" data-testid="no-match">
                {t.noGrids}
              </p>
            ) : (
              <ol className="flex flex-col gap-3" data-testid="preview-list">
                {visible.map((review) => {
                  const grid = gridByDate.get(review.date);
                  if (!grid) return null;
                  return (
                    <GridItem
                      key={review.date}
                      grid={grid}
                      review={review}
                      open={open.has(review.date)}
                      reviewed={reviewed.has(review.date)}
                      onToggleOpen={() => setOpen((set) => toggle(set, review.date))}
                      onToggleReviewed={() => toggleReviewed(review.date)}
                    />
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/** The route component: what `App` lazy-loads in development. */
export default function PreviewRoute({
  date,
  ...props
}: Omit<PreviewPageProps, 'focusDate'> & { date: GridDate | null }) {
  return <PreviewPage {...props} focusDate={date} />;
}
