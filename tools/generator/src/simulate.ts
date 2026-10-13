import {
  cellAnswers,
  gridDifficulty,
  DIFFICULTY_LEVELS,
  pointsFor,
  rankScore,
  totalScore,
  MAX_ERRORS,
  type DifficultyLevel,
  type Grid,
  type Memberships,
  type Popularity,
} from '@pokeneuf/core';
import { mulberry32, type Random } from './rng';

/**
 * A rough model of players, to see where the score lands (ROADMAP §3.5): it is a way to compare
 * settings of `SCORING` and `POPULARITY_WEIGHTS`, not a measure of real players.
 *
 * A player visits the cells in random order. For each cell, every valid answer comes to mind with
 * a probability that grows with its popularity and with the player's `skill`; one of the answers
 * that came to mind is chosen, the better known the more likely. If nothing comes to mind, that is
 * a mistake. Three mistakes end the game.
 */
export interface Profile {
  name: string;
  skill: number;
}

export const PROFILES: readonly Profile[] = [
  { name: 'casual', skill: 0.55 },
  { name: 'regular', skill: 0.8 },
  { name: 'fan', skill: 1.1 },
];

/** Where a typical game should land, in the owner's words: about half the points. */
export const TARGET_BAND = {
  /** Median score of the regular profile. */
  median: [450, 600],
  /** The 99th percentile of the fan profile is "excellent" but not the maximum. */
  excellentFrom: 700,
} as const;

export interface PlayedGame {
  found: number;
  errors: number;
  score: number;
}

export function playGame(
  grid: Grid,
  memberships: Memberships,
  popularity: Popularity,
  skill: number,
  random: Random,
): PlayedGame {
  const answers = cellAnswers(grid, memberships);
  const order = answers.map((_, i) => i).sort(() => random() - 0.5);
  const used = new Set<number>();
  const points: number[] = [];
  let errors = 0;
  for (const cell of order) {
    if (errors >= MAX_ERRORS) break;
    const valid = answers[cell] ?? [];
    const known = valid.filter(
      (id) => !used.has(id) && random() < Math.min(1, skill * popularity(id) ** 0.8 * 1.6),
    );
    if (known.length === 0) {
      errors++;
      continue;
    }
    const weights = known.map((id) => popularity(id) ** 0.5);
    let target = random() * weights.reduce((a, b) => a + b, 0);
    let pick = known[0] ?? 0;
    for (const [i, id] of known.entries()) {
      target -= weights[i] ?? 0;
      if (target <= 0) {
        pick = id;
        break;
      }
    }
    used.add(pick);
    points.push(pointsFor(rankScore(pick, valid, popularity)));
  }
  return { found: points.length, errors, score: totalScore(points, errors) };
}

export interface LevelSummary {
  level: DifficultyLevel;
  games: number;
  averageFound: number;
  winRate: number;
  averageScore: number;
}

export interface ProfileSummary {
  profile: Profile;
  levels: LevelSummary[];
  /** Quantiles of the score over every game of the profile. */
  p10: number;
  median: number;
  p90: number;
  p99: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function simulate(options: {
  grids: readonly Grid[];
  memberships: Memberships;
  popularity: Popularity;
  profiles?: readonly Profile[];
  gamesPerGrid?: number;
  seed?: number;
}): ProfileSummary[] {
  const { grids, memberships, popularity } = options;
  const gamesPerGrid = options.gamesPerGrid ?? 40;
  const levelOf = new Map(
    grids.map((g) => [g.date, gridDifficulty(g, memberships, popularity).level]),
  );

  return (options.profiles ?? PROFILES).map((profile) => {
    const random = mulberry32((options.seed ?? 11) + Math.round(profile.skill * 1000));
    const all: PlayedGame[] = [];
    const levels: LevelSummary[] = [];
    for (const level of DIFFICULTY_LEVELS) {
      const games = grids
        .filter((g) => levelOf.get(g.date) === level)
        .flatMap((g) =>
          Array.from({ length: gamesPerGrid }, () =>
            playGame(g, memberships, popularity, profile.skill, random),
          ),
        );
      all.push(...games);
      if (games.length === 0) continue;
      const mean = (pick: (g: PlayedGame) => number) =>
        games.reduce((s, g) => s + pick(g), 0) / games.length;
      levels.push({
        level,
        games: games.length,
        averageFound: round1(mean((g) => g.found)),
        winRate: Math.round((100 * games.filter((g) => g.found === 9).length) / games.length),
        averageScore: Math.round(mean((g) => g.score)),
      });
    }
    const sorted = all.map((g) => g.score).sort((a, b) => a - b);
    const at = (p: number) => sorted[Math.floor(p * (sorted.length - 1))] ?? 0;
    return { profile, levels, p10: at(0.1), median: at(0.5), p90: at(0.9), p99: at(0.99) };
  });
}

export function formatSimulation(summaries: readonly ProfileSummary[]): string {
  const lines: string[] = [];
  for (const { profile, levels, p10, median, p90, p99 } of summaries) {
    lines.push(`== ${profile.name} (skill ${profile.skill}) ==`);
    for (const l of levels) {
      lines.push(
        `  ${l.level.padEnd(9)} found ${l.averageFound.toFixed(1)}/9, wins ${String(l.winRate).padStart(3)} %, average score ${l.averageScore}`,
      );
    }
    lines.push(`  all: p10 ${p10}, median ${median}, p90 ${p90}, p99 ${p99}`, '');
  }
  const regular = summaries.find((s) => s.profile.name === 'regular');
  const fan = summaries.find((s) => s.profile.name === 'fan');
  if (regular && fan) {
    const [low, high] = TARGET_BAND.median;
    const inBand = regular.median >= low && regular.median <= high;
    lines.push(
      `Target: regular median in ${low}-${high} → ${regular.median} ${inBand ? 'OK' : 'OUT OF BAND'}`,
      `Target: fan p99 from ${TARGET_BAND.excellentFrom} → ${fan.p99} ${fan.p99 >= TARGET_BAND.excellentFrom ? 'OK' : 'OUT OF BAND'}`,
    );
  }
  return lines.join('\n');
}
