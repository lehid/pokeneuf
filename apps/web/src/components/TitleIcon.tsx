import type { ScoreTitle } from '@pokeneuf/core';
import type { ReactElement } from 'react';

/** Home-made pixel pictos, one per score title (no official icons). 8×8 grid, `currentColor`. */
const PIXELS: Record<ScoreTitle, string[]> = {
  // magnifying glass
  curious: [
    '.####...',
    '#....#..',
    '#....#..',
    '#....#..',
    '.####...',
    '....##..',
    '.....##.',
    '......##',
  ],
  // pennant on a pole
  trainer: [
    '.#......',
    '.####...',
    '.#####..',
    '.####...',
    '.#......',
    '.#......',
    '.#......',
    '###.....',
  ],
  // star
  expert: [
    '...##...',
    '...##...',
    '########',
    '.######.',
    '..####..',
    '..####..',
    '.##..##.',
    '.#....#.',
  ],
  // trophy
  champion: [
    '########',
    '#.####.#',
    '#.####.#',
    '.######.',
    '..####..',
    '...##...',
    '...##...',
    '.######.',
  ],
  // crown
  legend: [
    '#..##..#',
    '##.##.##',
    '########',
    '########',
    '#.####.#',
    '########',
    '........',
    '........',
  ],
};

export function TitleIcon({ title, size = 24 }: { title: ScoreTitle; size?: number }) {
  const rects: ReactElement[] = [];
  PIXELS[title].forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (line[x] === '#') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />);
    }
  });
  return (
    <svg
      viewBox="0 0 8 8"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      data-title={title}
    >
      {rects}
    </svg>
  );
}
