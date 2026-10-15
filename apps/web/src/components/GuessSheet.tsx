import { getCategory, usedPokemon, type Pokemon } from '@pokeneuf/core';
import { useCombobox } from 'downshift';
import { useMemo, useState } from 'react';
import { search } from '../data';
import { formatNumber } from '../format';
import { useGame } from '../GameContext';
import { fr } from '../i18n/fr';
import { Modal } from './Modal';
import { TypeBadge } from './TypeBadge';

const MAX_SUGGESTIONS = 8;

function GuessCombobox({ onPick }: { onPick(pokemon: Pokemon): void }) {
  const game = useGame((s) => s.game);
  const used = useMemo(() => usedPokemon(game), [game]);
  // The text of the input belongs to the input (uncontrolled: a controlled value lags behind fast
  // typing and drops keystrokes). `query` only follows it, to compute the suggestions.
  const [query, setQuery] = useState('');
  const items = useMemo(() => search(query, { lang: 'fr', limit: MAX_SUGGESTIONS }), [query]);
  const isOpen = query.trim() !== '';

  const { getLabelProps, getInputProps, getMenuProps, getItemProps, highlightedIndex } =
    useCombobox<Pokemon>({
      items,
      // Nothing stays "selected": a pick is played at once and the sheet closes.
      selectedItem: null,
      isOpen,
      defaultHighlightedIndex: 0,
      itemToString: (item) => item?.nameFr ?? '',
      isItemDisabled: (item) => used.has(item.id),
      onInputValueChange: ({ inputValue }) => setQuery(inputValue),
      onSelectedItemChange: ({ selectedItem }) => {
        if (selectedItem) onPick(selectedItem);
      },
      // Losing the focus is not a choice. By default Downshift selects the highlighted suggestion
      // when the input blurs, which PLAYED a move (and cost a life) on Escape, on Tab to "Fermer",
      // on the Android back button, or when another dialog opened over the sheet (C1). Enter and a
      // click still select.
      stateReducer: (state, { type, changes }) =>
        type === useCombobox.stateChangeTypes.InputBlur
          ? { ...changes, selectedItem: state.selectedItem, inputValue: state.inputValue }
          : changes,
      // Downshift's own live region is appended to <body>, which is inert while a modal dialog is
      // open: nothing in it would ever be read. The French status below lives inside the dialog.
      getA11yStatusMessage: () => '',
    });

  return (
    <div>
      <label {...getLabelProps()} className="mb-1 block text-sm font-bold">
        {fr.guessLabel}
      </label>
      <input
        {...getInputProps({
          autoFocus: true,
          // Follow the text synchronously, in the same render as the keystroke.
          onChange: (event) => setQuery((event.target as HTMLInputElement).value),
          onKeyDown: (event) => {
            // Escape closes the sheet (native dialog behaviour), not just the suggestions.
            if (event.key === 'Escape') {
              (
                event as typeof event & { preventDownshiftDefault?: boolean }
              ).preventDownshiftDefault = true;
            }
          },
        })}
        className="w-full border-[3px] border-lcd-ink bg-lcd-bg px-3 py-2 text-base"
        placeholder={fr.guessPlaceholder}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        data-testid="guess-input"
      />
      <p className="sr-only" role="status" aria-live="polite" data-testid="suggestions-status">
        {isOpen ? fr.suggestionsStatus(items.length) : ''}
      </p>
      <ul
        {...getMenuProps()}
        className="mt-2 max-h-[55dvh] overflow-y-auto"
        data-testid="suggestions"
      >
        {isOpen &&
          items.map((item, index) => {
            const disabled = used.has(item.id);
            return (
              <li
                key={item.id}
                {...getItemProps({ item, index })}
                className={`mb-1 flex items-center gap-2 border-2 border-lcd-ink px-2 py-1.5 ${
                  disabled
                    ? 'bg-lcd-panel-2 text-lcd-soft opacity-60'
                    : highlightedIndex === index
                      ? 'bg-lcd-ink text-lcd-panel'
                      : 'bg-lcd-panel'
                }`}
                data-testid={`suggestion-${item.id}`}
                data-disabled={disabled || undefined}
              >
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{item.nameFr}</span>{' '}
                  <span className="text-xs opacity-70">{item.nameEn}</span>
                  {disabled && <span className="ml-1 text-xs">({fr.alreadyUsed})</span>}
                </span>
                <span className="text-xs tabular-nums">{formatNumber(item.id)}</span>
                <span className="flex gap-1">
                  {item.types.map((type) => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </span>
              </li>
            );
          })}
      </ul>
      {/* Outside the listbox: only options may be children of a role=listbox. */}
      {isOpen && items.length === 0 && (
        <p className="px-2 py-2 text-sm text-lcd-soft" data-testid="no-result">
          {fr.noResult}
        </p>
      )}
    </div>
  );
}

/** Bottom-of-the-screen-friendly input for one cell. */
export function GuessSheet() {
  const cell = useGame((s) => s.selectedCell);
  const grid = useGame((s) => s.grid);
  const closeCell = useGame((s) => s.closeCell);
  const guess = useGame((s) => s.guess);
  if (cell === null) return null;

  const row = getCategory(grid.rows[Math.floor(cell / 3)] ?? '').label.fr;
  const col = getCategory(grid.cols[cell % 3] ?? '').label.fr;
  return (
    <Modal title={fr.guessTitle(row, col)} onClose={closeCell} sheet testId="guess-sheet">
      <GuessCombobox onPick={(pokemon) => guess(pokemon.id)} />
      <button type="button" className="btn mt-3 w-full" onClick={closeCell}>
        {fr.close}
      </button>
    </Modal>
  );
}
