import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseInline', () => {
  it('reads bold, code and safe links', () => {
    expect(parseInline('a **b** `c` [d](#/faq) e')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'strong', text: 'b' },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'c' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'd', href: '#/faq' },
      { type: 'text', text: ' e' },
    ]);
  });

  it('turns an unsafe link into plain text', () => {
    for (const href of ['javascript:alert', 'data:text/html,x', 'vbscript:x', '//evil.test']) {
      expect(parseInline(`[click](${href})`), href).toEqual([{ type: 'text', text: 'click' }]);
    }
  });

  it('accepts web, mail and site links', () => {
    for (const href of ['https://a.test/x', 'http://a.test', 'mailto:a@b.test', '/x', './x']) {
      expect(parseInline(`[l](${href})`)).toEqual([{ type: 'link', text: 'l', href }]);
    }
  });

  it('never produces markup from the text itself', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([
      { type: 'text', text: '<img src=x onerror=alert(1)>' },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('reads headings, paragraphs and bullet lists', () => {
    const blocks = parseMarkdown(
      [
        '# Titre',
        '',
        'Un paragraphe',
        'sur deux lignes.',
        '',
        '## 1.0',
        '- un',
        '- deux **gras**',
      ].join('\n'),
    );
    expect(blocks).toEqual([
      { type: 'heading', level: 1, children: [{ type: 'text', text: 'Titre' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Un paragraphe sur deux lignes.' }] },
      { type: 'heading', level: 2, children: [{ type: 'text', text: '1.0' }] },
      {
        type: 'list',
        items: [
          [{ type: 'text', text: 'un' }],
          [
            { type: 'text', text: 'deux ' },
            { type: 'strong', text: 'gras' },
          ],
        ],
      },
    ]);
  });

  it('keeps an indented line in the bullet it continues', () => {
    expect(parseMarkdown('- un\n  suite\n- deux')).toEqual([
      {
        type: 'list',
        items: [
          [
            { type: 'text', text: 'un' },
            { type: 'text', text: ' suite' },
          ],
          [{ type: 'text', text: 'deux' }],
        ],
      },
    ]);
  });

  it('ends a list at a paragraph, and handles Windows line breaks and empty input', () => {
    expect(parseMarkdown('- a\r\nsuite\r\n')).toEqual([
      { type: 'list', items: [[{ type: 'text', text: 'a' }]] },
      { type: 'paragraph', children: [{ type: 'text', text: 'suite' }] },
    ]);
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n  \n')).toEqual([]);
  });
});
