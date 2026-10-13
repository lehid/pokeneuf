import { APP_NAME, findSolution } from '@pokeneuf/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { demoGrid, memberships, pokemonById } from './data';
import { memoryStorage } from './storage';

const solution = findSolution(demoGrid, memberships) ?? [];
afterEach(cleanup);

function start(hideRules = true) {
  const storage = memoryStorage(
    hideRules ? { 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' } : {},
  );
  render(<App storage={storage} demo />);
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

describe('daily grid', () => {
  const DAY = demoGrid.date; // 2026-11-01: the demo grid doubles as the grid of that day
  const noon = (date: string) => new Date(`${date}T11:00:00Z`);
  const served = (grids: Record<string, unknown>) =>
    vi.fn(async (url: string | URL | Request) => {
      const date = /(\d{4}-\d{2}-\d{2})\.json$/.exec(String(url))?.[1] ?? '';
      const grid = grids[date];
      return grid ? new Response(JSON.stringify(grid)) : new Response('', { status: 404 });
    });
  const daily = (
    now: Date,
    fetchImpl: typeof fetch,
    storage = memoryStorage({ 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' }),
  ) =>
    render(
      <App storage={storage} now={() => now} fetchImpl={fetchImpl} baseUrl="/" demo={false} />,
    );

  it('plays the grid of the day', async () => {
    daily(noon(DAY), served({ [DAY]: demoGrid }));
    expect(await screen.findByTestId('board')).toBeTruthy();
    expect(screen.getByText(/Grille n° 1/)).toBeTruthy();
    expect(screen.queryByText(/démonstration/)).toBeNull();
  });

  it('says so, politely, when there is no grid today', async () => {
    daily(noon('2027-06-01'), served({}));
    expect((await screen.findByTestId('no-grid')).textContent).toBe(
      'Pas de grille aujourd’hui, revenez demain.',
    );
    expect(screen.queryByTestId('try-demo')).toBeNull();
  });

  it('announces the launch and offers the demo before launch day', async () => {
    daily(noon('2026-10-13'), served({}));
    expect((await screen.findByTestId('no-grid')).textContent).toContain('1 novembre 2026');
    expect(screen.getByTestId('try-demo').getAttribute('href')).toBe('?demo');
  });

  it('can retry after a loading error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(new Response(JSON.stringify(demoGrid)));
    daily(noon(DAY), fetchImpl);
    fireEvent.click(await screen.findByText('Réessayer'));
    expect(await screen.findByTestId('board')).toBeTruthy();
  });

  it('offers the new grid when the tab comes back after Paris midnight, and plays it on request', async () => {
    const next = { ...demoGrid, id: 2, date: '2026-11-02' };
    let now = new Date('2026-11-01T22:59:00Z'); // 23:59 in Paris
    const fetchImpl = served({ [DAY]: demoGrid, '2026-11-02': next });
    render(
      <App
        storage={memoryStorage({ 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' })}
        now={() => now}
        fetchImpl={fetchImpl}
        baseUrl="/"
        demo={false}
      />,
    );
    await screen.findByTestId('board');

    fireEvent(document, new Event('visibilitychange'));
    expect(screen.queryByTestId('new-grid-dialog')).toBeNull(); // still the same day

    now = new Date('2026-11-01T23:01:00Z'); // 00:01 in Paris
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
    });
    expect(screen.getByTestId('new-grid-dialog')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Jouer la nouvelle grille'));
    });
    expect(await screen.findByText(/Grille n° 2/)).toBeTruthy();
    expect(screen.queryByTestId('new-grid-dialog')).toBeNull();
  });

  it('keeps the current game when the player says "plus tard"', async () => {
    let now = new Date('2026-11-01T22:59:00Z');
    render(
      <App
        storage={memoryStorage({ 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' })}
        now={() => now}
        fetchImpl={served({ [DAY]: demoGrid })}
        baseUrl="/"
        demo={false}
      />,
    );
    await screen.findByTestId('board');
    now = new Date('2026-11-01T23:01:00Z');
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
    });
    fireEvent.click(screen.getByText('Plus tard'));
    expect(screen.queryByTestId('new-grid-dialog')).toBeNull();
    expect(screen.getByText(/Grille n° 1/)).toBeTruthy();
  });

  it('keeps the progress of the demo apart from the real grid with the same number', async () => {
    const storage = memoryStorage({ 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' });
    const first = render(<App storage={storage} demo />);
    const answer = pokemonById(solution[0] ?? 1);
    play('cell-0-0', answer.nameFr);
    expect([...storage.data.keys()].some((k) => k === 'pokeneuf:v1:game:1')).toBe(false);
    expect(storage.data.has('demo:pokeneuf:v1:game:1')).toBe(true);
    first.unmount();

    daily(noon(DAY), served({ [DAY]: demoGrid }), storage);
    await screen.findByTestId('board');
    expect(screen.getByTestId('cell-0-0').getAttribute('data-state')).toBe('empty');
  });
});
