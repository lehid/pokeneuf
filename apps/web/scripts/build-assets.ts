/**
 * Draws the home-made icons and the Open Graph image into `public/` (pnpm assets:build).
 * No official artwork: a 3×3 grid of cells in type colours (ROADMAP §2.5), rendered by Chromium.
 * The PNGs are committed; run this again only when the look changes.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  APP_NAME,
  readableTextColor,
  TYPE_COLORS,
  TYPE_ICON_PATHS,
  type PokemonType,
} from '@pokeneuf/core';
import { fr } from '../src/i18n/fr';
import { existsSync } from 'node:fs';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const INK = '#1d2616';
const LCD = '#c4cfa1';
const PANEL = '#e7edcf';

/** The nine cells of the logo, row by row. */
const LOGO_TYPES: readonly PokemonType[] = [
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'fighting',
  'ghost',
  'dragon',
];

/** A square with notched corners, the pixel-art way. */
function notched(x: number, y: number, size: number, notch: number): string {
  const n = notch;
  return [
    `M${x + n} ${y}H${x + size - n}V${y + n}H${x + size}V${y + size - n}H${x + size - n}`,
    `V${y + size}H${x + n}V${y + size - n}H${x}V${y + n}H${x + n}Z`,
  ].join('');
}

/** The app icon on a 512 canvas; the cells stay inside the 80 % safe zone of maskable icons. */
export function iconSvg(): string {
  const cell = 104;
  const gap = 16;
  const start = (512 - (3 * cell + 2 * gap)) / 2;
  const cells = LOGO_TYPES.map((type, i) => {
    const x = start + (i % 3) * (cell + gap);
    const y = start + Math.floor(i / 3) * (cell + gap);
    return `<path d="${notched(x, y, cell, 10)}" fill="${TYPE_COLORS[type]}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">`,
    `<rect width="512" height="512" fill="${INK}"/>`,
    ...cells,
    `</svg>`,
  ].join('');
}

function typeIcon(type: PokemonType, x: number, y: number, size: number): string {
  const color = readableTextColor(TYPE_COLORS[type]);
  const scale = size / 24;
  return `<path transform="translate(${x} ${y}) scale(${scale})" d="${TYPE_ICON_PATHS[type]}" fill="${color}" fill-rule="evenodd"/>`;
}

/** The 1200×630 link preview: name, tagline, and the grid. */
function ogHtml(fontDataUrl: string): string {
  const cell = 130;
  const gap = 12;
  const gridSize = 3 * cell + 2 * gap;
  const cells = LOGO_TYPES.map((type, i) => {
    const x = (i % 3) * (cell + gap);
    const y = Math.floor(i / 3) * (cell + gap);
    return [
      `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${TYPE_COLORS[type]}" stroke="${INK}" stroke-width="6"/>`,
      typeIcon(type, x + cell / 2 - 32, y + cell / 2 - 32, 64),
    ].join('');
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Press Start 2P'; src: url(${fontDataUrl}) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; background: ${LCD}; font-family: ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif; color: ${INK};
  background-image: linear-gradient(#d6dfb6 2px, transparent 2px), linear-gradient(90deg, #d6dfb6 2px, transparent 2px); background-size: 12px 12px; position: relative; overflow: hidden; }
.panel { position: absolute; left: 70px; top: 95px; width: 600px; height: 440px; background: ${PANEL}; border: 8px solid ${INK}; box-shadow: 12px 12px 0 ${INK}; padding: 48px 40px; }
h1 { font-family: 'Press Start 2P', monospace; font-weight: 400; font-size: 60px; line-height: 1.2; }
p { margin-top: 40px; font-size: 38px; font-weight: 700; line-height: 1.3; }
small { display: block; margin-top: 28px; font-size: 26px; color: #4c5a3c; font-weight: 600; }
svg { position: absolute; left: ${1200 - gridSize - 70}px; top: ${(630 - gridSize) / 2}px; }
</style></head><body>
<div class="panel"><h1>${APP_NAME}</h1><p>${fr.ogTagline}</p><small>${fr.ogDetails}</small></div>
<svg width="${gridSize}" height="${gridSize}" viewBox="0 0 ${gridSize} ${gridSize}">${cells.join('')}</svg>
</body></html>`;
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  const svg = iconSvg();
  await writeFile(path.join(PUBLIC_DIR, 'favicon.svg'), svg);

  const require = createRequire(import.meta.url);
  const fontFile =
    require.resolve('@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2');
  const font = await readFile(fontFile);
  const fontDataUrl = `data:font/woff2;base64,${font.toString('base64')}`;

  const local = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {});
  try {
    const page = await browser.newPage();
    const icons: ReadonlyArray<readonly [string, number]> = [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
      ['favicon-32.png', 32],
    ];
    for (const [file, size] of icons) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body>`,
      );
      await page.screenshot({ path: path.join(PUBLIC_DIR, file) });
    }
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(ogHtml(fontDataUrl));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(PUBLIC_DIR, 'og-image.png') });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
