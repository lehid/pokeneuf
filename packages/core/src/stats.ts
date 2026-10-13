import { addDays, type GridDate } from './date';
import { SCORING } from './scoring';
import type { HistoryEntry } from './storage';

/** Width of a bar of the score distribution. */
export const DISTRIBUTION_STEP = 100;

export interface Stats {
  played: number;
  won: number;
  /** 0 to 100, rounded; 0 when nothing was played. */
  winRate: number;
  averageScore: number;
  bestScore: number;
  /** Games per score bucket: 0-99, 100-199, … 800-900 (the top bucket includes the maximum). */
  distribution: number[];
  /** Consecutive days played up to today (or up to yesterday while today is still to play). */
  streak: number;
  maxStreak: number;
}

/**
 * Days that keep a streak alive: a game played to its end, won or lost. An abandoned game does not
 * count, and neither do archives (they never reach the history).
 */
function streakDates(entries: readonly HistoryEntry[]): Set<GridDate> {
  return new Set(entries.filter((e) => e.status !== 'abandoned').map((e) => e.date));
}

/** The current streak. It survives until the end of today: yesterday played, today not yet. */
export function currentStreak(entries: readonly HistoryEntry[], today: GridDate): number {
  const days = streakDates(entries);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(entries: readonly HistoryEntry[]): number {
  const days = [...streakDates(entries)].sort();
  let best = 0;
  let run = 0;
  let previous: GridDate | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export function computeStats(entries: readonly HistoryEntry[], today: GridDate): Stats {
  const played = entries.length;
  const won = entries.filter((e) => e.status === 'won').length;
  const buckets = Math.ceil(SCORING.maxScore / DISTRIBUTION_STEP);
  const distribution = Array<number>(buckets).fill(0);
  for (const { score } of entries) {
    const bucket = Math.min(buckets - 1, Math.floor(score / DISTRIBUTION_STEP));
    distribution[bucket] = (distribution[bucket] ?? 0) + 1;
  }
  return {
    played,
    won,
    winRate: played === 0 ? 0 : Math.round((100 * won) / played),
    averageScore:
      played === 0 ? 0 : Math.round(entries.reduce((sum, e) => sum + e.score, 0) / played),
    bestScore: entries.reduce((best, e) => Math.max(best, e.score), 0),
    distribution,
    streak: currentStreak(entries, today),
    maxStreak: longestStreak(entries),
  };
}
