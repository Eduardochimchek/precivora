import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin, Pencil, ShoppingCart, Store as StoreIcon, Tag, Trash2 } from 'lucide-react';
import { db } from '@/db/database';
import { hasCoords } from '@/services/geo';
import { Map as MapIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, Chip, EmptyState, IconButton, ListSkeleton, PlaceMark, Section, Stat, useFeedback } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { FavoriteButton } from './FavoriteButton';
import { useSettings } from '@/app/SettingsContext';
import { usePrices, useProducts } from '@/hooks/useData';
import { productStats } from '@/services/comparison';
import { deletePlace } from '@/repositories/places';
import { formatUnitPrice, packageLabel } from '@/services/units';
import { relativeDays } from '@/utils/date';
import { money } from '@/utils/format';
import type { ID, PriceRecord } from '@/types';

export default function StoreDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const actions = useActions();
  const { toast, confirm } = useFeedback();
  const { settings } = useSettings();
  const store = useLiveQuery(() => db.stores.get(id).then((s) => s ?? null), [id]);
  const purchases = useLiveQuery(() => db.purchases.where('storeId').equals(id).toArray(), [id]);
  const segment = useLiveQuery(() => (store ? db.segments.get(store.segmentId) : undefined), [store?.segmentId]);
  const prices = usePrices();
  const products = useProducts();

  const rows = useMemo(() => {
    if (!prices || !products) return [];
    const byProduct = new Map<ID, PriceRecord[]>();
    for (const r of prices) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
    return products
      .map((p) => {
        const s = productStats(p, byProduct.get(p.id) ?? [], settings.staleDays);
        const here = s?.byStore.find((q) => q.storeId === id);
        return s && here ? { p, s, here, cheapest: s.byStore[0].storeId === id, others: s.byStore.length - 1 } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Number(b.cheapest) - Number(a.cheapest) || a.p.name.localeCompare(b.p.name));
  }, [prices, products, id, settings.staleDays]);

  if (store === undefined) return <div className="pt-9"><ListSkeleton /></div>;
  if (store === null)
    return (
      <div className="pt-9">
        <EmptyState icon={<StoreIcon className="h-6 w-6" />} title="Lugar não encontrado" action={<Button onClick={() => navigate('/lugares')}>Ver lugares</Button>} />
      </div>
    );

  const compared = rows.filter((r) => r.others > 0);
  const wins = compared.filter((r) => r.cheapest).length;

  async function remove() {
    const ok = await confirm({
      title: `Excluir ${store!.name}?`,
      message: `Os ${rows.length ? 'preços registrados neste lugar também serão apagados' : 'dados deste lugar serão apagados'}. Se ele só fechou ou você parou de ir, marque como inativo.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePlace(store!.id);
      toast('Lugar excluído');
      navigate('/lugares', { replace: true });
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back
        title={store.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {!store.active && <Chip>inativo</Chip>}
            {[segment?.name, [store.address, store.neighborhood, store.city].filter(Boolean).join(', ') || 'Sem endereço'].filter(Boolean).join(' · ')}
          </span>
        }
        actions={
          <>
            <FavoriteButton place={store} />
            <IconButton label="Editar lugar" onClick={() => actions.openPlace({ placeId: store.id })}>
              <Pencil className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      <div className="flex items-center gap-4">
        <PlaceMark name={store.name} color={store.color} logo={store.logo} size={56} />
        <div className="grid flex-1 grid-cols-3 gap-3">
          <Stat label="Produtos" value={rows.length} />
          <Stat label="Mais barato em" value={compared.length ? `${wins}/${compared.length}` : '—'} sub={compared.length ? 'dos comparáveis' : undefined} />
          <Stat label="Compras" value={purchases?.length ?? 0} sub={purchases?.length ? money(purchases.reduce((s, p) => s + p.total, 0)) : undefined} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" icon={<Tag className="h-4 w-4" />} onClick={() => actions.openPrice({ storeId: store.id })}>
          Registrar preço aqui
        </Button>
        <Button variant="secondary" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => navigate(`/compras/nova?lugar=${store.id}`)}>
          Compra
        </Button>
      </div>
      {store.notes && <p className="rounded-lg bg-surface p-4 text-sm text-muted shadow-card">{store.notes}</p>}

      <Section title="Preços neste lugar" id="precos-mercado">
        {rows.length ? (
          <Card className="divide-y divide-line">
            {rows.map(({ p, here, cheapest, others, s }) => (
              <Link key={p.id} to={`/produtos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {packageLabel(p)} · {relativeDays(here.record.date)}
                    {here.stale && <Chip tone="warn">desatualizado</Chip>}
                    {others > 0 && (cheapest ? <Chip tone="good">mais barato</Chip> : <span>· mais barato: {money(s.byStore[0].packagePrice)}</span>)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="price font-bold">{money(here.packagePrice)}</div>
                  <div className="text-[11px] text-muted">{formatUnitPrice(here.unitPrice, p.unit)}</div>
                </div>
              </Link>
            ))}
          </Card>
        ) : (
          <p className="text-sm text-muted">Nenhum preço registrado aqui ainda.</p>
        )}
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        {store.address && (
          <a
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold hover:bg-sunken"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([store.name, store.address, store.city].filter(Boolean).join(', '))}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Abrir no mapa
          </a>
        )}
        {hasCoords(store) && (
          <Link
            to={`/mapa?lugar=${store.id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold hover:bg-sunken"
          >
            <MapIcon className="h-4 w-4" aria-hidden />
            Ver no mapa
          </Link>
        )}
        <Button variant="ghost" size="sm" className="text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
          Excluir lugar
        </Button>
      </div>
    </div>
  );
}
