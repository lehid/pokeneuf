import { describe, expect, it } from 'vitest';
import {
  SCORE_TITLES,
  scoreShare,
  TITLE_FLOORS,
  titleFor,
  titleMarks,
  type ScoreTitle,
} from './titles';

describe('titleFor', () => {
  it('cuts at 300, 500, 700 and 850, each floor belonging to its own title', () => {
    const expected: [number, ScoreTitle][] = [
      [0, 'curious'],
      [299, 'curious'],
      [300, 'trainer'],
      [499, 'trainer'],
      [500, 'expert'],
      [699, 'expert'],
      [700, 'champion'],
      [849, 'champion'],
      [850, 'legend'],
      [900, 'legend'],
    ];
    for (const [score, title] of expected) expect(titleFor(score), String(score)).toBe(title);
  });

  it('stays within the five titles whatever the score', () => {
    expect(titleFor(-50)).toBe('curious');
    expect(titleFor(5000)).toBe('legend');
  });

  it('has increasing floors, starting at 0 and below the maximum score', () => {
    const floors = SCORE_TITLES.map((t) => TITLE_FLOORS[t]);
    expect(floors[0]).toBe(0);
    expect([...floors].sort((a, b) => a - b)).toEqual(floors);
    expect(new Set(floors).size).toBe(floors.length);
    expect(Math.max(...floors)).toBeLessThan(900);
  });
});

describe('scoreShare and titleMarks', () => {
  it('place a score on the 0–900 scale, clamped', () => {
    expect(scoreShare(0)).toBe(0);
    expect(scoreShare(450)).toBe(0.5);
    expect(scoreShare(900)).toBe(1);
    expect(scoreShare(-20)).toBe(0);
    expect(scoreShare(1200)).toBe(1);
  });

  it('mark where every title starts, in order, from 0', () => {
    const marks = titleMarks();
    expect(marks.map((m) => m.title)).toEqual([...SCORE_TITLES]);
    expect(marks[0]?.share).toBe(0);
    expect(marks.map((m) => m.share)).toEqual([...marks.map((m) => m.share)].sort((a, b) => a - b));
    expect(marks.find((m) => m.title === 'trainer')?.share).toBeCloseTo(300 / 900);
    expect(marks.find((m) => m.title === 'legend')?.share).toBeCloseTo(850 / 900);
  });
});
