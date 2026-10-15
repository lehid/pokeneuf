/**
 * Facts of the legal notices, given by the owner of the site (2026-10-15). A `null` would show a
 * visible "À compléter" marker on the page (`#/legal`), so nothing is ever published silently empty.
 * French law (LCEN, art. 6): a private individual may stay anonymous towards the public if the
 * host holds their identity; here the publisher chose to be named.
 */
export const LEGAL = {
  /** Name or pseudonym of the publisher. */
  publisherName: 'Lehid' as string | null,
  /** Legal status. */
  publisherStatus: 'Particulier' as string | null,
  /** Postal address, as the publisher wants it shown. */
  publisherAddress: 'Paris, France' as string | null,
  /** Director of the publication (the publisher). */
  publicationDirector: 'Lehid' as string | null,
  /** The address that is read (a mailbox of its own, not a personal one). */
  contactEmail: 'angulaire37.abbaye@icloud.com' as string | null,
};

/** Date of the last review of the legal notices (shown on the page). */
export const LEGAL_UPDATED = '2026-10-15';

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
