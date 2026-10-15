import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_PAGE_SIZE,
  archiveDates,
  archiveRow,
  archiveStatus,
  endedOnItsDay,
  paginate,
} from './archives';
import { gridDateFor, hasNewGrid } from './date';
import type { GameSummary } from './storage';

const playing: GameSummary = { status: 'playing', found: 3, finishedOn: null, score: null };
const done = (finishedOn: string, score = 500): GameSummary => ({
  status: 'lost',
  found: 5,
  finishedOn,
  score,
});

describe('archiveDates', () => {
  const published = Array.from(
    { length: 10 },
    (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`,
  );

  it('lists the days that are over, the newest first, never today or the future', () => {
    expect(archiveDates(published, '2026-11-05')).toEqual([
      '2026-11-04',
      '2026-11-03',
      '2026-11-02',
      '2026-11-01',
    ]);
    expect(archiveDates(published, '2026-11-01')).toEqual([]);
    expect(archiveDates(published, '2026-10-20')).toEqual([]);
  });

  it('never shows a grid of the future, even when it is published', () => {
    const dates = archiveDates(published, '2026-11-07');
    expect(dates.every((d) => d < '2026-11-07')).toBe(true);
    expect(dates).not.toContain('2026-11-10');
  });

  it('does not list tomorrow, which the site publishes the evening before (today + 1)', () => {
    const index = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']; // today is the 3rd
    expect(archiveDates(index, '2026-11-03')).toEqual(['2026-11-02', '2026-11-01']);
    // The day after the launch's eve: the first grid is public, but nothing is playable yet.
    expect(archiveDates(['2026-11-01'], '2026-10-31')).toEqual([]);
  });

  it("does not tell a tab to switch to tomorrow's grid before Paris midnight", () => {
    // 2026-11-03 23:59 in Paris (winter time, UTC+1) is 22:59 UTC; tomorrow's grid is already online.
    expect(hasNewGrid('2026-11-03', new Date('2026-11-03T22:59:00Z'))).toBe(false);
    expect(hasNewGrid('2026-11-03', new Date('2026-11-03T23:00:00Z'))).toBe(true);
    expect(gridDateFor(new Date('2026-11-03T22:59:00Z'))).toBe('2026-11-03');
  });

  it('ignores duplicates and dates before the launch', () => {
    expect(archiveDates(['2026-11-02', '2026-11-02', '2026-10-01'], '2026-11-05')).toEqual([
      '2026-11-02',
    ]);
  });

  it('does not change what it is given', () => {
    const input = [...published];
    archiveDates(input, '2026-11-08');
    expect(input).toEqual(published);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('cuts a list in pages of 10', () => {
    expect(ARCHIVE_PAGE_SIZE).toBe(10);
    expect(paginate(items, 1)).toEqual({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      page: 1,
      pages: 3,
      total: 25,
    });
    expect(paginate(items, 3).items).toEqual([21, 22, 23, 24, 25]);
    expect(paginate(items, 2).items[0]).toBe(11);
  });

  it('falls back to the nearest page that exists', () => {
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -4).page).toBe(1);
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 2.7).page).toBe(2);
    expect(paginate(items, Number.NaN).page).toBe(1);
  });

  it('has one page, empty, for an empty list; an exact multiple has no extra page', () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
    expect(paginate(items.slice(0, 20), 2).pages).toBe(2);
    expect(paginate(items.slice(0, 20), 2).items).toHaveLength(10);
  });
});

describe('archiveStatus', () => {
  const day = '2026-11-05';

  it('tells never played, in progress, finished that day and finished later', () => {
    expect(archiveStatus(null, day)).toBe('unplayed');
    expect(archiveStatus(playing, day)).toBe('inProgress');
    expect(archiveStatus(done(day), day)).toBe('dailyDone');
    expect(archiveStatus(done('2026-11-06'), day)).toBe('archiveDone');
    expect(archiveStatus(done('2027-01-01'), day)).toBe('archiveDone');
  });

  it('keeps a daily game "finished in daily" the day after: the end date does not move', () => {
    const game = done(day);
    expect(archiveStatus(game, day)).toBe('dailyDone');
    expect(endedOnItsDay(game.finishedOn, day)).toBe(true);
  });

  it('counts a game that ends after midnight as an archive, even if it began on the day', () => {
    // Began on the 5th (in progress), ended on the 6th.
    expect(archiveStatus(playing, day)).toBe('inProgress');
    expect(archiveStatus(done('2026-11-06'), day)).toBe('archiveDone');
    expect(endedOnItsDay('2026-11-06', day)).toBe(false);
    expect(endedOnItsDay(null, day)).toBe(false);
  });
});

describe('archiveRow', () => {
  it('shows the score of a finished game only', () => {
    expect(archiveRow('2026-11-05', done('2026-11-05', 412))).toEqual({
      date: '2026-11-05',
      id: 5,
      status: 'dailyDone',
      score: 412,
      found: 5,
    });
    expect(archiveRow('2026-11-05', playing)).toMatchObject({
      status: 'inProgress',
      score: null,
      found: 3,
    });
    expect(archiveRow('2026-11-05', null)).toMatchObject({
      status: 'unplayed',
      score: null,
      found: 0,
    });
  });

  it('has no score when an old save did not have one', () => {
    expect(archiveRow('2026-11-05', { ...done('2026-11-05'), score: null }).score).toBeNull();
  });
});
