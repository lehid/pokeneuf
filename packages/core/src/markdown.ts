/**
 * A tiny, safe Markdown subset for the changelog: headings, paragraphs, bullet lists, and inline
 * **bold**, `code` and [links](url). It returns a tree (never HTML), so the UI renders it without
 * `dangerouslySetInnerHTML` and an unsafe link can only ever become plain text.
 */
export type MarkdownInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; children: MarkdownInline[] }
  | { type: 'paragraph'; children: MarkdownInline[] }
  | { type: 'list'; items: MarkdownInline[][] };

/** Links may point to the site itself, to the web, or to a mail address. Nothing else. */
const SAFE_HREF = /^(https?:\/\/|mailto:|#\/|\/(?!\/)|\.\/)/i;

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(source: string): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  let last = 0;
  const pushText = (text: string) => {
    if (text !== '') out.push({ type: 'text', text });
  };
  for (const match of source.matchAll(INLINE)) {
    pushText(source.slice(last, match.index));
    last = match.index + match[0].length;
    const [whole, strong, code, label, href] = match;
    if (strong !== undefined) out.push({ type: 'strong', text: strong });
    else if (code !== undefined) out.push({ type: 'code', text: code });
    else if (label !== undefined && href !== undefined && SAFE_HREF.test(href)) {
      out.push({ type: 'link', text: label, href });
    } else pushText(label ?? whole);
  }
  pushText(source.slice(last));
  return out;
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s*[-*]\s+(.*)$/;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: MarkdownInline[][] | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
    if (list !== null) {
      blocks.push({ type: 'list', items: list });
      list = null;
    }
  };

  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);
    if (line.trim() === '') {
      flush();
    } else if (heading?.[1] !== undefined && heading[2] !== undefined) {
      flush();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2]),
      });
    } else if (bullet?.[1] !== undefined) {
      if (paragraph.length > 0) flush();
      (list ??= []).push(parseInline(bullet[1]));
    } else if (list !== null && /^\s+\S/.test(line)) {
      // Continuation of the previous bullet.
      const previous = list.pop() ?? [];
      list.push([...previous, ...parseInline(` ${line.trim()}`)]);
    } else {
      if (list !== null) flush();
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}
