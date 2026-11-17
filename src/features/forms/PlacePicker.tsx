import { useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { db } from '@/db/database';
import type { ID, Place, SegmentMode } from '@/types';
import { Button, PlaceMark, Sheet, cx } from '@/design-system';
import { useSegments, useStores } from '@/hooks/useData';
import { matches } from '@/utils/text';

const MAX_SHOWN = 60;

export const placeSubtitle = (p: Place) => [p.flag, p.neighborhood, p.city].filter(Boolean).join(' · ');

/** Lugares com registros mais recentes primeiro (preços, combustível e compras). */
function useRecentPlaceIds(mode: SegmentMode): ID[] {
  return (
    useLiveQuery(async () => {
      const rows =
        mode === 'fuel'
          ? (await db.fuelPrices.orderBy('date').reverse().limit(200).toArray()).map((f) => f.stationId)
          : [...(await db.purchases.orderBy('date').reverse().limit(100).toArray()).map((p) => p.storeId), ...(await db.prices.orderBy('date').reverse().limit(200).toArray()).map((p) => p.storeId)];
      return [...new Set(rows)];
    }, [mode]) ?? []
  );
}

interface Props {
  value: ID | '';
  onChange: (id: ID) => void;
  mode: SegmentMode;
  label?: string;
  error?: string;
  /** Mostra este lugar mesmo inativo. */
  keepId?: ID;
  onCreate?: () => void;
  autoFocus?: boolean;
}

/** Campo de lugar com busca por nome, bairro, cidade ou endereço; os usados por último aparecem primeiro. */
export function PlacePicker({ value, onChange, mode, label = 'Lugar', error, keepId, onCreate, autoFocus }: Props) {
  const segments = useSegments() ?? [];
  const segIds = useMemo(() => new Set(segments.filter((s) => s.mode === mode).map((s) => s.id)), [segments, mode]);
  const segName = useMemo(() => new Map(segments.map((s) => [s.id, s.name])), [segments]);
  const all = useStores() ?? [];
  const places = all.filter((p) => segIds.has(p.segmentId) && (p.active || p.id === keepId || p.id === value));
  const recent = useRecentPlaceIds(mode);
  const selected = all.find((p) => p.id === value);
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { recentList, rest, total } = useMemo(() => {
    const q = query.trim();
    const found = q ? places.filter((p) => matches(`${p.name} ${p.flag ?? ''} ${p.neighborhood ?? ''} ${p.city ?? ''} ${p.address ?? ''}`, q)) : places;
    const rank = new Map(recent.map((id, i) => [id, i]));
    const recentList = q
      ? []
      : found
          .filter((p) => rank.has(p.id))
          .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
          .slice(0, 8);
    const shownRecent = new Set(recentList.map((p) => p.id));
    const rest = found.filter((p) => !shownRecent.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return { recentList, rest, total: found.length };
  }, [places, recent, query]);

  const choose = (id: ID) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const row = (p: Place) => (
    <li key={p.id}>
      <button
        type="button"
        onClick={() => choose(p.id)}
        className={cx('flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-sunken', p.id === value && 'bg-sunken')}
        aria-current={p.id === value || undefined}
      >
        <PlaceMark name={p.name} color={p.color} logo={p.logo} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{p.name}</span>
          <span className="block truncate text-xs text-muted">{[segIds.size > 1 ? segName.get(p.segmentId) : undefined, placeSubtitle(p)].filter(Boolean).join(' · ') || p.address}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div className="flex items-end gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
          {label}
        </label>
        <button
          id={fieldId}
          type="button"
          onClick={() => setOpen(true)}
          data-autofocus={autoFocus || undefined}
          aria-invalid={!!error || undefined}
          className={cx(
            'flex h-12 w-full items-center gap-2.5 rounded-md border bg-surface px-3 text-left',
            error ? 'border-danger' : 'border-line',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {selected ? (
            <>
              <PlaceMark name={selected.name} color={selected.color} logo={selected.logo} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-tight">{selected.name}</span>
                {placeSubtitle(selected) && <span className="block truncate text-xs leading-tight text-muted">{placeSubtitle(selected)}</span>}
              </span>
            </>
          ) : (
            <span className="flex-1 truncate text-muted">{places.length ? (mode === 'fuel' ? 'Escolha o posto' : 'Escolha o lugar') : 'Cadastre um lugar'}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        </button>
        {error && (
          <p className="text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
      {onCreate && (
        <Button variant="secondary" className={cx('h-12 w-12 px-0', error && 'mb-[22px]')} aria-label="Cadastrar lugar" title="Cadastrar lugar" onClick={onCreate}>
          <Plus className="h-5 w-5" />
        </Button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={mode === 'fuel' ? 'Escolher posto' : 'Escolher lugar'} size="lg">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, bairro ou cidade"
              aria-label="Buscar lugar"
              autoComplete="off"
              data-autofocus
              className="h-12 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          {recentList.length > 0 && (
            <section>
              <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Usados por último</h3>
              <ul>{recentList.map(row)}</ul>
            </section>
          )}
          {rest.length > 0 && (
            <section>
              {recentList.length > 0 && <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Todos</h3>}
              <ul>{rest.slice(0, MAX_SHOWN).map(row)}</ul>
              {rest.length > MAX_SHOWN && (
                <p className="px-2 py-2 text-xs text-muted">
                  Mostrando {MAX_SHOWN} de {rest.length}. Digite parte do nome ou o bairro para achar os outros.
                </p>
              )}
            </section>
          )}
          {total === 0 && <p className="px-2 py-4 text-sm text-muted">{query ? 'Nenhum lugar com esse nome, bairro ou cidade.' : 'Nenhum lugar cadastrado ainda.'}</p>}
          {onCreate && (
            <Button
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
            >
              Cadastrar outro lugar
            </Button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
