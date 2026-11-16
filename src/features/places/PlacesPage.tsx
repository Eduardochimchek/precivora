import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Fuel, Plus, Store as StoreIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, EmptyState, ListSkeleton, PlaceMark } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useFuelPrices, usePrices, useStations, useStores } from '@/hooks/useData';
import { relativeDays } from '@/utils/date';

export default function PlacesPage({ kind }: { kind: 'store' | 'station' }) {
  const actions = useActions();
  const stores = useStores();
  const stations = useStations();
  const prices = usePrices();
  const fuelPrices = useFuelPrices();
  const isStore = kind === 'store';
  const places = isStore ? stores : stations;

  const info = useMemo(() => {
    const m = new Map<string, { count: number; last?: string }>();
    const src = isStore ? (prices ?? []).map((p) => ({ id: p.storeId, date: p.date })) : (fuelPrices ?? []).map((p) => ({ id: p.stationId, date: p.date }));
    for (const r of src) {
      const cur = m.get(r.id) ?? { count: 0 };
      cur.count++;
      if (!cur.last || r.date > cur.last) cur.last = r.date;
      m.set(r.id, cur);
    }
    return m;
  }, [isStore, prices, fuelPrices]);

  const sorted = [...(places ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader
        back={isStore ? '/mais' : '/combustiveis'}
        title={isStore ? 'Mercados' : 'Postos'}
        subtitle={isStore ? 'Supermercados, atacarejos, feiras e onde mais você compra.' : 'Postos que você acompanha.'}
        actions={
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => actions.openPlace({ kind })}>
            Novo
          </Button>
        }
      />
      {!places ? (
        <ListSkeleton />
      ) : !sorted.length ? (
        <EmptyState
          icon={isStore ? <StoreIcon className="h-6 w-6" /> : <Fuel className="h-6 w-6" />}
          title={isStore ? 'Nenhum mercado cadastrado' : 'Nenhum posto cadastrado'}
          action={<Button onClick={() => actions.openPlace({ kind })}>{isStore ? 'Cadastrar mercado' : 'Cadastrar posto'}</Button>}
        >
          Cadastre quantos quiser. Só o nome é obrigatório.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
          {sorted.map((p) => {
            const i = info.get(p.id);
            return (
              <li key={p.id}>
                <Link to={`/${isStore ? 'mercados' : 'postos'}/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-sunken">
                  <PlaceMark name={p.name} color={p.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {!p.active && <Chip>inativo</Chip>}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {['flag' in p ? p.flag : null, p.neighborhood, p.city].filter(Boolean).join(' · ') || 'Sem endereço'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted">
                    <div className="font-semibold text-ink">{i?.count ?? 0} preço{i?.count === 1 ? '' : 's'}</div>
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
