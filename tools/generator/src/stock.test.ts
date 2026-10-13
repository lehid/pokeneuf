import { describe, expect, it } from 'vitest';
import { stockDays, stockEnd } from './stock';

describe('stockDays', () => {
  const days = (from: string, n: number, skip: string[] = []) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000);
      return d.toISOString().slice(0, 10);
    }).filter((d) => !skip.includes(d));

  it('counts the consecutive days from today, today included', () => {
    expect(stockDays(days('2026-11-01', 90), '2026-11-01')).toBe(90);
    expect(stockDays(days('2026-11-01', 90), '2026-12-01')).toBe(60);
  });

  it('ignores the past', () => {
    expect(stockDays(days('2026-11-01', 10), '2026-11-08')).toBe(3);
  });

  it('stops at the first missing day', () => {
    expect(stockDays(days('2026-11-01', 90, ['2026-11-20']), '2026-11-01')).toBe(19);
  });

  it('is empty when today has no grid, or when the stock ran out', () => {
    expect(stockDays([], '2026-11-01')).toBe(0);
    expect(stockDays(days('2026-11-01', 10), '2026-11-11')).toBe(0);
    expect(stockDays(days('2026-11-02', 10), '2026-11-01')).toBe(0);
  });

  it('crosses month and year ends', () => {
    expect(stockDays(days('2026-12-20', 30), '2026-12-20')).toBe(30);
  });
});

describe('stockEnd', () => {
  it('is the last day of the run', () => {
    expect(stockEnd(['2026-11-01', '2026-11-02', '2026-11-04'], '2026-11-01')).toBe('2026-11-02');
    expect(stockEnd([], '2026-11-01')).toBeNull();
  });
});
