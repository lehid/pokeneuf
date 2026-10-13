import {
  cellBackground,
  cellTextColor,
  cellTextContrast,
  getCategory,
  isOver,
  WCAG_AA,
} from '@pokeneuf/core';
import { pokemonById } from '../data';
import { useGame } from '../GameContext';
import { fr } from '../i18n/fr';
import { formatNumber } from '../format';
import { TypeBadge } from './TypeBadge';

export function Cell({ index }: { index: number }) {
  const grid = useGame((s) => s.grid);
  const game = useGame((s) => s.game);
  const lastGuess = useGame((s) => s.lastGuess);
  const selectCell = useGame((s) => s.selectCell);

  const row = getCategory(grid.rows[Math.floor(index / 3)] ?? '').label.fr;
  const col = getCategory(grid.cols[index % 3] ?? '').label.fr;
  const id = game.cells[index] ?? null;
  const over = isOver(game);
  // Two copies of each animation, alternated, so a repeat on the same cell restarts it.
  const parity = lastGuess ? (lastGuess.seq % 2 === 0 ? 'a' : 'b') : 'a';
  const animation =
    lastGuess?.cell === index
      ? `${lastGuess.result === 'wrong' ? 'cell-wrong' : 'cell-correct'}-${parity}`
      : '';
  const testId = `cell-${Math.floor(index / 3)}-${index % 3}`;
  const base = `panel relative flex min-h-28 w-full flex-col items-center justify-center gap-1 p-1 text-center ${animation}`;

  if (id !== null) {
    const p = pokemonById(id);
    const text = cellTextColor(p.types);
    // Some two-type gradients cannot carry readable text: put the name on a plate.
    const plate = cellTextContrast(p.types) < WCAG_AA;
    return (
      <button
        type="button"
        className={base}
        style={{ background: cellBackground(p.types), color: text }}
        aria-label={fr.filledCell(p.nameFr, formatNumber(p.id), row, col)}
        data-testid={testId}
        data-state="filled"
        data-pokemon={p.id}
        onClick={() => selectCell(index)}
      >
        <span
          className="max-w-full rounded-sm px-1 text-xs leading-tight font-bold break-words sm:text-base"
          style={
            plate
              ? {
                  background: text === '#000000' ? '#FFFFFF' : '#000000',
                  color: text === '#000000' ? '#000000' : '#FFFFFF',
                }
              : undefined
          }
        >
          {p.nameFr}
        </span>
        <span className="text-xs font-bold tabular-nums">{formatNumber(p.id)}</span>
        <span className="flex flex-col items-center gap-0.5 sm:flex-row">
          {p.types.map((type) => (
            <TypeBadge key={type} type={type} />
          ))}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${base} ${over ? 'bg-lcd-panel-2' : 'hover:bg-lcd-panel-2'}`}
      aria-label={over ? fr.unfoundCell(row, col) : fr.emptyCell(row, col)}
      data-testid={testId}
      data-state="empty"
      onClick={() => selectCell(index)}
    >
      <span className="title-pixel text-lg text-lcd-soft" aria-hidden="true">
        {over ? '?' : '+'}
      </span>
    </button>
  );
}
