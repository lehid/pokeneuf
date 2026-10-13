import type { CategoryFamily } from '@pokeneuf/core';
import type { ReactElement } from 'react';

/** Home-made pixel pictos, one per category family (no official icons). 8×8 grid, `currentColor`. */
const PIXELS: Record<CategoryFamily, string[]> = {
  // drop
  type: [
    '...##...',
    '...##...',
    '..####..',
    '.######.',
    '.######.',
    '.######.',
    '..####..',
    '........',
  ],
  // roman-numeral style bars
  generation: [
    '.#.#.#..',
    '.#.#.#..',
    '.#.#.#..',
    '.#.#.#..',
    '.#.#.#..',
    '........',
    '########',
    '########',
  ],
  // arrow up
  evolution: [
    '...##...',
    '..####..',
    '.######.',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '........',
  ],
  // star
  status: [
    '...##...',
    '...##...',
    '########',
    '.######.',
    '..####..',
    '.##..##.',
    '.#....#.',
    '........',
  ],
  // bolt
  form: [
    '.....##.',
    '....##..',
    '...##...',
    '..#####.',
    '....##..',
    '...##...',
    '..##....',
    '........',
  ],
  // bars
  stats: [
    '........',
    '......##',
    '......##',
    '...#..##',
    '...#.###',
    '##.#.###',
    '##.#####',
    '########',
  ],
  // ring
  color: [
    '..####..',
    '.#....#.',
    '#..##..#',
    '#.####.#',
    '#.####.#',
    '#..##..#',
    '.#....#.',
    '..####..',
  ],
  // square + circle
  shape: [
    '####....',
    '####....',
    '####.##.',
    '....####',
    '....####',
    '.....##.',
    '........',
    '........',
  ],
  // ruler
  size: [
    '########',
    '#.#.#.#.',
    '#.#.#.#.',
    '#.....#.',
    '#.#.#.#.',
    '#.....#.',
    '########',
    '........',
  ],
  // letter A
  name: [
    '..####..',
    '.##..##.',
    '.##..##.',
    '.######.',
    '.##..##.',
    '.##..##.',
    '.##..##.',
    '........',
  ],
};

export function FamilyIcon({ family, size = 20 }: { family: CategoryFamily; size?: number }) {
  const rects: ReactElement[] = [];
  PIXELS[family].forEach((line, y) => {
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
      data-family={family}
    >
      {rects}
    </svg>
  );
}
