import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  gridDateFor,
  gridNumber,
  gridUrl,
  hasNewGrid,
  isBeforeLaunch,
} from './date';

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

describe('a tab left open across Paris midnight', () => {
  it('offers the new grid exactly at midnight, in summer and winter time', () => {
    expect(hasNewGrid('2026-11-05', new Date('2026-11-05T22:59:59Z'))).toBe(false); // 23:59:59 Paris
    expect(hasNewGrid('2026-11-05', new Date('2026-11-05T23:00:01Z'))).toBe(true); // 00:00:01 Paris
    expect(hasNewGrid('2026-08-05', new Date('2026-08-05T21:59:59Z'))).toBe(false);
    expect(hasNewGrid('2026-08-05', new Date('2026-08-05T22:00:00Z'))).toBe(true);
  });

  it('is not fooled by the 25-hour day of the October DST change', () => {
    expect(hasNewGrid('2026-10-25', new Date('2026-10-25T22:59:59Z'))).toBe(false); // 23:59:59 CET
    expect(hasNewGrid('2026-10-25', new Date('2026-10-25T23:00:00Z'))).toBe(true);
    expect(hasNewGrid('2026-10-25', new Date('2026-10-25T00:30:00Z'))).toBe(false); // 02:30 CEST
  });

  it('is not fooled by the 23-hour day of the March DST change', () => {
    expect(hasNewGrid('2027-03-28', new Date('2027-03-28T21:59:59Z'))).toBe(false); // 23:59:59 CEST
    expect(hasNewGrid('2027-03-28', new Date('2027-03-28T22:00:00Z'))).toBe(true);
  });

  it('does not offer anything while the date is unchanged, whatever the local time zone', () => {
    expect(hasNewGrid('2026-11-05', new Date('2026-11-05T11:00:00Z'))).toBe(false);
  });
});

describe('launch and grid files', () => {
  it('knows the game has not launched before LAUNCH_DATE', () => {
    expect(isBeforeLaunch('2026-10-31')).toBe(true);
    expect(isBeforeLaunch('2026-11-01')).toBe(false);
    expect(isBeforeLaunch('2026-11-02', '2026-11-03')).toBe(true);
  });

  it('finds grid files under the base path, with or without a trailing slash', () => {
    expect(gridUrl('2026-11-05', '/')).toBe('/grids/2026-11-05.json');
    expect(gridUrl('2026-11-05', '/pokeneuf/')).toBe('/pokeneuf/grids/2026-11-05.json');
    expect(gridUrl('2026-11-05', '/pokeneuf')).toBe('/pokeneuf/grids/2026-11-05.json');
    expect(() => gridUrl('05/11/2026', '/')).toThrow();
  });
});
