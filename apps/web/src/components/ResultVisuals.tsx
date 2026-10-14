import { CELLS, RARITY_COLORS, scoreShare, titleMarks } from '@pokeneuf/core';
import { useGame } from '../GameContext';
import { useScore } from '../hooks';

/**
 * The game at a glance, like the share text: one square per cell, coloured by the estimated
 * rarity of the answer, hatched when the cell was not found. Decorative (the text says it all).
 */
export function ResultGrid() {
  const game = useGame((s) => s.game);
  const score = useScore();
  return (
    <div className="grid shrink-0 grid-cols-3 gap-1" aria-hidden="true" data-testid="result-grid">
      {Array.from({ length: CELLS }, (_, i) => {
        const tier =
          game.cells[i] === null || game.cells[i] === undefined ? null : score.cells[i]?.tier;
        return (
          <span
            key={i}
            className={`result-cell size-7 border-[3px] border-lcd-ink ${tier ? '' : 'missed'}`}
            style={
              {
                ...(tier ? { background: RARITY_COLORS[tier] } : {}),
                '--i': i,
              } as React.CSSProperties
            }
            data-tier={tier ?? undefined}
          />
        );
      })}
    </div>
  );
}

/** The 0–900 scale with the start of each title marked, filled up to the score. Decorative. */
export function ScoreGauge({ score }: { score: number }) {
  return (
    <div
      className="relative h-5 border-[3px] border-lcd-ink bg-lcd-panel-2"
      aria-hidden="true"
      data-testid="score-gauge"
    >
      <div
        className="gauge-fill h-full bg-lcd-ink"
        style={{ '--gauge': `${scoreShare(score) * 100}%` } as React.CSSProperties}
        data-share={scoreShare(score)}
      />
      {titleMarks()
        .filter((mark) => mark.share > 0)
        .map((mark) => (
          <span
            key={mark.title}
            className="absolute inset-y-0 w-[3px] bg-lcd-panel mix-blend-difference"
            style={{ left: `calc(${mark.share * 100}% - 1.5px)` }}
          />
        ))}
    </div>
  );
}
