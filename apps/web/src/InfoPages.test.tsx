import {
  APP_NAME,
  CATEGORIES,
  CATEGORY_FAMILIES,
  MAX_SCORE,
  SCORE_TITLES,
  SCORING,
  TITLE_FLOORS,
} from '@pokeneuf/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { ChangelogPage, FaqPage, LegalPage } from './components/InfoPages';
import changelog from './content/changelog.md?raw';
import { LEGAL, missingLegalFields, type LegalField } from './content/legal';
import { demoGrid } from './data';
import { fr } from './i18n/fr';
import { memoryStorage } from './storage';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});
beforeEach(() => {
  window.location.hash = '';
});

describe('FaqPage', () => {
  it('lists every category of the registry, with its exact definition, by family', () => {
    render(<FaqPage />);
    const defs = screen.getByTestId('category-definitions');
    for (const category of CATEGORIES) {
      const item = defs.querySelector(`[data-category="${category.id}"]`);
      expect(item, category.id).not.toBeNull();
      expect(item?.textContent).toContain(category.label.fr);
      expect(item?.textContent).toContain(category.definition.fr);
    }
    const families = [...defs.querySelectorAll('h4')].map((h) => h.textContent);
    expect(families).toEqual(CATEGORY_FAMILIES.map((family) => fr.familyLabels[family]));
  });

  it('gives the numbers of the score from the scoring constants, not from a copy', () => {
    render(<FaqPage />);
    const score = screen.getByTestId('faq-score').textContent ?? '';
    expect(score).toContain(`${SCORING.basePoints} points`);
    expect(score).toContain(`${SCORING.rankPoints} points`);
    expect(score).toContain(`${SCORING.errorPenalty} points`);
    expect(score).toContain(`${MAX_SCORE}`);
    for (const title of SCORE_TITLES) {
      expect(score).toContain(
        fr.faq.sections.score.titleLine(fr.titles[title], TITLE_FLOORS[title]),
      );
    }
  });

  it('explains the estimated rarity, the data, the scope, current types and evolutions', () => {
    render(<FaqPage />);
    for (const id of ['rarity', 'data', 'generations', 'types', 'evolutions']) {
      expect(screen.getByTestId(`faq-${id}`), id).toBeTruthy();
    }
    expect(screen.getByTestId('faq-rarity').textContent).toContain('Ce n’est pas un pourcentage');
    expect(screen.getByTestId('faq-types').textContent).toContain('Fée');
    expect(screen.getByTestId('faq-generations').textContent).toContain('493');
    expect(screen.getByTestId('faq-evolutions').textContent).toContain('Colossinge');
  });

  it('is titled in the tab, and gives the title back when it closes', () => {
    document.title = APP_NAME;
    const { unmount } = render(<FaqPage />);
    expect(document.title).toBe(`${fr.faq.title} · ${APP_NAME}`);
    unmount();
    expect(document.title).toBe(APP_NAME);
  });
});

describe('ChangelogPage', () => {
  it('renders the markdown file, with the site title as the only h1', () => {
    render(<ChangelogPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: fr.changelog.title })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /Version 1\.0/ })).toBeTruthy();
    expect(changelog).toContain('Version 1.0');
  });

  it('links to the FAQ inside the site and opens other sites in a new tab safely', () => {
    render(<ChangelogPage source={'[FAQ](#/faq) et [ailleurs](https://example.org)'} />);
    const page = within(screen.getByRole('article'));
    expect(page.getByRole('link', { name: 'FAQ' }).getAttribute('href')).toBe('#/faq');
    const external = page.getByRole('link', { name: 'ailleurs' });
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toContain('noopener');
  });

  it('never injects markup from the file', () => {
    const { container } = render(
      <ChangelogPage source={'<img src=x onerror=alert(1)> [a](javascript:x)'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });
});

describe('LegalPage', () => {
  const filled: Record<LegalField, string> = {
    publisherName: 'Jeanne Martin',
    publisherStatus: 'Particulier',
    publisherAddress: 'Adresse communiquée à l’hébergeur',
    publicationDirector: 'Jeanne Martin',
    contactEmail: 'contact@example.org',
  };

  it('has the host, the non-affiliation notice and the privacy statement', () => {
    render(<LegalPage legal={filled} />);
    expect(screen.getByText(/GitHub Pages/)).toBeTruthy();
    expect(screen.getByText(/GitHub, Inc\./)).toBeTruthy();
    const text = document.body.textContent ?? '';
    for (const owner of ['Nintendo', 'Game Freak', 'The Pokémon Company']) {
      expect(text, owner).toContain(owner);
    }
    expect(text).toContain('aucun cookie');
  });

  it('marks every fact the owner has not given with a visible "À compléter"', () => {
    render(<LegalPage legal={{ ...filled, contactEmail: null, publisherName: ' ' }} />);
    expect(screen.getByTestId('legal-todo-contactEmail').textContent).toMatch(/^À compléter/);
    expect(screen.getByTestId('legal-todo-publisherName')).toBeTruthy();
    expect(screen.queryByTestId('legal-todo-publisherStatus')).toBeNull();
    expect(screen.getByText('Jeanne Martin', { selector: 'dd' })).toBeTruthy();
  });

  it('shows no marker once everything is filled', () => {
    render(<LegalPage legal={filled} />);
    expect(screen.queryByTestId(/^legal-todo-/)).toBeNull();
  });

  it('lists what is still missing in the real notices (TODO for the owner before launch)', () => {
    expect(missingLegalFields({ ...filled })).toEqual([]);
    expect(missingLegalFields({ ...filled, publisherAddress: null })).toEqual(['publisherAddress']);
    // Not asserted to be empty: until the owner fills `content/legal.ts`, the page says so itself.
    render(<LegalPage />);
    expect(screen.queryAllByTestId(/^legal-todo-/)).toHaveLength(missingLegalFields(LEGAL).length);
  });
});

describe('navigation', () => {
  const app = () =>
    render(
      <App
        storage={memoryStorage({ 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' })}
        now={() => new Date(`${demoGrid.date}T11:00:00Z`)}
        demo
      />,
    );

  it('reaches the info pages from the footer of the game, even on the demo grid', () => {
    app();
    const footer = screen.getByRole('navigation', { name: fr.footer.nav });
    expect(within(footer).getAllByRole('link').length).toBeGreaterThanOrEqual(4);
    window.location.hash = '#/faq';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('heading', { level: 2, name: fr.faq.title })).toBeTruthy();
    fireEvent.click(screen.getByTestId('back-to-game'));
    window.location.hash = '#/';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByTestId('lives')).toBeTruthy();
  });

  it('keeps the non-affiliation notice and the footer links on every info page', () => {
    for (const hash of ['#/faq', '#/changelog', '#/legal']) {
      window.location.hash = hash;
      const { unmount } = app();
      expect(screen.getByText(/non affilié/), hash).toBeTruthy();
      expect(screen.getByTestId('footer-legal'), hash).toBeTruthy();
      unmount();
    }
  });
});
