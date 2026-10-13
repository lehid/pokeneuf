import { describe, expect, it } from 'vitest';
import { parseRoute, routeHash, type Route } from './routes';

describe('parseRoute', () => {
  it('knows the page of the day, the archives and a played archive', () => {
    expect(parseRoute('')).toEqual({ kind: 'today' });
    expect(parseRoute('#')).toEqual({ kind: 'today' });
    expect(parseRoute('#/')).toEqual({ kind: 'today' });
    expect(parseRoute('#/archives')).toEqual({ kind: 'archives', page: 1 });
    expect(parseRoute('#/archives?page=3')).toEqual({ kind: 'archives', page: 3 });
    expect(parseRoute('#/archive/2026-11-05')).toEqual({ kind: 'archive', date: '2026-11-05' });
  });

  it('knows the info pages', () => {
    expect(parseRoute('#/faq')).toEqual({ kind: 'faq' });
    expect(parseRoute('#/changelog')).toEqual({ kind: 'changelog' });
    expect(parseRoute('#/legal')).toEqual({ kind: 'legal' });
    expect(parseRoute('#/faq?x=1')).toEqual({ kind: 'faq' });
    expect(parseRoute('#/faqs')).toEqual({ kind: 'today' });
    expect(parseRoute('#/faq/extra')).toEqual({ kind: 'today' });
  });

  it('takes a bad page for the first one, and anything unknown for the page of the day', () => {
    for (const hash of [
      '#/archives?page=0',
      '#/archives?page=-2',
      '#/archives?page=x',
      '#/archives?page=1.5',
    ]) {
      expect(parseRoute(hash), hash).toEqual({ kind: 'archives', page: 1 });
    }
    for (const hash of [
      '#/nope',
      '#/archive',
      '#/archive/demain',
      '#/archive/2026-11-05/x',
      '#archives',
    ]) {
      expect(parseRoute(hash), hash).toEqual({ kind: 'today' });
    }
  });
});

describe('routeHash', () => {
  it('is the inverse of parseRoute', () => {
    const routes: Route[] = [
      { kind: 'today' },
      { kind: 'archives', page: 1 },
      { kind: 'archives', page: 4 },
      { kind: 'archive', date: '2027-01-02' },
      { kind: 'faq' },
      { kind: 'changelog' },
      { kind: 'legal' },
    ];
    for (const route of routes) expect(parseRoute(routeHash(route))).toEqual(route);
    expect(routeHash({ kind: 'archives', page: 1 })).toBe('#/archives');
  });
});
