/**
 * Facts of the legal notices that only the owner of the site can provide.
 *
 * TODO(owner): replace every `null` below before the public launch (2026-11-01). A `null` shows a
 * visible "À compléter" marker on the page (`#/legal`), so nothing is published silently empty.
 * French law (LCEN, art. 6): a private individual may stay anonymous towards the public if the
 * host holds their identity, but the notices must still say so; a professional must give the
 * full identity.
 */
export const LEGAL = {
  /** Name or pseudonym of the publisher, e.g. `'Jean Dupont'`. */
  publisherName: null as string | null,
  /** Legal status, e.g. `'Particulier'` or the name and number of the association. */
  publisherStatus: null as string | null,
  /** Postal address, or `'Adresse communiquée à l’hébergeur'` if the publisher stays anonymous. */
  publisherAddress: null as string | null,
  /** Director of the publication (often the publisher). */
  publicationDirector: null as string | null,
  /** A contact address that is read, e.g. `'contact@example.org'`. */
  contactEmail: null as string | null,
};

export type LegalField = keyof typeof LEGAL;

// The repository constants live in `@pokeneuf/core` (the report-an-error link builder needs them too).
export { ISSUES_URL, REPO_URL } from '@pokeneuf/core';

/** The facts still to provide. Empty once the site is ready to launch. */
export function missingLegalFields(legal: Record<LegalField, string | null> = LEGAL): LegalField[] {
  return (Object.keys(legal) as LegalField[]).filter((key) => {
    const value = legal[key];
    return value === null || value.trim() === '';
  });
}
