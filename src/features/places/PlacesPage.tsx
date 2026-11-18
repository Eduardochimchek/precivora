import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Plus, Search, Settings2, Star } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, EmptyState, ListSkeleton, PlaceMark, SegmentIcon, cx } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useFuelPrices, useMapById, usePlaces, usePrices, useSegments } from '@/hooks/useData';
import { relativeDays } from '@/utils/date';
import { matches } from '@/utils/text';

const PAGE = 80;

export default function PlacesPage() {
  const actions = useActions();
  const [params, setParams] = useSearchParams();
  const places = usePlaces();
  const segmentsList = useSegments();
  const segments = useMapById(segmentsList);
  const prices = usePrices();
  const fuelPrices = useFuelPrices();
  const filter = params.get('tipo') ?? '';
  const onlyFav = params.get('fav') === '1';
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

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
    .filter((p) => !onlyFav || p.favorite)
    .filter((p) => !query.trim() || matches(`${p.name} ${p.flag ?? ''} ${p.neighborhood ?? ''} ${p.city ?? ''} ${p.address ?? ''}`, query))
    .sort((a, b) => Number(b.active) - Number(a.active) || Number(!!b.favorite) - Number(!!a.favorite) || (info.get(b.id)?.count ?? 0) - (info.get(a.id)?.count ?? 0) || a.name.localeCompare(b.name, 'pt-BR'));
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
        <FilterChip active={!filter && !onlyFav} onClick={() => setParams({}, { replace: true })}>
          Todos
        </FilterChip>
        <FilterChip active={onlyFav} onClick={() => setParams(onlyFav ? {} : { fav: '1' }, { replace: true })}>
          <Star className={cx('h-4 w-4', onlyFav ? 'fill-current' : 'fill-[#F5B301] text-[#F5B301]')} />
          Favoritos
        </FilterChip>
        {segmentsList?.map((s) => (
          <FilterChip key={s.id} active={filter === s.id} onClick={() => setParams({ tipo: s.id, ...(onlyFav ? { fav: '1' } : {}) }, { replace: true })}>
            <SegmentIcon icon={s.icon} />
            {s.name}
          </FilterChip>
        ))}
        <Link to="/tipos" className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent hover:bg-sunken">
          <Settings2 className="h-4 w-4" aria-hidden />
          Tipos
        </Link>
      </div>

      {(places?.length ?? 0) > 8 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Buscar por nome, bairro ou cidade"
            aria-label="Buscar lugar"
            className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      )}

      {!places || !segmentsList ? (
        <ListSkeleton />
      ) : !visible.length ? (
        <EmptyState
          icon={current ? <SegmentIcon icon={current.icon} className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
          title={onlyFav && !query.trim() ? 'Nenhum favorito ainda' : query.trim() ? 'Nenhum lugar encontrado' : current ? `Nenhum lugar do tipo ${current.name}` : 'Nenhum lugar cadastrado'}
          action={<Button onClick={() => actions.openPlace({ segmentId: filter || undefined })}>Cadastrar lugar</Button>}
        >
          {onlyFav ? 'Abra um lugar e toque na estrela para ele aparecer aqui e no topo das listas.' : 'Cadastre quantos quiser. Só o nome é obrigatório.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            {visible.length} lugar{visible.length === 1 ? '' : 'es'}
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
          {visible.slice(0, limit).map((p) => {
            const i = info.get(p.id);
            const seg = segments.get(p.segmentId);
            return (
              <li key={p.id}>
                <Link to={`/lugares/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken">
                  <PlaceMark name={p.name} color={p.color} logo={p.logo} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {p.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-[#F5B301] text-[#F5B301]" aria-label="Favorito" />}
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
          {visible.length > limit && (
            <Button variant="secondary" block className="mt-3" onClick={() => setLimit((l) => l + PAGE)}>
              Mostrar mais ({visible.length - limit} restantes)
            </Button>
          )}
        </>
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
