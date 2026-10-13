import {
  CATEGORIES,
  CATEGORY_FAMILIES,
  checkGrid,
  daysBetween,
  type Category,
  type Grid,
  type Memberships,
} from '@pokeneuf/core';
import { WEEKDAYS, type GeneratorConfig } from './config';
import { weekdayOf } from './generate';
import { buildIndex, type GridIndex } from './files';

export interface CooldownFinding {
  kind: 'category' | 'pair';
  what: string;
  dates: [string, string];
  gap: number;
}

/**
 * Where a category (or a row × column pair) comes back sooner than allowed. Category repeats
 * under the target but at or over the configured floor are reported as `relaxed`, not as errors:
 * the generator shortens that cooldown on purpose when it has to.
 */
export function cooldownFindings(
  grids: readonly Grid[],
  config: GeneratorConfig,
): { relaxed: CooldownFinding[]; violations: CooldownFinding[] } {
  const relaxed: CooldownFinding[] = [];
  const violations: CooldownFinding[] = [];
  const sorted = [...grids].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i] as Grid;
      const b = sorted[j] as Grid;
      const gap = daysBetween(a.date, b.date);
      if (gap >= Math.max(config.cooldown.categoryDays, config.cooldown.pairDays)) break;

      if (gap < config.cooldown.categoryDays) {
        const shared = [...a.rows, ...a.cols].filter((id) => [...b.rows, ...b.cols].includes(id));
        for (const what of shared) {
          const finding: CooldownFinding = { kind: 'category', what, dates: [a.date, b.date], gap };
          (gap < config.cooldown.minCategoryDays ? violations : relaxed).push(finding);
        }
      }
      if (gap < config.cooldown.pairDays) {
        const pairsOf = (g: Grid) =>
          new Set(g.rows.flatMap((r) => g.cols.map((c) => [r, c].sort().join(' × '))));
        const second = pairsOf(b);
        for (const what of pairsOf(a)) {
          if (second.has(what))
            violations.push({ kind: 'pair', what, dates: [a.date, b.date], gap });
        }
      }
    }
  }
  return { relaxed, violations };
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
}

export interface GridReport {
  text: string;
  /** Rule breaks: the command fails when there are any. */
  problems: string[];
}

export function analyzeGrids(
  grids: readonly Grid[],
  memberships: Memberships,
  config: GeneratorConfig,
  index: GridIndex | null,
  categories: readonly Category[] = CATEGORIES,
): GridReport {
  const sorted = [...grids].sort((a, b) => a.date.localeCompare(b.date));
  const problems: string[] = [];
  for (const grid of sorted) problems.push(...checkGrid(grid, memberships, { categories }));

  // Dates: no gaps, no duplicates.
  const gaps: string[] = [];
  sorted.forEach((grid, i) => {
    const previous = sorted[i - 1];
    if (previous && daysBetween(previous.date, grid.date) !== 1) {
      gaps.push(`${previous.date} → ${grid.date}`);
    }
  });
  if (gaps.length > 0) problems.push(`missing days: ${gaps.join(', ')}`);

  const expectedIndex = buildIndex(sorted);
  if (index === null) problems.push('index.json is missing');
  else if (JSON.stringify(index) !== JSON.stringify(expectedIndex)) {
    problems.push('index.json does not list exactly the grid files');
  }

  const { relaxed, violations } = cooldownFindings(sorted, config);
  for (const v of violations) {
    problems.push(`${v.kind} "${v.what}" returns after ${v.gap} day(s): ${v.dates.join(' and ')}`);
  }

  const lines: string[] = [];
  const first = sorted[0];
  const last = sorted.at(-1);
  lines.push(
    sorted.length === 0
      ? 'No grid.'
      : `${sorted.length} grids, #${first?.id} (${first?.date}) to #${last?.id} (${last?.date})`,
  );

  if (sorted.length > 0) {
    const difficulty = sorted.map((g) => g.difficulty);
    lines.push(
      '',
      `Difficulty (0 easy - 100 hard): min ${Math.min(...difficulty)}, average ${average(difficulty).toFixed(0)}, max ${Math.max(...difficulty)}`,
      'By weekday:',
    );
    for (const day of [...WEEKDAYS.slice(1), WEEKDAYS[0]]) {
      const values = sorted.filter((g) => weekdayOf(g.date) === day).map((g) => g.difficulty);
      const target = config.weekdayDifficulty[day];
      const outside = target ? values.filter((v) => v < target[0] || v > target[1]).length : 0;
      if (outside > 0)
        problems.push(
          `${outside} ${day} grid(s) outside the difficulty target ${target?.join('-')}`,
        );
      lines.push(
        `  ${day}: ${values.length} grids, ` +
          (values.length === 0
            ? '-'
            : `average ${average(values).toFixed(0)}, ${Math.min(...values)}-${Math.max(...values)}`) +
          (target ? `  (target ${target[0]}-${target[1]})` : ''),
      );
    }

    const sizes = sorted.flatMap((g) => g.cellSizes);
    lines.push(
      '',
      `Cells: ${sizes.length}, answers per cell min ${Math.min(...sizes)}, median ${median(sizes)}, max ${Math.max(...sizes)}; ` +
        `${sizes.filter((s) => s <= 5).length} cells have 5 answers or fewer`,
    );

    const uses = new Map<string, number>(categories.map((c) => [c.id, 0]));
    for (const g of sorted)
      for (const id of [...g.rows, ...g.cols]) uses.set(id, (uses.get(id) ?? 0) + 1);
    const ranked = [...uses].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
    const never = ranked.filter(([, n]) => n === 0).map(([id]) => id);
    lines.push(
      '',
      `Categories: ${ranked.length - never.length} of ${ranked.length} used`,
      `  most:  ${ranked
        .slice(0, 5)
        .map(([id, n]) => `${id} ${n}`)
        .join(', ')}`,
      `  least: ${ranked
        .filter(([, n]) => n > 0)
        .slice(-5)
        .reverse()
        .map(([id, n]) => `${id} ${n}`)
        .join(', ')}`,
      `  never: ${never.length === 0 ? 'none' : never.join(', ')}`,
    );

    const familyOf = new Map(categories.map((c) => [c.id, c.family]));
    const perFamily = new Map<string, number>();
    for (const [id, n] of uses)
      perFamily.set(
        familyOf.get(id) as string,
        (perFamily.get(familyOf.get(id) as string) ?? 0) + n,
      );
    const total = [...perFamily.values()].reduce((s, n) => s + n, 0);
    lines.push(
      'Families: ' +
        CATEGORY_FAMILIES.map(
          (f) => `${f} ${(((perFamily.get(f) ?? 0) / total) * 100).toFixed(0)}%`,
        ).join(', '),
    );

    const byGap = new Map<number, number>();
    for (const r of relaxed) byGap.set(r.gap, (byGap.get(r.gap) ?? 0) + 1);
    lines.push(
      '',
      relaxed.length === 0
        ? `Category cooldown (${config.cooldown.categoryDays} days): always respected`
        : `Category cooldown (target ${config.cooldown.categoryDays} days, floor ${config.cooldown.minCategoryDays}): came back early ${relaxed.length} time(s) — ` +
            [...byGap]
              .sort(([a], [b]) => a - b)
              .map(([gap, n]) => `${n}× at ${gap} days`)
              .join(', '),
      `Pair cooldown (${config.cooldown.pairDays} days): ${violations.some((v) => v.kind === 'pair') ? 'BROKEN' : 'respected'}`,
    );
  }

  lines.push(
    '',
    problems.length === 0 ? 'No problem found.' : `${problems.length} problem(s):`,
    ...problems.map((p) => `  ! ${p}`),
  );
  return { text: lines.join('\n'), problems };
}
