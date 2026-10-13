import { useGame } from '../GameContext';
import { fr } from '../i18n/fr';
import { Cell } from './Cell';
import { CategoryHeader } from './CategoryHeader';

const THREE = [0, 1, 2] as const;

export function Board() {
  const grid = useGame((s) => s.grid);
  return (
    <div
      className="grid grid-cols-[minmax(4rem,1fr)_repeat(3,minmax(0,1.6fr))] gap-2 sm:gap-3"
      role="group"
      aria-label={fr.boardLabel}
      data-testid="board"
    >
      <div aria-hidden="true" />
      {THREE.map((c) => (
        <CategoryHeader key={grid.cols[c]} id={grid.cols[c] ?? ''} axis="col" />
      ))}
      {THREE.map((r) => (
        <div key={r} className="contents">
          <CategoryHeader id={grid.rows[r] ?? ''} axis="row" />
          {THREE.map((c) => (
            <Cell key={c} index={r * 3 + c} />
          ))}
        </div>
      ))}
    </div>
  );
}
