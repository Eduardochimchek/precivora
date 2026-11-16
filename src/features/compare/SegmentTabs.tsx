import { useNavigate } from 'react-router-dom';
import { SegmentIcon, cx } from '@/design-system';
import { useSegments } from '@/hooks/useData';
import type { ID } from '@/types';

/** Fileira de tipos de lugar: tipos de produtos filtram o comparador; combustível abre a tela própria. */
export function SegmentTabs({ active, onSelect }: { active: ID | 'fuel' | ''; onSelect?: (id: ID | '') => void }) {
  const navigate = useNavigate();
  const segments = useSegments() ?? [];
  const pick = (id: ID | '', fuel: boolean) => {
    if (fuel) navigate('/combustiveis');
    else if (onSelect) onSelect(id);
    else navigate(id ? `/comparar?tipo=${id}` : '/comparar');
  };
  const chip = (key: string, selected: boolean, onClick: () => void, children: React.ReactNode) => (
    <button
      key={key}
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cx(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
        selected ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Tipo de lugar">
      {chip('all', active === '', () => pick('', false), 'Todos')}
      {segments.map((s) =>
        chip(
          s.id,
          s.mode === 'fuel' ? active === 'fuel' : active === s.id,
          () => pick(s.id, s.mode === 'fuel'),
          <>
            <SegmentIcon icon={s.icon} />
            {s.name}
          </>,
        ),
      )}
    </div>
  );
}
