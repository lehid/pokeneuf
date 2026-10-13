import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, weightedIndex } from './rng';

describe('hashString', () => {
  it('is stable (these values must never change: they seed the published grids)', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('pokeneuf:grid:2026-11-01')).toBe(hashString('pokeneuf:grid:2026-11-01'));
  });

  it('tells different inputs apart and stays in 32 bits', () => {
    const hashes = new Set(Array.from({ length: 1000 }, (_, i) => hashString(`2026-11-${i}`)));
    expect(hashes.size).toBe(1000);
    for (const h of hashes) expect(h).toBeGreaterThanOrEqual(0);
    for (const h of hashes) expect(h).toBeLessThan(2 ** 32);
  });
});

describe('mulberry32', () => {
  it('gives the same sequence for the same seed, a different one otherwise', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const sequence = (r: () => number) => Array.from({ length: 5 }, r);
    expect(sequence(a)).toEqual(sequence(b));
    expect(sequence(mulberry32(42))).not.toEqual(sequence(c));
  });

  it('stays in [0, 1) and looks uniform', () => {
    const random = mulberry32(1);
    const values = Array.from({ length: 20000 }, random);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
    const buckets = Array(10).fill(0) as number[];
    for (const v of values) buckets[Math.floor(v * 10)] = (buckets[Math.floor(v * 10)] ?? 0) + 1;
    for (const count of buckets) expect(count).toBeGreaterThan(1700);
  });
});

describe('weightedIndex', () => {
  it('follows the weights', () => {
    const random = mulberry32(5);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i++) {
      const picked = weightedIndex([1, 2, 7], random);
      counts[picked] = (counts[picked] ?? 0) + 1;
    }
    const [low = 0, mid = 0, high = 0] = counts;
    expect(low / 30000).toBeCloseTo(0.1, 1);
    expect(mid / 30000).toBeCloseTo(0.2, 1);
    expect(high / 30000).toBeCloseTo(0.7, 1);
  });

  it('never picks an index out of range, even when rounding eats the last bit', () => {
    expect(weightedIndex([1], () => 0.999999999)).toBe(0);
    expect(weightedIndex([0.1, 0.2], () => 0.9999999999999999)).toBe(1);
  });

  it('is deterministic for a given random source', () => {
    expect(weightedIndex([1, 1, 1, 1], () => 0.6)).toBe(2);
  });
});
