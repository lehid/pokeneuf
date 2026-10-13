import {
  LAUNCH_DATE,
  MAX_ERRORS,
  MAX_SCORE,
  type Grid,
  type Memberships,
  type Popularity,
} from '@pokeneuf/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { createGenerator, dateRange } from './generate';
import { mulberry32 } from './rng';
import { formatSimulation, PROFILES, playGame, simulate, TARGET_BAND } from './simulate';
import { realWorld } from './test-world';

let memberships: Memberships;
let popularity: Popularity;
let grids: Grid[];

beforeAll(async () => {
  ({ memberships, popularity } = await realWorld());
  const generate = createGenerator({ memberships, popularity, config: await loadConfig() });
  grids = [];
  for (const date of dateRange(LAUNCH_DATE, 14))
    grids.push(generate({ date, history: grids }).grid);
}, 120_000);

describe('playGame', () => {
  it('never finds more than 9 cells, makes at most 3 mistakes and stays within the score bounds', () => {
    const random = mulberry32(5);
    for (const grid of grids) {
      for (const { skill } of PROFILES) {
        const game = playGame(grid, memberships, popularity, skill, random);
        expect(game.found).toBeGreaterThanOrEqual(0);
        expect(game.found).toBeLessThanOrEqual(9);
        expect(game.errors).toBeLessThanOrEqual(MAX_ERRORS);
        expect(game.score).toBeGreaterThanOrEqual(0);
        expect(game.score).toBeLessThanOrEqual(MAX_SCORE);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const play = () => playGame(grids[0] as Grid, memberships, popularity, 0.8, mulberry32(9));
    expect(play()).toEqual(play());
  });

  it('knows nothing, and loses at once, when nothing comes to mind', () => {
    const game = playGame(grids[0] as Grid, memberships, popularity, 0, mulberry32(1));
    expect(game).toEqual({ found: 0, errors: MAX_ERRORS, score: 0 });
  });
});

describe('simulate', () => {
  const summaries = () => simulate({ grids, memberships, popularity, gamesPerGrid: 15, seed: 3 });

  it('is deterministic', () => {
    expect(summaries()).toEqual(summaries());
  });

  it('scores better players higher, at every level of difficulty they share', () => {
    const [casual, regular, fan] = summaries();
    expect(casual && regular && fan).toBeTruthy();
    expect(casual?.median).toBeLessThan(regular?.median ?? 0);
    expect(regular?.median).toBeLessThan(fan?.median ?? 0);
    for (const level of fan?.levels ?? []) {
      const weaker = casual?.levels.find((l) => l.level === level.level);
      if (weaker) expect(weaker.averageScore).toBeLessThanOrEqual(level.averageScore);
    }
  });

  it('finds fewer cells, and wins less often, on harder grids', () => {
    const regular = summaries().find((s) => s.profile.name === 'regular');
    const easy = regular?.levels.find((l) => l.level === 'veryEasy');
    const hard = regular?.levels.find((l) => l.level === 'veryHard');
    expect(easy && hard).toBeTruthy();
    expect(hard?.averageFound).toBeLessThan(easy?.averageFound ?? 0);
    expect(hard?.winRate).toBeLessThan(easy?.winRate ?? 0);
  });

  it('keeps the quantiles in order', () => {
    for (const s of summaries()) {
      expect(s.p10).toBeLessThanOrEqual(s.median);
      expect(s.median).toBeLessThanOrEqual(s.p90);
      expect(s.p90).toBeLessThanOrEqual(s.p99);
    }
  });
});

describe('the scoring bands', () => {
  it('put a regular player around the middle and a fan close to the top (the target of the owner)', () => {
    const big = simulate({ grids, memberships, popularity, gamesPerGrid: 60, seed: 11 });
    const regular = big.find((s) => s.profile.name === 'regular');
    const fan = big.find((s) => s.profile.name === 'fan');
    const [low, high] = TARGET_BAND.median;
    expect(regular?.median).toBeGreaterThanOrEqual(low);
    expect(regular?.median).toBeLessThanOrEqual(high);
    expect(fan?.p99).toBeGreaterThanOrEqual(TARGET_BAND.excellentFrom);
    expect(fan?.p99).toBeLessThan(MAX_SCORE);
  });

  it('are reported with their target', () => {
    const text = formatSimulation(
      simulate({ grids, memberships, popularity, gamesPerGrid: 10, seed: 3 }),
    );
    expect(text).toContain('== casual');
    expect(text).toContain('veryHard');
    expect(text).toMatch(/Target: regular median in 450-600 → \d+ (OK|OUT OF BAND)/);
    expect(text).toMatch(/Target: fan p99 from 700 → \d+ (OK|OUT OF BAND)/);
  });
});
