import { CATEGORIES, CATEGORY_FAMILIES } from '@pokeneuf/core';
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

  it('makes weekdays easier early in the week and harder at the weekend', async () => {
    const { weekdayDifficulty: d } = await loadConfig();
    const top = (day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') => d[day]?.[1] ?? 100;
    expect(top('mon')).toBeLessThan(top('wed'));
    expect(top('wed')).toBeLessThan(top('fri'));
    expect(top('fri')).toBeLessThanOrEqual(top('sat'));
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
    expect(() => parseConfig({ ...config, weekdayDifficulty: { mon: [0, 101] } })).toThrow(
      /Invalid generator config/,
    );
    expect(() => parseConfig({ ...config, weekdayDifficulty: { funday: [0, 10] } })).toThrow(
      /Invalid generator config/,
    );
  });

  it('rejects ranges and cooldowns that contradict themselves', async () => {
    const config = await base();
    expect(() => parseConfig({ ...config, weekdayDifficulty: { mon: [60, 40] } })).toThrow(
      /min is above max/,
    );
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
