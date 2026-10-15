import { useEffect, useRef, type ReactNode } from 'react';
import { takeRouteFocus } from '../routeFocus';

/** Marks the heading that names a page: where the focus goes when the page changes. */
export const PAGE_HEADING_ATTRIBUTE = 'data-page-heading';

interface PageHeadingProps {
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The heading of a page. It can take the focus (`tabIndex` -1: not in the Tab order), and does so
 * when it appears right after a route change.
 */
export function PageHeading({ as = 'h2', id, className, children }: PageHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (takeRouteFocus()) ref.current?.focus({ preventScroll: true });
  }, []);
  const props = {
    ref,
    id,
    tabIndex: -1,
    className: `${className ?? ''} focus:outline-none`,
    [PAGE_HEADING_ATTRIBUTE]: '',
  };
  return as === 'h1' ? <h1 {...props}>{children}</h1> : <h2 {...props}>{children}</h2>;
}
