import {
  APP_NAME,
  DIFFICULTY_LEVELS,
  findSolution,
  gridDifficulty,
  rankScore,
  scoreGame,
  solutionsFor,
  sortByPopularity,
  titleFor,
} from '@pokeneuf/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { demoGrid, memberships, pokedex, pokemonById, popularity } from './data';
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
    expect(screen.getByTestId('score').textContent).toBe('0/900');
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

describe('rarity, score, stats and sharing', () => {
  const finishWon = () => {
    for (const [cell, id] of solution.entries())
      play(`cell-${Math.floor(cell / 3)}-${cell % 3}`, pokemonById(id).nameFr);
  };

  it('tags each found answer with its estimated rarity, and the header shows the score', () => {
    start();
    expect(screen.getByTestId('header-score').getAttribute('data-score')).toBe('0');
    expect(screen.queryByTestId('legend')).toBeNull();
    play('cell-0-0', pokemonById(solution[0] ?? 1).nameFr);
    const expected = scoreGame(
      {
        gridId: 1,
        cells: [solution[0] ?? 1, ...Array(8).fill(null)],
        errors: 0,
        status: 'playing',
      },
      demoGrid,
      memberships,
      popularity,
    );
    const tier = expected.cells[0]?.tier;
    expect(screen.getByTestId('cell-0-0').getAttribute('data-tier')).toBe(tier);
    expect(screen.getByTestId('header-score').getAttribute('data-score')).toBe(
      String(expected.total),
    );
    expect(screen.getByTestId('legend').textContent).toContain('Rareté estimée');
  });

  it('shows the frozen score out of 900, the count and the rarest answer at the end', () => {
    start();
    finishWon();
    const dialog = screen.getByTestId('end-dialog');
    expect(within(dialog).getByText('Bravo, grille complète !')).toBeTruthy();
    expect(within(dialog).getByText(/9\/9 trouvés/)).toBeTruthy();
    expect(within(dialog).getByTestId('score').textContent).toMatch(/^\d+\/900$/);
    expect(within(dialog).getByTestId('rarest').textContent).toContain('Réponse la plus rare');
    expect(within(dialog).getByText('Rareté estimée')).toBeTruthy();
    const total = Number(within(dialog).getByTestId('score').textContent?.split('/')[0]);
    expect(within(dialog).getByTestId('title').textContent).toContain(
      {
        curious: 'Curieux',
        trainer: 'Dresseur',
        expert: 'Expert',
        champion: 'Champion',
        legend: 'Légende',
      }[titleFor(total)],
    );
  });

  it('lists the solutions of a cell from the best known to the rarest, each with its tier', () => {
    start();
    fireEvent.click(screen.getByTestId('abandon'));
    fireEvent.click(screen.getByText('Oui, abandonner'));
    fireEvent.click(screen.getByTestId('see-solutions'));
    fireEvent.click(screen.getByTestId('cell-1-1'));
    const rows = within(screen.getByTestId('solutions-dialog')).getAllByRole('listitem');
    const expected = sortByPopularity(solutionsFor(demoGrid, memberships, 4), popularity);
    expect(rows).toHaveLength(expected.length);
    expect(rows[0]?.textContent).toContain(pokemonById(expected[0] ?? 1).nameFr);
    expect(rows.at(-1)?.textContent).toContain(pokemonById(expected.at(-1) ?? 1).nameFr);
    expect(rows[0]?.querySelector('[data-tier]')?.getAttribute('data-tier')).toBe('common');
    expect(rows.at(-1)?.querySelector('[data-tier]')?.getAttribute('data-tier')).toBe('veryRare');
    const lastRank = rankScore(expected.at(-1) ?? 1, expected, popularity);
    expect(lastRank).toBeGreaterThanOrEqual(0.75); // ties can keep the last one below exactly 1
  });

  it('opens the stats: games, win rate, average, best, streak and distribution', () => {
    start();
    finishWon();
    fireEvent.click(screen.getByTestId('open-stats-end'));
    const dialog = screen.getByTestId('stats-dialog');
    expect(within(dialog).getByTestId('stat-Parties').textContent).toBe('1');
    expect(within(dialog).getByTestId('stat-Victoires').textContent).toBe('100 %');
    expect(within(dialog).getByTestId('stat-Série').textContent).toBe('1');
    expect(within(dialog).getByTestId('best-title').textContent).toContain('Meilleur titre');
    const bars = within(dialog).getByTestId('distribution').querySelectorAll('li');
    expect(bars).toHaveLength(9);
    expect([...bars].reduce((n, li) => n + Number(li.getAttribute('data-count')), 0)).toBe(1);
  });

  it('shows an empty stats dialog before any game', () => {
    start();
    fireEvent.click(screen.getByTestId('open-stats'));
    expect(screen.getByText('Aucune partie terminée pour l’instant.')).toBeTruthy();
    expect(screen.queryByTestId('best-title')).toBeNull();
  });

  it('shares a spoiler-free text, copies it and confirms with a toast', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    start();
    finishWon();
    await act(async () => {
      fireEvent.click(screen.getByTestId('share'));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = String((writeText.mock.calls as unknown as string[][])[0]?.[0]);
    expect(text.split('\n')[0]).toMatch(new RegExp(`^${APP_NAME} #1 — \\d+/900 🔥 1$`));
    expect(text.split('\n').slice(1, 4).join('')).toMatch(/^[🟩🟨🟧🟪]{9}$/u);
    const lower = text.toLowerCase();
    for (const p of pokedex.pokemon) {
      expect(lower.includes(p.nameFr.toLowerCase()), p.nameFr).toBe(false);
      expect(lower.includes(p.nameEn.toLowerCase()), p.nameEn).toBe(false);
    }
    expect((await screen.findByTestId('toast')).textContent).toContain('copié');
  });
});

describe('difficulty of the grid', () => {
  it('is shown with the grid, as a name and five squares', () => {
    start();
    const { level, levelIndex } = gridDifficulty(demoGrid, memberships, popularity);
    const badge = screen.getByTestId('difficulty');
    expect(badge.getAttribute('data-level')).toBe(level);
    expect(badge.textContent).toContain('Difficulté');
    expect(badge.textContent).toContain(
      {
        veryEasy: 'Très facile',
        easy: 'Facile',
        medium: 'Intermédiaire',
        hard: 'Difficile',
        veryHard: 'Très difficile',
      }[level],
    );
    expect(badge.getAttribute('aria-label')).toBe(
      `Difficulté de la grille : ${badge.textContent?.split('Difficulté')[1]?.trim()} (${levelIndex + 1} sur ${DIFFICULTY_LEVELS.length})`,
    );
    const squares = badge.querySelectorAll('span.bg-lcd-ink');
    expect(squares).toHaveLength(levelIndex + 1);
  });
});
