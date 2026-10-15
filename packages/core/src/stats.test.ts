import { describe, expect, it } from 'vitest';
import { computeStats, currentStreak, longestStreak } from './stats';
import type { HistoryEntry } from './storage';

let id = 0;
const game = (
  date: string,
  status: HistoryEntry['status'] = 'won',
  score = 500,
  found = 9,
  errors = 0,
): HistoryEntry => ({ gridId: ++id, date, status, found, errors, score });

describe('currentStreak', () => {
  it('counts consecutive days played up to today', () => {
    const history = [game('2026-11-01'), game('2026-11-02'), game('2026-11-03')];
    expect(currentStreak(history, '2026-11-03')).toBe(3);
  });

  it('is still alive while today is not played yet', () => {
    const history = [game('2026-11-01'), game('2026-11-02')];
    expect(currentStreak(history, '2026-11-03')).toBe(2);
  });

  it('is broken by a missed day', () => {
    const history = [game('2026-11-01'), game('2026-11-02')];
    expect(currentStreak(history, '2026-11-04')).toBe(0);
    expect(currentStreak([game('2026-11-01'), game('2026-11-03')], '2026-11-03')).toBe(1);
  });

  it('counts lost games but not abandoned ones', () => {
    const history = [
      game('2026-11-01'),
      game('2026-11-02', 'lost', 60),
      game('2026-11-03', 'abandoned', 0),
    ];
    expect(currentStreak(history, '2026-11-02')).toBe(2);
    expect(currentStreak(history, '2026-11-04')).toBe(0); // the abandoned 3rd broke the chain
  });

  it('drops to 0 as soon as today is abandoned, not tomorrow (showing 2 would lie)', () => {
    const history = [
      game('2026-11-01'),
      game('2026-11-02'),
      game('2026-11-03', 'abandoned', 0, 0, 0),
    ];
    expect(currentStreak(history, '2026-11-03')).toBe(0);
    // Before the abandon, the same chain was alive at 2.
    expect(currentStreak(history.slice(0, 2), '2026-11-03')).toBe(2);
  });

  it('is not hidden by an abandoned game of the past', () => {
    const history = [game('2026-11-01', 'abandoned', 0, 0, 0), game('2026-11-02')];
    expect(currentStreak(history, '2026-11-02')).toBe(1);
  });

  it('crosses month and year ends', () => {
    const history = [game('2026-12-30'), game('2026-12-31'), game('2027-01-01')];
    expect(currentStreak(history, '2027-01-01')).toBe(3);
  });

  it('is 0 without history', () => {
    expect(currentStreak([], '2026-11-01')).toBe(0);
  });
});

describe('longestStreak', () => {
  it('is the longest run of consecutive days', () => {
    const history = [
      game('2026-11-01'),
      game('2026-11-02'),
      game('2026-11-05'),
      game('2026-11-06'),
      game('2026-11-07'),
    ];
    expect(longestStreak(history)).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe('computeStats', () => {
  it('is all zeros with no game', () => {
    expect(computeStats([], '2026-11-01')).toEqual({
      played: 0,
      won: 0,
      winRate: 0,
      averageScore: 0,
      bestScore: 0,
      distribution: Array(9).fill(0),
      streak: 0,
      maxStreak: 0,
    });
  });

  it('summarises the games', () => {
    const history = [
      game('2026-11-01', 'won', 684),
      game('2026-11-02', 'lost', 120, 2, 3),
      game('2026-11-03', 'abandoned', 0, 0, 0),
      game('2026-11-04', 'won', 900),
    ];
    const stats = computeStats(history, '2026-11-04');
    expect(stats.played).toBe(4);
    expect(stats.won).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.averageScore).toBe(426); // (684 + 120 + 0 + 900) / 4
    expect(stats.bestScore).toBe(900);
    expect(stats.streak).toBe(1); // the abandoned day of the 3rd broke it
    expect(stats.maxStreak).toBe(2);
  });

  it('spreads the scores in buckets of 100, the maximum in the last one', () => {
    const history = [
      game('2026-11-01', 'lost', 0),
      game('2026-11-02', 'lost', 99),
      game('2026-11-03', 'lost', 100),
      game('2026-11-04', 'won', 899),
      game('2026-11-05', 'won', 900),
    ];
    expect(computeStats(history, '2026-11-05').distribution).toEqual([2, 1, 0, 0, 0, 0, 0, 0, 2]);
  });

  it('rounds the win rate', () => {
    const history = [
      game('2026-11-01', 'won'),
      game('2026-11-02', 'lost'),
      game('2026-11-03', 'lost'),
    ];
    expect(computeStats(history, '2026-11-03').winRate).toBe(33);
  });
});
