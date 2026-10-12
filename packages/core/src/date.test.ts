import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, gridDateFor, gridNumber } from './date';

describe('gridDateFor (Europe/Paris)', () => {
  it('switches at Paris midnight in summer time (UTC+2)', () => {
    expect(gridDateFor(new Date('2026-10-12T21:59:59Z'))).toBe('2026-10-12');
    expect(gridDateFor(new Date('2026-10-12T22:00:00Z'))).toBe('2026-10-13');
  });

  it('switches at Paris midnight in winter time (UTC+1)', () => {
    expect(gridDateFor(new Date('2026-12-01T22:59:59Z'))).toBe('2026-12-01');
    expect(gridDateFor(new Date('2026-12-01T23:00:00Z'))).toBe('2026-12-02');
  });

  it('handles the October DST change (25 Oct 2026)', () => {
    // 03:00 CEST -> 02:00 CET happens on 2026-10-25 at 01:00 UTC.
    expect(gridDateFor(new Date('2026-10-24T21:59:59Z'))).toBe('2026-10-24');
    expect(gridDateFor(new Date('2026-10-24T22:00:00Z'))).toBe('2026-10-25');
    expect(gridDateFor(new Date('2026-10-25T22:59:59Z'))).toBe('2026-10-25');
    expect(gridDateFor(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });

  it('handles the March DST change (29 Mar 2026)', () => {
    expect(gridDateFor(new Date('2026-03-28T22:59:59Z'))).toBe('2026-03-28');
    expect(gridDateFor(new Date('2026-03-28T23:00:00Z'))).toBe('2026-03-29');
    expect(gridDateFor(new Date('2026-03-29T21:59:59Z'))).toBe('2026-03-29');
    expect(gridDateFor(new Date('2026-03-29T22:00:00Z'))).toBe('2026-03-30');
  });
});

describe('date helpers', () => {
  it('counts days across month and year boundaries', () => {
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-01', '2026-10-31')).toBe(-1);
  });

  it('numbers grids from the launch date', () => {
    expect(gridNumber('2026-11-01', '2026-11-01')).toBe(1);
    expect(gridNumber('2026-11-10', '2026-11-01')).toBe(10);
    expect(gridNumber('2026-10-31', '2026-11-01')).toBe(0);
  });

  it('adds days', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('rejects malformed dates', () => {
    expect(() => daysBetween('2026-1-1', '2026-01-02')).toThrow();
  });
});
