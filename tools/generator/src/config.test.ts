import { CATEGORIES, CATEGORY_FAMILIES, DIFFICULTY_LEVELS } from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { categoryWeights, loadConfig, parseConfig } from './config';

const base = async () => structuredClone(await loadConfig());

describe('the shipped config', () => {
  it('is valid and follows the roadmap: 7 days per category, 30 per pair', async () => {
    const config = await loadConfig();
    expect(config.cooldown.categoryDays).toBe(7);
    expect(config.cooldown.pairDays).toBe(30);
    expect(config.cooldown.minCategoryDays).toBeLessThanOrEqual(7);
    for (const family of CATEGORY_FAMILIES) expect(config.familyWeights[family]).toBeGreaterThan(0);
  });

  it('climbs from easy on Monday to very hard on Sunday, with a single very hard day a week', async () => {
    const { weekdayLevels: levels } = await loadConfig();
    const rank = (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') =>
      Math.max(...(levels[day] ?? []).map((level) => DIFFICULTY_LEVELS.indexOf(level)));
    expect(rank('mon')).toBeLessThanOrEqual(1);
    expect(rank('mon')).toBeLessThan(rank('wed'));
    expect(rank('wed')).toBeLessThan(rank('fri'));
    expect(rank('fri')).toBeLessThanOrEqual(rank('sat'));
    expect(rank('sun')).toBe(DIFFICULTY_LEVELS.length - 1);
    const veryHardDays = Object.entries(levels).filter(([, list]) => list.includes('veryHard'));
    expect(veryHardDays.map(([day]) => day)).toEqual(['sun']);
  });
});

describe('parseConfig', () => {
  it('rejects unknown keys, missing families and bad numbers', async () => {
    const config = await base();
    expect(() => parseConfig({ ...config, surprise: 1 })).toThrow(/Invalid generator config/);
    const rest = Object.fromEntries(
      Object.entries(config.familyWeights).filter(([family]) => family !== 'type'),
    );
    expect(() => parseConfig({ ...config, familyWeights: rest })).toThrow(
      /Invalid generator config/,
    );
    expect(() => parseConfig({ ...config, bonusWeight: 0 })).toThrow(/Invalid generator config/);
    expect(() => parseConfig({ ...config, attemptsPerStage: 0 })).toThrow(
      /Invalid generator config/,
    );
    expect(() => parseConfig({ ...config, weekdayLevels: { mon: ['impossible'] } })).toThrow(
      /Invalid generator config/,
    );
    expect(() => parseConfig({ ...config, weekdayLevels: { mon: [] } })).toThrow(
      /Invalid generator config/,
    );
    expect(() => parseConfig({ ...config, weekdayLevels: { funday: ['easy'] } })).toThrow(
      /Invalid generator config/,
    );
  });

  it('rejects cooldowns that contradict themselves', async () => {
    const config = await base();
    expect(() =>
      parseConfig({ ...config, cooldown: { ...config.cooldown, minCategoryDays: 9 } }),
    ).toThrow(/minCategoryDays is above categoryDays/);
  });
});

describe('categoryWeights', () => {
  it('shares each family weight among its categories, so a big family is not drawn more for being big', async () => {
    const config = await base();
    const weights = categoryWeights(CATEGORIES, config);
    for (const family of CATEGORY_FAMILIES) {
      const total = CATEGORIES.filter((c) => c.family === family).reduce(
        (sum, c) => sum + (weights.get(c.id) ?? 0),
        0,
      );
      expect(total).toBeCloseTo(config.familyWeights[family], 10);
    }
  });

  it('weighs a bonus category below a regular one of its family', async () => {
    const weights = categoryWeights(CATEGORIES, await base());
    expect(weights.get('status-mythical')).toBeLessThan(weights.get('status-legendary') as number);
    expect(weights.get('evo-trade')).toBeLessThan(weights.get('evo-base') as number);
  });

  it('applies per-category tuning, relative to the family', async () => {
    const config = await base();
    const plain = categoryWeights(CATEGORIES, config);
    const tuned = categoryWeights(CATEGORIES, { ...config, categoryWeights: { 'type-fire': 3 } });
    expect(tuned.get('type-fire') as number).toBeGreaterThan(plain.get('type-fire') as number);
    expect(tuned.get('type-water') as number).toBeLessThan(plain.get('type-water') as number);
  });

  it('refuses a weight for a category that does not exist', async () => {
    const config = await base();
    expect(() =>
      categoryWeights(CATEGORIES, { ...config, categoryWeights: { 'type-sound': 2 } }),
    ).toThrow(/unknown category "type-sound"/);
  });
});
