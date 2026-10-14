import {
  APP_NAME,
  CATEGORIES,
  CATEGORY_FAMILIES,
  MAX_SCORE,
  RARITY_TIERS,
  SCORE_TITLES,
  SCORING,
  TITLE_FLOORS,
  type Category,
  type CategoryFamily,
} from '@pokeneuf/core';
import { useEffect, type ReactNode } from 'react';
import changelog from '../content/changelog.md?raw';
import { ISSUES_URL, LEGAL, type LegalField } from '../content/legal';
import { pokedex } from '../data';
import { fr } from '../i18n/fr';
import { FamilyIcon } from './FamilyIcon';
import { Markdown } from './Markdown';
import { RarityChip } from './RarityChip';
import { Shell } from './Shell';

/** Names the page in the tab and in the history; the game's own title comes back when it closes. */
function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

function InfoLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  usePageTitle(title);
  return (
    <Shell>
      <a href="#/" className="btn self-start" data-testid="back-to-game">
        {fr.backToGame}
      </a>
      <article className="panel flex flex-col gap-4 p-4 sm:p-6">
        <h2 className="title-pixel text-sm leading-relaxed sm:text-base">{title}</h2>
        {intro !== undefined && <p className="text-lcd-soft">{intro}</p>}
        {children}
      </article>
    </Shell>
  );
}

function Section({
  id,
  title,
  open = false,
  children,
}: {
  id: string;
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group border-[3px] border-lcd-ink bg-lcd-panel-2"
      open={open}
      data-testid={`faq-${id}`}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-3 font-bold [&::-webkit-details-marker]:hidden">
        <h3>{title}</h3>
        <span aria-hidden="true" className="group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t-[3px] border-lcd-ink bg-lcd-panel p-3 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

function Paragraphs({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </>
  );
}

/** Every category of the registry, by family: the very definitions that validate the answers. */
function CategoryDefinitions() {
  const byFamily = new Map<CategoryFamily, Category[]>();
  for (const category of CATEGORIES) {
    byFamily.set(category.family, [...(byFamily.get(category.family) ?? []), category]);
  }
  return (
    <div className="flex flex-col gap-4" data-testid="category-definitions">
      {CATEGORY_FAMILIES.filter((family) => byFamily.has(family)).map((family) => (
        <section key={family} aria-labelledby={`family-${family}`}>
          <h4 id={`family-${family}`} className="mb-2 flex items-center gap-2 font-bold">
            <FamilyIcon family={family} />
            {fr.familyLabels[family]}
          </h4>
          <dl className="flex flex-col gap-2">
            {(byFamily.get(family) ?? []).map((category) => (
              <div key={category.id} data-category={category.id}>
                <dt className="font-bold">{category.label.fr}</dt>
                <dd className="text-lcd-soft">{category.definition.fr}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function FaqPage() {
  const s = fr.faq.sections;
  return (
    <InfoLayout title={fr.faq.title} intro={fr.faq.intro}>
      <div className="flex flex-col gap-3">
        <Section id="play" title={s.play.title} open>
          <Paragraphs items={s.play.paragraphs} />
        </Section>
        <Section id="categories" title={s.categories.title}>
          <p>{s.categories.intro(CATEGORIES.length)}</p>
          <p className="text-lcd-soft">{s.categories.inGame}</p>
          <CategoryDefinitions />
        </Section>
        <Section id="score" title={s.score.title}>
          <p>
            {s.score.main({
              base: SCORING.basePoints,
              bonus: SCORING.rankPoints,
              penalty: SCORING.errorPenalty,
              max: MAX_SCORE,
            })}
          </p>
          <Paragraphs items={s.score.paragraphs} />
          <ul className="list-disc space-y-1 pl-5">
            {SCORE_TITLES.map((title) => (
              <li key={title}>{s.score.titleLine(fr.titles[title], TITLE_FLOORS[title])}</li>
            ))}
          </ul>
        </Section>
        <Section id="rarity" title={s.rarity.title}>
          <Paragraphs items={s.rarity.paragraphs} />
          <ul className="flex flex-col gap-2">
            {RARITY_TIERS.map((tier, i) => (
              <li key={tier} className="flex flex-wrap items-center gap-2">
                <RarityChip tier={tier} />
                <span>{s.rarity.tierRules[i]}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section id="streak" title={s.streak.title}>
          <Paragraphs items={s.streak.paragraphs} />
        </Section>
        <Section id="data" title={s.data.title}>
          <Paragraphs items={s.data.paragraphs} />
        </Section>
        <Section id="generations" title={s.generations.title}>
          <p>{s.generations.text(pokedex.meta.count)}</p>
        </Section>
        <Section id="types" title={s.types.title}>
          <Paragraphs items={s.types.paragraphs} />
        </Section>
        <Section id="evolutions" title={s.evolutions.title}>
          <Paragraphs items={s.evolutions.paragraphs} />
        </Section>
      </div>
    </InfoLayout>
  );
}

export function ChangelogPage({ source = changelog }: { source?: string }) {
  return (
    <InfoLayout title={fr.changelog.title} intro={fr.changelog.intro}>
      <Markdown source={source} headingOffset={1} />
    </InfoLayout>
  );
}

const LEGAL_LABEL = {
  publisherName: 'name',
  publisherStatus: 'status',
  publisherAddress: 'address',
  publicationDirector: 'director',
  contactEmail: 'contact',
} as const satisfies Record<LegalField, keyof typeof fr.legal.sections.publisher.labels>;

function LegalValue({ field, value }: { field: LegalField; value: string | null }) {
  if (value !== null && value.trim() !== '') return <>{value}</>;
  return (
    <mark
      className="bg-lcd-danger px-1 font-bold text-lcd-panel"
      data-testid={`legal-todo-${field}`}
    >
      {fr.legal.todo}
    </mark>
  );
}

export function LegalPage({ legal = LEGAL }: { legal?: Record<LegalField, string | null> }) {
  const s = fr.legal.sections;
  const fields = Object.keys(LEGAL_LABEL) as LegalField[];
  return (
    <InfoLayout title={fr.legal.title}>
      <div className="flex flex-col gap-5 leading-relaxed">
        <section aria-labelledby="legal-publisher" data-testid="legal-publisher">
          <h3 id="legal-publisher" className="mb-2 font-bold">
            {s.publisher.title}
          </h3>
          <dl className="flex flex-col gap-2">
            {fields.map((field) => (
              <div key={field}>
                <dt className="text-xs font-bold text-lcd-soft">
                  {s.publisher.labels[LEGAL_LABEL[field]]}
                </dt>
                <dd>
                  <LegalValue field={field} value={legal[field]} />
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-xs font-bold text-lcd-soft">{s.publisher.contactIssues}</dt>
              <dd>
                <a
                  href={ISSUES_URL}
                  className="font-bold break-all underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ISSUES_URL}
                </a>
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="legal-host">
          <h3 id="legal-host" className="mb-2 font-bold">
            {s.host.title}
          </h3>
          <p>{s.host.text}</p>
        </section>
        <section aria-labelledby="legal-affiliation">
          <h3 id="legal-affiliation" className="mb-2 font-bold">
            {s.affiliation.title}
          </h3>
          <div className="flex flex-col gap-2">
            <Paragraphs items={s.affiliation.paragraphs} />
          </div>
        </section>
        <section aria-labelledby="legal-privacy">
          <h3 id="legal-privacy" className="mb-2 font-bold">
            {s.privacy.title}
          </h3>
          <div className="flex flex-col gap-2">
            <Paragraphs items={s.privacy.paragraphs} />
          </div>
        </section>
      </div>
    </InfoLayout>
  );
}
