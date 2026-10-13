import type { GridDate } from './date';

/**
 * The pages of the app. The site is static (GitHub Pages: no server to answer `/archives`), so a
 * page is named in the URL hash: `#/archives?page=2`, `#/archive/2026-11-05`.
 */
export type Route =
  { kind: 'today' } | { kind: 'archives'; page: number } | { kind: 'archive'; date: GridDate };

const ARCHIVE_DATE = /^#\/archive\/(\d{4}-\d{2}-\d{2})$/;

/** The route of a `location.hash`. Anything unknown is the page of the day. */
export function parseRoute(hash: string): Route {
  const archive = ARCHIVE_DATE.exec(hash);
  if (archive?.[1] !== undefined) return { kind: 'archive', date: archive[1] };

  const [path, query = ''] = hash.split('?', 2);
  if (path === '#/archives') {
    const page = Number(new URLSearchParams(query).get('page') ?? '1');
    return { kind: 'archives', page: Number.isInteger(page) && page >= 1 ? page : 1 };
  }
  return { kind: 'today' };
}

/** The hash that leads to a route (`''` for the page of the day). */
export function routeHash(route: Route): string {
  switch (route.kind) {
    case 'today':
      return '';
    case 'archives':
      return route.page <= 1 ? '#/archives' : `#/archives?page=${route.page}`;
    case 'archive':
      return `#/archive/${route.date}`;
  }
}
