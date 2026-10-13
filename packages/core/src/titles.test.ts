import { describe, expect, it } from 'vitest';
import { SCORE_TITLES, TITLE_FLOORS, titleFor, type ScoreTitle } from './titles';

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
