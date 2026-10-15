import { findSolution, gameKey, serializeGame } from '@pokeneuf/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { demoGrid, memberships, pokemonById } from './data';
import { fr } from './i18n/fr';
import { memoryStorage } from './storage';

const solution = findSolution(demoGrid, memberships) ?? [];
const SETTINGS = { 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' };
const DAY = demoGrid.date;
const noon = (date: string) => new Date(`${date}T11:00:00Z`);
const cellId = (cell: number) => `cell-${Math.floor(cell / 3)}-${cell % 3}`;

afterEach(async () => {
  cleanup(); // no app listens any more...
  window.location.hash = '';
  // ...when jsdom delivers the `hashchange` of this reset, a task later: it must not reach the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

/** Every day from 2026-11-01 to 2026-11-`days` is published, as the demo grid under its own date. */
const server = (days = 10) =>
  vi.fn(async (url: string | URL | Request) => {
    const path = String(url);
    if (path.endsWith('/grids/index.json')) {
      const grids = Array.from({ length: days }, (_, i) => ({
        id: i + 1,
        date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      }));
      return new Response(JSON.stringify({ version: 1, grids }));
    }
    const date = /(\d{4}-\d{2}-\d{2})\.json$/.exec(path)?.[1] ?? '';
    const n = Number(date.slice(-2));
    return n >= 1 && n <= days
      ? new Response(JSON.stringify({ ...demoGrid, id: n, date }))
      : new Response('', { status: 404 });
  });

async function open(hash: string, today: string, storage = memoryStorage(SETTINGS), demo = false) {
  window.location.hash = hash;
  // jsdom delivers `hashchange` a task later; a real page loads with its hash already there.
  await new Promise((resolve) => setTimeout(resolve, 0));
  render(
    <App storage={storage} now={() => noon(today)} fetchImpl={server()} baseUrl="/" demo={demo} />,
  );
  return storage;
}

function playDemo(cell: number, name: string) {
  fireEvent.click(screen.getByTestId(cellId(cell)));
  fireEvent.change(screen.getByTestId('guess-input'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('suggestions').querySelector('li') as HTMLElement);
}

describe('the guess combobox (C1, M10)', () => {
  const start = () => {
    window.location.hash = '';
    render(<App storage={memoryStorage(SETTINGS)} now={() => noon(DAY)} demo />);
    fireEvent.click(screen.getByTestId('cell-0-0'));
    return screen.getByTestId('guess-input');
  };

  it('does not play the highlighted suggestion when the input loses the focus', () => {
    const input = start();
    fireEvent.change(input, { target: { value: 'Pika' } });
    expect(screen.getByTestId('suggestions').querySelector('li')).toBeTruthy();
    fireEvent.blur(input);
    expect(screen.getByTestId('lives').getAttribute('data-left')).toBe('3');
    expect(screen.getByTestId('guess-sheet')).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Pika'); // what was typed stays
  });

  it('still plays on Enter', () => {
    const input = start();
    fireEvent.change(input, { target: { value: 'Pika' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const played =
      screen.getByTestId('lives').getAttribute('data-left') !== '3' ||
      screen.getByTestId('cell-0-0').getAttribute('data-state') === 'filled';
    expect(played).toBe(true);
  });

  it('says in French how many Pokémon were found, in a live region inside the dialog', () => {
    const input = start();
    const status = screen.getByTestId('suggestions-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.closest('dialog')).toBe(screen.getByTestId('guess-sheet'));
    expect(status.textContent).toBe('');
    fireEvent.change(input, { target: { value: 'Pika' } });
    const count = screen.getByTestId('suggestions').querySelectorAll('li').length;
    expect(count).toBeGreaterThan(0);
    expect(status.textContent).toBe(fr.suggestionsStatus(count));
    fireEvent.change(input, { target: { value: 'zzzzzz' } });
    expect(status.textContent).toBe(fr.noResult);
  });

  it('keeps "no result" out of the listbox, whose children can only be options', () => {
    const input = start();
    fireEvent.change(input, { target: { value: 'zzzzzz' } });
    const message = screen.getByTestId('no-result');
    expect(message.closest('[role="listbox"]')).toBeNull();
    expect(screen.getByTestId('suggestions').children).toHaveLength(0);
  });
});

describe('the abandon question (M1)', () => {
  it('starts on the safe answer, so a double Enter cannot abandon', () => {
    render(<App storage={memoryStorage(SETTINGS)} now={() => noon(DAY)} demo />);
    fireEvent.click(screen.getByTestId('abandon'));
    expect(document.activeElement).toBe(screen.getByTestId('abandon-no'));
    // The destructive button is after it in the reading and Tab order.
    const no = screen.getByTestId('abandon-no');
    const yes = screen.getByTestId('abandon-yes');
    expect(no.compareDocumentPosition(yes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gives the focus back to the Abandon button when answered', async () => {
    render(<App storage={memoryStorage(SETTINGS)} now={() => noon(DAY)} demo />);
    const abandon = screen.getByTestId('abandon');
    abandon.focus();
    fireEvent.click(abandon);
    fireEvent.click(screen.getByTestId('abandon-no'));
    await waitFor(() => expect(document.activeElement).toBe(abandon));
  });

  it('gives the focus back to the cell after a move is played', async () => {
    render(<App storage={memoryStorage(SETTINGS)} now={() => noon(DAY)} demo />);
    const cell = screen.getByTestId('cell-0-0');
    cell.focus();
    playDemo(0, pokemonById(solution[0] ?? 1).nameFr);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('cell-0-0')));
  });
});

describe('the end screen (M10, M13)', () => {
  it('shows the frozen score of a finished game, whatever the data say now', () => {
    const state = {
      gridId: 1,
      cells: solution,
      errors: 0,
      status: 'won' as const,
    };
    const storage = memoryStorage({
      ...SETTINGS,
      'pokeneuf:v1:demo:game:1': serializeGame({ state, finishedOn: DAY, score: 123 }),
    });
    render(<App storage={storage} now={() => noon(DAY)} demo />);
    expect(screen.getByTestId('header-score').getAttribute('data-score')).toBe('123');
    fireEvent.click(screen.getByTestId('open-end'));
    expect(within(screen.getByTestId('end-dialog')).getByTestId('score').textContent).toBe(
      '123/900',
    );
  });

  it('announces the "copied" toast inside the end dialog, not in the inert page', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    render(<App storage={memoryStorage(SETTINGS)} now={() => noon(DAY)} demo />);
    fireEvent.click(screen.getByTestId('abandon'));
    fireEvent.click(screen.getByTestId('abandon-yes'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('share'));
    });
    const toast = await screen.findByTestId('toast');
    expect(toast.closest('dialog')).toBe(screen.getByTestId('end-dialog'));
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
    expect(toast.parentElement?.getAttribute('role')).toBe('status');
  });

  it('writes the stats list with the term before its description', () => {
    render(<App storage={memoryStorage(SETTINGS)} now={() => noon(DAY)} demo />);
    fireEvent.click(screen.getByTestId('open-stats'));
    const groups = screen.getByTestId('stats-dialog').querySelectorAll('dl > div');
    expect(groups.length).toBe(6);
    for (const group of groups) {
      expect(group.firstElementChild?.tagName).toBe('DT');
      expect(group.lastElementChild?.tagName).toBe('DD');
    }
  });
});

describe('the streak (M5)', () => {
  const entry = (n: number, status: 'won' | 'lost' | 'abandoned' = 'won') => ({
    gridId: n,
    date: `2026-11-0${n}`,
    status,
    found: status === 'won' ? 9 : 0,
    errors: 0,
    score: 100,
  });
  const history = (...entries: ReturnType<typeof entry>[]) => ({
    ...SETTINGS,
    'pokeneuf:v1:history': JSON.stringify({ version: 2, entries }),
  });

  it('in an archive, is the streak as of today, not as of the archived day', async () => {
    await open('#/archive/2026-11-01', '2026-11-05', memoryStorage(history(entry(3), entry(4))));
    expect(await screen.findByTestId('board')).toBeTruthy();
    expect(screen.getByTestId('streak').textContent).toContain('2 jours');
  });

  it('is gone as soon as today is abandoned', async () => {
    await open('', '2026-11-05', memoryStorage(history(entry(3), entry(4), entry(5, 'abandoned'))));
    expect(await screen.findByTestId('board')).toBeTruthy();
    expect(screen.queryByTestId('streak')).toBeNull();
  });

  it('is alive while today is still to play', async () => {
    await open('', '2026-11-05', memoryStorage(history(entry(3), entry(4))));
    expect(await screen.findByTestId('board')).toBeTruthy();
    expect(screen.getByTestId('streak').textContent).toContain('2 jours');
  });
});

describe('corrupted storage (M3)', () => {
  it('does not blank the page for a date that only has the shape of one', async () => {
    const bad = { gridId: 1, date: '2026-00-01', status: 'won', found: 9, errors: 0, score: 5 };
    await open(
      '',
      DAY,
      memoryStorage({
        ...SETTINGS,
        'pokeneuf:v1:history': JSON.stringify({ version: 2, entries: [bad] }),
        [gameKey(1)]: JSON.stringify({
          version: 2,
          gridId: 1,
          cells: Array(9).fill(null),
          errors: 3,
          status: 'lost',
          finishedOn: '2026-00-01',
          score: 0,
        }),
      }),
    );
    expect(await screen.findByTestId('board')).toBeTruthy();
  });

  it('does not wait forever on an archive whose date is not a day: it is the page of the day', async () => {
    await open('#/archive/2026-11-99', DAY);
    expect(await screen.findByTestId('board')).toBeTruthy();
    expect(screen.queryByText(fr.loading)).toBeNull();
    expect(screen.queryByText(/Archive · /)).toBeNull();
  });
});

describe('demo mode and the footer links (LOW)', () => {
  it('lets the archives win over the demo, and the way back leads to the demo again', async () => {
    await open('#/archives', DAY, memoryStorage(SETTINGS), true);
    expect(await screen.findByTestId('archives-empty')).toBeTruthy();
    expect(screen.queryByTestId('board')).toBeNull();
    window.location.hash = '#/';
    await waitFor(() => expect(screen.getByTestId('board')).toBeTruthy());
    expect(screen.getByText(fr.demoGrid, { exact: false })).toBeTruthy();
  });

  it('lets the info pages win over the demo too', async () => {
    await open('#/faq', DAY, memoryStorage(SETTINGS), true);
    expect(await screen.findByText(fr.faq.title)).toBeTruthy();
  });
});

describe('changing page (M11)', () => {
  it('goes back to the top and focuses the heading of the new page, but not on the first load', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo');
    await open('', DAY);
    await screen.findByTestId('board');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);

    window.location.hash = '#/faq';
    const heading = await screen.findByText(fr.faq.title);
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(heading.tagName).toBe('H2');
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not take the focus on the first load of a page', async () => {
    await open('#/faq', DAY);
    await screen.findByText(fr.faq.title);
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses the heading of the game too, when coming back to it', async () => {
    await open('#/faq', DAY);
    await screen.findByText(fr.faq.title);
    window.location.hash = '';
    await screen.findByTestId('board');
    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('H1');
      expect(document.activeElement?.hasAttribute('data-page-heading')).toBe(true);
    });
  });
});

describe('the new day while the tab stays open', () => {
  it('offers the new grid at Paris midnight without any focus event, from a timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false, now: new Date('2026-11-01T22:59:30Z') });
    try {
      render(
        <App
          storage={memoryStorage(SETTINGS)}
          now={() => new Date()}
          fetchImpl={server(2)}
          baseUrl="/"
          demo={false}
        />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(screen.getByTestId('board')).toBeTruthy();
      expect(screen.queryByTestId('new-grid-dialog')).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000); // 00:00:01 in Paris
      });
      expect(screen.getByTestId('new-grid-dialog')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('remembers "plus tard": the dialog does not come back at every focus', async () => {
    let now = new Date('2026-11-01T22:59:00Z');
    render(
      <App
        storage={memoryStorage(SETTINGS)}
        now={() => now}
        fetchImpl={server(2)}
        baseUrl="/"
        demo={false}
      />,
    );
    await screen.findByTestId('board');
    now = new Date('2026-11-01T23:01:00Z');
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
    });
    await waitFor(() => expect(screen.getByTestId('new-grid-dialog')).toBeTruthy());
    fireEvent.click(screen.getByText(fr.newGridLater));
    expect(screen.queryByTestId('new-grid-dialog')).toBeNull();

    await act(async () => {
      fireEvent(document, new Event('visibilitychange'));
      fireEvent(window, new Event('focus'));
    });
    expect(screen.queryByTestId('new-grid-dialog')).toBeNull();
  });
});
