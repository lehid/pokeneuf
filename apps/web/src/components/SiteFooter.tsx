import { fr } from '../i18n/fr';
import { REPO_URL } from '../content/legal';

const LINKS = [
  { href: '#/faq', label: fr.footer.faq, id: 'faq' },
  { href: '#/changelog', label: fr.footer.changelog, id: 'changelog' },
  { href: '#/archives', label: fr.footer.archives, id: 'archives' },
  { href: '#/legal', label: fr.footer.legal, id: 'legal' },
] as const;

/** On every page: the way to the info pages, and the non-affiliation notice (ROADMAP §2.4). */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex flex-col items-center gap-3 pt-4 text-center text-xs text-lcd-soft">
      <nav aria-label={fr.footer.nav}>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                className="inline-block py-2 font-bold underline underline-offset-2"
                data-testid={`footer-${link.id}`}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={REPO_URL}
              className="inline-block py-2 font-bold underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {fr.footer.source}
            </a>
          </li>
        </ul>
      </nav>
      <p>{fr.disclaimer}</p>
    </footer>
  );
}
