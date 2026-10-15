import { addDays } from '@pokeneuf/core';
import { describe, expect, it } from 'vitest';
import { MIN_STOCK_DAYS, stockDays, stockEnd, stockStart } from './stock';

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

describe('before the launch', () => {
  const dates = Array.from({ length: 90 }, (_, i) => addDays('2026-11-01', i));

  it('counts from the launch day, not from today: no false alert while waiting for the launch', () => {
    expect(stockStart('2026-10-14')).toBe('2026-11-01');
    expect(stockStart('2026-11-01')).toBe('2026-11-01');
    expect(stockStart('2026-11-05')).toBe('2026-11-05');
    expect(stockDays(dates, '2026-10-14')).toBe(90);
    expect(stockDays(dates, '2026-10-14')).toBeGreaterThanOrEqual(MIN_STOCK_DAYS);
    expect(stockEnd(dates, '2026-10-14')).toBe('2027-01-29');
  });

  it('is empty before the launch when there is no grid for the launch day', () => {
    expect(stockDays([], '2026-10-14')).toBe(0);
    expect(stockDays(dates.slice(1), '2026-10-14')).toBe(0);
  });

  it('alerts under 45 days, the default minimum', () => {
    expect(MIN_STOCK_DAYS).toBe(45);
    expect(stockDays(dates.slice(0, 44), '2026-11-01')).toBeLessThan(MIN_STOCK_DAYS);
  });
});

describe('stockEnd', () => {
  it('is the last day of the run', () => {
    expect(stockEnd(['2026-11-01', '2026-11-02', '2026-11-04'], '2026-11-01')).toBe('2026-11-02');
    expect(stockEnd([], '2026-11-01')).toBeNull();
  });
});
