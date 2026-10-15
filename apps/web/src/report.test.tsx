import {
  ISSUES_URL,
  REPORT_FIELDS,
  REPORT_KIND_OPTIONS,
  REPORT_LABEL,
  REPORT_TEMPLATE,
} from '@pokeneuf/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { FaqPage } from './components/InfoPages';
import { demoGrid } from './data';
import { fr } from './i18n/fr';
import { memoryStorage } from './storage';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function start() {
  const storage = memoryStorage({ 'pokeneuf:v1:settings': '{"version":1,"hideRules":true}' });
  render(<App storage={storage} now={() => new Date(`${demoGrid.date}T11:00:00Z`)} demo />);
}

const PREFIX = `${ISSUES_URL}/new?template=${REPORT_TEMPLATE}&`;

function expectSafeReportLink(link: HTMLElement) {
  expect(link.tagName).toBe('A');
  expect(link.getAttribute('href')?.startsWith(PREFIX)).toBe(true);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(link.textContent).toContain(fr.report.link);
}

function params(link: HTMLElement): URLSearchParams {
  return new URL(link.getAttribute('href') ?? '').searchParams;
}

describe('"Signaler une erreur" links', () => {
  it('is in the definition dialog of a category, after the close button', () => {
    start();
    const id = demoGrid.rows[0] ?? '';
    fireEvent.click(screen.getByTestId(`row-header-${id}`));
    const link = screen.getByTestId('report-definition');
    expectSafeReportLink(link);
    const p = params(link);
    expect(p.get(REPORT_FIELDS.kind)).toBe(REPORT_KIND_OPTIONS.definition);
    expect(p.get(REPORT_FIELDS.location)).toContain(`(${id})`);
    expect(p.get(REPORT_FIELDS.grid)).toContain(demoGrid.date);
    // The first control of the dialog stays the close button (initial focus), the link follows it.
    const dialog = link.closest('dialog') as HTMLElement;
    const focusables = [...dialog.querySelectorAll('button, a[href]')];
    expect(focusables[0]?.textContent).toBe(fr.close);
    expect(focusables[1]).toBe(link);
  });

  it('is in the solutions dialog of a cell, with the cell and its two categories', () => {
    start();
    fireEvent.click(screen.getByTestId('abandon'));
    fireEvent.click(screen.getByText('Oui, abandonner'));
    fireEvent.click(screen.getByTestId('see-solutions'));
    fireEvent.click(screen.getByTestId('cell-1-2'));
    const dialog = screen.getByTestId('solutions-dialog');
    const link = within(dialog).getByTestId('report-answer');
    expectSafeReportLink(link);
    const p = params(link);
    expect(p.get(REPORT_FIELDS.kind)).toBe(REPORT_KIND_OPTIONS.answer);
    expect(p.get(REPORT_FIELDS.location)).toContain('Case ligne 2 × colonne 3');
    expect(p.get(REPORT_FIELDS.grid)).toContain(`n° ${demoGrid.id}`);
    expect(p.has(REPORT_FIELDS.pokemon)).toBe(false);
    expect([...dialog.querySelectorAll('button, a[href]')].at(-1)).toBe(link);
  });

  it('is in the FAQ, in the data section, as a generic report', () => {
    render(<FaqPage />);
    const link = within(screen.getByTestId('faq-data')).getByTestId('report-faq');
    expectSafeReportLink(link);
    expect(params(link).get(REPORT_FIELDS.kind)).toBe(REPORT_KIND_OPTIONS.other);
    expect(screen.getByTestId('faq-data').textContent).not.toContain('dépôt');
  });

  it('is not in the footer', () => {
    start();
    expect(within(screen.getByRole('contentinfo')).queryByText(fr.report.link)).toBeNull();
  });
});

describe('issue form erreur-donnee.yml', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const yaml = readFileSync(
    path.join(here, '../../../.github/ISSUE_TEMPLATE', REPORT_TEMPLATE),
    'utf8',
  );

  it('has every field id the link pre-fills or the maintainers rely on', () => {
    const ids = [...yaml.matchAll(/^\s+id: (\w+)\s*$/gm)].map((m) => m[1]);
    expect(ids).toEqual(Object.values(REPORT_FIELDS));
  });

  it('offers the dropdown options word for word, in the same order', () => {
    const block = yaml.split('id: kind')[1]?.split('validations:')[0] ?? '';
    const options = [...block.matchAll(/^\s+- (.+)$/gm)].map((m) => m[1]);
    expect(options).toEqual(Object.values(REPORT_KIND_OPTIONS));
  });

  it('labels the issue data-error, and blank issues are disabled', () => {
    expect(yaml).toContain(`labels: ['${REPORT_LABEL}']`);
    const config = readFileSync(
      path.join(here, '../../../.github/ISSUE_TEMPLATE/config.yml'),
      'utf8',
    );
    expect(config).toMatch(/^blank_issues_enabled: false$/m);
    expect(config).not.toContain('contact_links');
  });
});
