import { describe, expect, it, vi } from 'vitest';
import { demoGrid, memberships } from './data';
import { loadGrid } from './gridLoader';

const DATE = demoGrid.date;
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
const load = (fetchImpl: typeof fetch, date = DATE, baseUrl = '/') =>
  loadGrid(date, { memberships, baseUrl, fetchImpl });

describe('loadGrid', () => {
  it('loads a valid grid, revalidating it every time', async () => {
    const fetchImpl = vi.fn(async () => json(demoGrid));
    expect(await load(fetchImpl)).toEqual({ kind: 'ready', grid: demoGrid });
    expect(fetchImpl).toHaveBeenCalledWith(`/grids/${DATE}.json`, { cache: 'no-cache' });
  });

  it('looks under the base path of the site', async () => {
    const fetchImpl = vi.fn(async () => json(demoGrid));
    await load(fetchImpl, DATE, '/pokeneuf/');
    expect(fetchImpl).toHaveBeenCalledWith(`/pokeneuf/grids/${DATE}.json`, { cache: 'no-cache' });
  });

  it('reports a missing grid, and tells before launch from after', async () => {
    const notFound = async () => new Response('nope', { status: 404 });
    expect(await load(notFound, '2026-10-13')).toEqual({ kind: 'missing', beforeLaunch: true });
    expect(await load(notFound, '2027-06-01')).toEqual({ kind: 'missing', beforeLaunch: false });
  });

  it('treats an HTML page served with a 200 as a missing grid', async () => {
    const page = async () =>
      new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } });
    expect(await load(page)).toEqual({ kind: 'missing', beforeLaunch: false });
  });

  it('reports an error for a network failure, a server error or garbage', async () => {
    expect(await load(async () => Promise.reject(new TypeError('offline')))).toEqual({
      kind: 'error',
    });
    expect(await load(async () => new Response('', { status: 500 }))).toEqual({ kind: 'error' });
    expect(await load(async () => new Response('not json'))).toEqual({ kind: 'error' });
    expect(await load(async () => json({ hello: 'world' }))).toEqual({ kind: 'error' });
  });

  it('refuses a grid for another day, or one the game would not publish', async () => {
    expect(await load(async () => json({ ...demoGrid, date: '2026-11-02' }))).toEqual({
      kind: 'error',
    });
    const broken = { ...demoGrid, cellSizes: demoGrid.cellSizes.map((n) => n + 1) };
    expect(await load(async () => json(broken))).toEqual({ kind: 'error' });
    const unknown = { ...demoGrid, rows: ['nope-1', demoGrid.rows[1], demoGrid.rows[2]] };
    expect(await load(async () => json(unknown))).toEqual({ kind: 'error' });
  });
});
