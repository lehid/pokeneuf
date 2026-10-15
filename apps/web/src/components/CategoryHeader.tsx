import { categoryAccent, getCategory, readableTextColor } from '@pokeneuf/core';
import { useState } from 'react';
import { useGame } from '../GameContext';
import { fr } from '../i18n/fr';
import { FamilyIcon } from './FamilyIcon';
import { TypeIcon } from './TypeIcon';
import { Modal } from './Modal';
import { ReportLink } from './ReportLink';

/** A row or column title. Tapping it explains exactly what counts (ROADMAP §1.6). */
export function CategoryHeader({ id, axis }: { id: string; axis: 'row' | 'col' }) {
  const category = getCategory(id);
  const [open, setOpen] = useState(false);
  const grid = useGame((s) => s.grid);
  const accent = categoryAccent(category);
  const label = category.label.fr;

  return (
    <>
      <button
        type="button"
        className="panel flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-center text-[0.7rem] leading-tight font-bold sm:text-sm"
        style={
          accent === null ? undefined : { background: accent, color: readableTextColor(accent) }
        }
        aria-label={axis === 'row' ? fr.rowHeader(label) : fr.colHeader(label)}
        aria-haspopup="dialog"
        data-testid={`${axis}-header-${id}`}
        onClick={() => setOpen(true)}
      >
        {category.type === undefined ? (
          <FamilyIcon family={category.family} />
        ) : (
          <TypeIcon type={category.type} size={22} />
        )}
        <span>{label}</span>
      </button>
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <p className="mb-1 text-xs font-bold tracking-wide uppercase text-lcd-soft">
            {fr.definition}
          </p>
          <p className="mb-4">{category.definition.fr}</p>
          <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(false)}>
            {fr.close}
          </button>
          <p className="mt-2 text-center text-sm">
            <ReportLink
              testId="report-definition"
              context={{
                kind: 'definition',
                categoryId: id,
                gridId: grid.id,
                gridDate: grid.date,
              }}
            />
          </p>
        </Modal>
      )}
    </>
  );
}
