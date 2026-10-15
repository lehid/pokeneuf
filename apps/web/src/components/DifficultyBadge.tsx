import { DIFFICULTY_LEVELS } from '@pokeneuf/core';
import { useDifficulty } from '../hooks';
import { fr } from '../i18n/fr';

/**
 * The difficulty of the grid: five squares, as many filled as the level, and its name. A screen
 * reader gets the sentence as real text (an `aria-label` on a paragraph is not reliably read);
 * the visual version is hidden from it.
 */
export function DifficultyBadge() {
  const { level, levelIndex } = useDifficulty();
  const name = fr.difficulty[level];
  return (
    <p className="mt-1 flex items-center gap-2 text-xs" data-testid="difficulty" data-level={level}>
      <span className="sr-only" data-testid="difficulty-text">
        {fr.difficultyAria(name, levelIndex + 1, DIFFICULTY_LEVELS.length)}
      </span>
      <span className="text-lcd-soft" aria-hidden="true">
        {fr.difficultyLabel}
      </span>
      <span className="flex gap-0.5" aria-hidden="true">
        {DIFFICULTY_LEVELS.map((l, i) => (
          <span
            key={l}
            className={`size-2.5 border-2 border-lcd-ink ${i <= levelIndex ? 'bg-lcd-ink' : 'bg-transparent'}`}
          />
        ))}
      </span>
      <span className="font-bold" aria-hidden="true">
        {name}
      </span>
    </p>
  );
}
