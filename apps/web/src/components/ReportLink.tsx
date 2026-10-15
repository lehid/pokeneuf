import { buildReportUrl, type ReportContext } from '@pokeneuf/core';
import { fr } from '../i18n/fr';

/**
 * "Report an error": a plain link to a pre-filled GitHub issue form. No script, no request from
 * this site: the player decides on GitHub whether to send anything.
 */
export function ReportLink({
  context,
  testId,
  className = '',
}: {
  context: ReportContext;
  testId: string;
  className?: string;
}) {
  return (
    <a
      href={buildReportUrl(context)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block py-2 font-bold underline underline-offset-2 ${className}`}
      data-testid={testId}
    >
      {fr.report.link}
      <span className="sr-only"> {fr.report.newTab}</span>
    </a>
  );
}
