import { SCORING } from './scoring';

/**
 * The title shown with a score: a landmark for the player, from the scoring bands (ROADMAP §3.5).
 * A typical finished game lands on `trainer` or `expert`; `legend` is for the very best.
 */
export const SCORE_TITLES = ['curious', 'trainer', 'expert', 'champion', 'legend'] as const;
export type ScoreTitle = (typeof SCORE_TITLES)[number];

/** First score of each title, from the lowest. */
export const TITLE_FLOORS: Readonly<Record<ScoreTitle, number>> = {
  curious: 0,
  trainer: 300,
  expert: 500,
  champion: 700,
  legend: 850,
};

export function titleFor(score: number): ScoreTitle {
  const clamped = Math.min(SCORING.maxScore, Math.max(0, score));
  let title: ScoreTitle = 'curious';
  for (const candidate of SCORE_TITLES) {
    if (clamped >= TITLE_FLOORS[candidate]) title = candidate;
  }
  return title;
}
