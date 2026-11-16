import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Plus, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, EmptyState, ListSkeleton, PlaceMark, SegmentIcon, cx } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useFuelPrices, useMapById, usePlaces, usePrices, useSegments } from '@/hooks/useData';
import { relativeDays } from '@/utils/date';

export default function PlacesPage() {
  const actions = useActions();
  const [params, setParams] = useSearchParams();
  const places = usePlaces();
  const segmentsList = useSegments();
  const segments = useMapById(segmentsList);
  const prices = usePrices();
  const fuelPrices = useFuelPrices();
  const filter = params.get('tipo') ?? '';

  const info = useMemo(() => {
    const m = new Map<string, { count: number; last?: string }>();
    const src = [...(prices ?? []).map((p) => ({ id: p.storeId, date: p.date })), ...(fuelPrices ?? []).map((p) => ({ id: p.stationId, date: p.date }))];
    for (const r of src) {
      const cur = m.get(r.id) ?? { count: 0 };
      cur.count++;
      if (!cur.last || r.date > cur.last) cur.last = r.date;
      m.set(r.id, cur);
    }
    return m;
  }, [prices, fuelPrices]);

  const visible = (places ?? [])
    .filter((p) => !filter || p.segmentId === filter)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const current = filter ? segments.get(filter) : undefined;

  return (
    <div>
      <PageHeader
        back="/mais"
        title="Lugares"
        subtitle="Onde você compra ou abastece: mercados, farmácias, postos e o que mais quiser."
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => actions.openPlace({ segmentId: filter || undefined })}>
            Novo
          </Button>
        }
      />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="Tipo de lugar">
        <FilterChip active={!filter} onClick={() => setParams({}, { replace: true })}>
          Todos
        </FilterChip>
        {segmentsList?.map((s) => (
          <FilterChip key={s.id} active={filter === s.id} onClick={() => setParams({ tipo: s.id }, { replace: true })}>
            <SegmentIcon icon={s.icon} />
            {s.name}
          </FilterChip>
        ))}
        <Link to="/tipos" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent hover:bg-sunken">
          <Settings2 className="h-4 w-4" aria-hidden />
          Tipos
        </Link>
      </div>

      {!places || !segmentsList ? (
        <ListSkeleton />
      ) : !visible.length ? (
        <EmptyState
          icon={current ? <SegmentIcon icon={current.icon} className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
          title={current ? `Nenhum lugar do tipo ${current.name}` : 'Nenhum lugar cadastrado'}
          action={<Button onClick={() => actions.openPlace({ segmentId: filter || undefined })}>Cadastrar lugar</Button>}
        >
          Cadastre quantos quiser. Só o nome é obrigatório.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
          {visible.map((p) => {
            const i = info.get(p.id);
            const seg = segments.get(p.segmentId);
            return (
              <li key={p.id}>
                <Link to={`/lugares/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken">
                  <PlaceMark name={p.name} color={p.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {!p.active && <Chip>inativo</Chip>}
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                      {seg && <SegmentIcon icon={seg.icon} className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{[seg?.name, p.flag, p.neighborhood, p.city].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <div className="font-semibold text-ink">
                      {i?.count ?? 0} preço{i?.count === 1 ? '' : 's'}
                    </div>
                    {i?.last && <div>{relativeDays(i.last)}</div>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
        active ? 'border-transparent bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
