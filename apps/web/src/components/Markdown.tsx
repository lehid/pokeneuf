import { parseMarkdown, type MarkdownInline } from '@pokeneuf/core';
import { createElement, Fragment, useMemo } from 'react';

function Inline({ nodes }: { nodes: readonly MarkdownInline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return <Fragment key={i}>{node.text}</Fragment>;
          case 'strong':
            return <strong key={i}>{node.text}</strong>;
          case 'code':
            return (
              <code key={i} className="bg-lcd-panel-2 px-1 font-mono text-[0.9em]">
                {node.text}
              </code>
            );
          case 'link': {
            const external = /^(https?:|mailto:)/i.test(node.href);
            return (
              <a
                key={i}
                href={node.href}
                className="font-bold underline underline-offset-2"
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {node.text}
              </a>
            );
          }
        }
      })}
    </>
  );
}

/**
 * Renders the Markdown subset of `parseMarkdown` as React elements (never as HTML).
 * `# ` becomes `<h{1 + headingOffset}>`: the page already owns the `<h1>` and its own title.
 */
export function Markdown({
  source,
  headingOffset = 1,
}: {
  source: string;
  headingOffset?: number;
}) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className="flex flex-col gap-3 leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return createElement(
              `h${Math.min(6, block.level + headingOffset)}`,
              { key: i, className: 'mt-2 text-base font-bold' },
              <Inline nodes={block.children} />,
            );
          case 'paragraph':
            return (
              <p key={i}>
                <Inline nodes={block.children} />
              </p>
            );
          case 'list':
            return (
              <ul key={i} className="list-disc space-y-2 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline nodes={item} />
                  </li>
                ))}
              </ul>
            );
        }
      })}
    </div>
  );
}
