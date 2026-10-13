import {
  archiveDates,
  archiveRow,
  gameKey,
  gridDateFor,
  gridNumber,
  MAX_SCORE,
  paginate,
  readGameSummary,
  routeHash,
  type ArchiveRow,
} from '@pokeneuf/core';
import { useEffect, useMemo, useState } from 'react';
import { loadGridIndex, type IndexLoad } from '../gridLoader';
import { fr } from '../i18n/fr';
import type { KeyValueStorage } from '../storage';
import { Notice, Shell } from './Shell';

interface ArchivesPageProps {
  page: number;
  storage: KeyValueStorage;
  now: () => Date;
  baseUrl: string;
  fetchImpl: typeof fetch | undefined;
}

function Row({ row }: { row: ArchiveRow }) {
  const label = fr.archiveStatus[row.status];
  const action =
    row.status === 'unplayed'
      ? fr.archiveAction.unplayed
      : row.status === 'inProgress'
        ? fr.archiveAction.inProgress
        : fr.archiveAction.done;
  return (
    <li
      className="panel flex flex-wrap items-center gap-x-3 gap-y-2 p-3"
      data-testid={`archive-${row.date}`}
      data-status={row.status}
      aria-label={fr.archiveRowLabel(row.id, fr.gridDate(row.date), label)}
    >
      <div className="min-w-0 flex-1">
        <p className="font-bold">{fr.gridTitle(row.id)}</p>
        <p className="text-xs text-lcd-soft">{fr.gridDate(row.date)}</p>
      </div>
      <div className="text-right text-sm">
        <p
          className={`inline-block border-2 border-lcd-ink px-1.5 text-xs font-bold ${
            row.status === 'dailyDone'
              ? 'bg-lcd-ink text-lcd-panel'
              : row.status === 'inProgress'
                ? 'bg-lcd-panel-2'
                : ''
          }`}
          data-testid="status"
        >
          {label}
        </p>
        <p className="mt-1 text-xs text-lcd-soft">
          {row.status === 'inProgress' && fr.archiveFound(row.found)}
          {row.score !== null && (
            <span data-testid="row-score">{fr.scoreOutOf(row.score, MAX_SCORE)}</span>
          )}
        </p>
      </div>
      <a
        className="btn btn-primary"
        href={routeHash({ kind: 'archive', date: row.date })}
        data-testid="archive-action"
      >
        {action}
      </a>
    </li>
  );
}

/** The past grids, paginated, with where each one stands (ROADMAP phase 7). */
export function ArchivesPage({ page, storage, now, baseUrl, fetchImpl }: ArchivesPageProps) {
  const [index, setIndex] = useState<IndexLoad | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIndex(null);
    void loadGridIndex({ baseUrl, ...(fetchImpl ? { fetchImpl } : {}) }).then((result) => {
      if (!cancelled) setIndex(result);
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, fetchImpl, attempt]);

  const today = gridDateFor(now());
  const dates = useMemo(
    () => (index?.kind === 'ready' ? archiveDates(index.dates, today) : []),
    [index, today],
  );
  const current = paginate(dates, page);
  const rows = current.items.map((date) =>
    archiveRow(date, readGameSummary(storage.get(gameKey(gridNumber(date))), date)),
  );

  return (
    <Shell>
      <section className="panel p-4" aria-labelledby="archives-title">
        <h2 id="archives-title" className="title-pixel mb-2 text-sm">
          {fr.archivesTitle}
        </h2>
        <p className="text-sm text-lcd-soft">{fr.archivesIntro}</p>
        <a
          className="btn mt-3 inline-block"
          href={routeHash({ kind: 'today' }) || '#/'}
          data-testid="back-to-today"
        >
          {fr.backToToday}
        </a>
      </section>

      {index === null && (
        <Notice title={fr.loading}>
          <span className="sr-only">{fr.loading}</span>
        </Notice>
      )}
      {index?.kind === 'error' && (
        <Notice title={fr.archivesTitle}>
          <p data-testid="load-error">{fr.loadError}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {fr.retry}
          </button>
        </Notice>
      )}
      {index?.kind === 'ready' && dates.length === 0 && (
        <Notice title={fr.archivesTitle}>
          <p data-testid="archives-empty">{fr.archivesEmpty}</p>
        </Notice>
      )}
      {rows.length > 0 && (
        <>
          <ol className="flex flex-col gap-3" data-testid="archive-list">
            {rows.map((row) => (
              <Row key={row.date} row={row} />
            ))}
          </ol>
          <nav
            className="flex items-center justify-between gap-3"
            aria-label={fr.paginationLabel}
            data-testid="pagination"
            data-page={current.page}
            data-pages={current.pages}
          >
            {current.page > 1 ? (
              <a
                className="btn"
                rel="prev"
                href={routeHash({ kind: 'archives', page: current.page - 1 })}
                data-testid="previous-page"
              >
                {fr.pagePrevious}
              </a>
            ) : (
              <span className="btn pointer-events-none opacity-40" aria-disabled="true">
                {fr.pagePrevious}
              </span>
            )}
            <p className="text-sm" aria-current="page">
              {fr.pageOf(current.page, current.pages)}
            </p>
            {current.page < current.pages ? (
              <a
                className="btn"
                rel="next"
                href={routeHash({ kind: 'archives', page: current.page + 1 })}
                data-testid="next-page"
              >
                {fr.pageNext}
              </a>
            ) : (
              <span className="btn pointer-events-none opacity-40" aria-disabled="true">
                {fr.pageNext}
              </span>
            )}
          </nav>
        </>
      )}
    </Shell>
  );
}
