import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import type { VitePWAOptions } from 'vite-plugin-pwa';

/**
 * Build-time facts shared by `index.html`, `404.html` and the PWA manifest. The site name is read
 * from the single source of truth, `APP_NAME` in `@pokeneuf/core` (CLAUDE.md): the Vite config runs
 * in plain Node, which cannot import that TypeScript package, so the constant is read as text.
 */
function readCoreConstant(name: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, '../../packages/core/src/config.ts');
  const match = new RegExp(`export const ${name} = '([^']+)'`).exec(readFileSync(file, 'utf8'));
  if (match?.[1] === undefined) throw new Error(`${name} not found in packages/core/src/config.ts`);
  return match[1];
}

export const APP_NAME = readCoreConstant('APP_NAME');

/** Colours of the install splash and the browser bar: the LCD palette of `index.css`. */
export const THEME = { light: '#c4cfa1', dark: '#141a0f' } as const;

export const SITE = {
  appName: APP_NAME,
  shortName: APP_NAME,
  title: `${APP_NAME} — la grille du jour`,
  description:
    'Chaque jour, une grille 3×3 à remplir avec les bons Pokémon (générations 1 à 4). Gratuit, sans pub, sans compte.',
  imageAlt: `${APP_NAME} : une grille 3×3 de cases colorées par type`,
} as const;

/**
 * Public address of the site, with a trailing slash (`VITE_SITE_URL`, set by the deploy workflow):
 * link previews need absolute URLs. Without it (local builds) they fall back to the base path.
 */
export function siteUrl(base: string, env: NodeJS.ProcessEnv = process.env): string {
  const url = env.VITE_SITE_URL?.trim();
  if (url === undefined || url === '') return base;
  return url.endsWith('/') ? url : `${url}/`;
}

const meta = (key: 'name' | 'property', name: string, content: string): HtmlTagDescriptor => ({
  tag: 'meta',
  attrs: { [key]: name, content },
  injectTo: 'head',
});

/**
 * Link previews (Open Graph, Twitter) and the canonical address. Injected after Vite has processed
 * the page: written in the HTML, a `href="/"` (local build, base `/`) would be read as an asset.
 * Without a public address (`VITE_SITE_URL`) the image still points at the base path, and the
 * canonical and `og:url` tags are left out rather than guessed.
 */
export function socialTags(url: string, hasPublicUrl: boolean): HtmlTagDescriptor[] {
  const image = `${url}og-image.png`;
  const tags: HtmlTagDescriptor[] = [
    meta('property', 'og:type', 'website'),
    meta('property', 'og:locale', 'fr_FR'),
    meta('property', 'og:site_name', SITE.appName),
    meta('property', 'og:title', SITE.title),
    meta('property', 'og:description', SITE.description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', SITE.imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', SITE.title),
    meta('name', 'twitter:description', SITE.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', SITE.imageAlt),
  ];
  if (hasPublicUrl) {
    tags.push(
      { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
      meta('property', 'og:url', url),
    );
  }
  return tags;
}

/** Fills the `%…%` placeholders of the HTML entry points, and adds the link preview tags. */
export function htmlPlaceholders(base: string): Plugin[] {
  const url = siteUrl(base);
  const values: Record<string, string> = {
    APP_NAME: SITE.appName,
    SITE_TITLE: SITE.title,
    SITE_DESCRIPTION: SITE.description,
    THEME_LIGHT: THEME.light,
    THEME_DARK: THEME.dark,
  };
  return [
    {
      name: 'pokeneuf-html-placeholders',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) =>
          html.replace(/%([A-Z_]+)%/g, (whole, key: string) => values[key] ?? whole),
      },
    },
    {
      name: 'pokeneuf-social-tags',
      transformIndexHtml: {
        order: 'post',
        handler: (_html, ctx) =>
          ctx.filename.endsWith('index.html') ? socialTags(url, url !== base) : [],
      },
    },
  ];
}

/**
 * Offline support for the app shell only (ROADMAP phase 8): the page, scripts, styles, fonts and
 * icons are precached; the grids never are. A grid is fetched from the network on every visit (the
 * client asks for `no-cache`), because a stale grid of the day is worse than a slow one.
 */
export function pwaOptions(base: string): Partial<VitePWAOptions> {
  return {
    registerType: 'autoUpdate',
    // Registered by hand in `main.tsx` (production only), so `404.html` never installs the worker.
    injectRegister: false,
    manifest: {
      id: base,
      name: SITE.appName,
      short_name: SITE.shortName,
      description: SITE.description,
      lang: 'fr',
      start_url: base,
      scope: base,
      display: 'standalone',
      orientation: 'portrait',
      background_color: THEME.light,
      theme_color: THEME.light,
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
      // The grids are data, not shell; the link preview image and the 404 page are not needed offline.
      globIgnores: ['grids/**', 'og-image.png', '404.html'],
      navigateFallback: `${base}index.html`,
      navigateFallbackDenylist: [new RegExp(`^${base}grids/`)],
      cleanupOutdatedCaches: true,
      // A new version takes over at once, and the very first visit is already covered offline.
      skipWaiting: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith(`${base}grids/`),
          handler: 'NetworkOnly',
        },
      ],
    },
  };
}
