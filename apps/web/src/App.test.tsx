import { APP_NAME, findSolution } from '@pokeneuf/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { demoGrid, memberships, pokemonById } from './data';
import { memoryStorage } from './storage';

const solution = findSolution(demoGrid, memberships) ?? [];
afterEach(cleanup);

function start(hideRules = true) {
  const storage = memoryStorage(
    hideRules ? { 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' } : {},
  );
  render(<App storage={storage} />);
  return storage;
}

function play(cell: string, name: string) {
  fireEvent.click(screen.getByTestId(cell));
  fireEvent.change(screen.getByTestId('guess-input'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('suggestions').querySelector('li') as HTMLElement);
}

describe('App', () => {
  it('shows the app name, the non-affiliation notice and a 3×3 board', () => {
    start();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(APP_NAME);
    expect(screen.getByText(/non affilié/)).toBeTruthy();
    expect(screen.getAllByTestId(/^cell-\d-\d$/)).toHaveLength(9);
  });

  it('shows the rules on first launch', () => {
    start(false);
    expect(screen.getByTestId('rules-dialog')).toBeTruthy();
  });

  it('opens a definition when a header is tapped', () => {
    start();
    fireEvent.click(screen.getByTestId(`row-header-${demoGrid.rows[0]}`));
    expect(screen.getByText('Définition')).toBeTruthy();
  });

  it('fills a cell with a correct answer: name, number and types', () => {
    start();
    const first = pokemonById(solution[0] ?? 1);
    play('cell-0-0', first.nameFr);
    const cell = screen.getByTestId('cell-0-0');
    expect(cell.getAttribute('data-state')).toBe('filled');
    expect(within(cell).getByText(first.nameFr)).toBeTruthy();
    expect(within(cell).getByText(`#${String(first.id).padStart(3, '0')}`)).toBeTruthy();
    expect(screen.queryByTestId('guess-sheet')).toBeNull();
  });

  it('costs a life on a wrong answer and keeps the cell empty', () => {
    start();
    play('cell-0-0', 'Pikachu'); // not a valid answer for the demo grid's first cell
    expect(screen.getByTestId('cell-0-0').getAttribute('data-state')).toBe('empty');
    expect(screen.getByTestId('lives').getAttribute('data-left')).toBe('2');
    expect(screen.getByTestId('announcer').textContent).toContain('Raté');
  });

  it('greys out a Pokémon already placed', () => {
    start();
    const first = pokemonById(solution[0] ?? 1);
    play('cell-0-0', first.nameFr);
    fireEvent.click(screen.getByTestId('cell-0-1'));
    fireEvent.change(screen.getByTestId('guess-input'), { target: { value: first.nameFr } });
    const item = screen.getByTestId(`suggestion-${first.id}`);
    expect(item.getAttribute('data-disabled')).toBe('true');
    fireEvent.click(item);
    expect(screen.getByTestId('guess-sheet')).toBeTruthy(); // not selectable
    expect(screen.getByTestId('lives').getAttribute('data-left')).toBe('3');
  });

  it('asks for confirmation before abandoning, then shows the result and the solutions', () => {
    start();
    fireEvent.click(screen.getByTestId('abandon'));
    expect(screen.getByText('Voulez-vous vraiment abandonner ?')).toBeTruthy();
    fireEvent.click(screen.getByText('Oui, abandonner'));
    expect(screen.getByTestId('end-dialog')).toBeTruthy();
    expect(screen.getByTestId('score').textContent).toBe('0');
    fireEvent.click(screen.getByTestId('see-solutions'));
    fireEvent.click(screen.getByTestId('cell-1-1'));
    expect(screen.getByTestId('solutions-dialog')).toBeTruthy();
  });
});
