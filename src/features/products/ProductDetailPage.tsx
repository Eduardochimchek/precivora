import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, Ban, Heart, ListPlus, Pencil, ShoppingCart, Star, Tag, Trash2 } from 'lucide-react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, ChangeBadge, Chip, EmptyState, IconButton, ListSkeleton, PlaceMark, PriceTag, Section, Skeleton, Stars, useFeedback } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useSettings } from '@/app/SettingsContext';
import { useMapById, useStores } from '@/hooks/useData';
import { byRecent, productStats, type StoreQuote } from '@/services/comparison';
import { formatUnitPrice, packageLabel, packagePrice, recordUnitPrice } from '@/services/units';
import { reviewScore } from '@/services/recommendations';
import { deleteProduct, setProductArchived } from '@/repositories/catalog';
import { deletePrice } from '@/repositories/prices';
import { formatDate, relativeDays } from '@/utils/date';
import { money } from '@/utils/format';
import { AddToListSheet } from '@/features/lists/AddToListSheet';

const PriceHistoryChart = lazy(() => import('./PriceHistoryChart').then((m) => ({ default: m.PriceHistoryChart })));

export default function ProductDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useFeedback();
  const actions = useActions();
  const { settings } = useSettings();
  const product = useLiveQuery(() => db.products.get(id).then((p) => p ?? null), [id]);
  const brand = useLiveQuery(() => (product?.brandId ? db.brands.get(product.brandId) : undefined), [product?.brandId]);
  const category = useLiveQuery(() => (product?.categoryId ? db.categories.get(product.categoryId) : undefined), [product?.categoryId]);
  const records = useLiveQuery(() => db.prices.where('productId').equals(id).toArray(), [id]);
  const review = useLiveQuery(() => db.reviews.where('[targetType+targetId]').equals(['product', id]).first(), [id]);
  const brandReview = useLiveQuery(
    () => (product?.brandId ? db.reviews.where('[targetType+targetId]').equals(['brand', product.brandId]).first() : undefined),
    [product?.brandId],
  );
  const stores = useMapById(useStores());
  const [addOpen, setAddOpen] = useState(false);

  const stats = useMemo(() => (product && records ? productStats(product, records, settings.staleDays) : null), [product, records, settings.staleDays]);
  const sortedRecords = useMemo(() => (records ? [...records].sort(byRecent) : []), [records]);

  if (product === undefined || records === undefined)
    return (
      <div className="pt-9">
        <Skeleton className="mb-6 h-8 w-56" />
        <ListSkeleton />
      </div>
    );
  if (product === null)
    return (
      <div className="pt-9">
        <EmptyState icon={<Tag className="h-6 w-6" />} title="Produto não encontrado" action={<Button onClick={() => navigate('/comparar')}>Voltar ao comparador</Button>}>
          Ele pode ter sido excluído.
        </EmptyState>
      </div>
    );

  const storeName = (sid: string) => stores.get(sid)?.name ?? 'Mercado removido';

  async function remove() {
    const ok = await confirm({
      title: 'Excluir produto?',
      message: `"${product!.name}" e seus ${records!.length} preço(s), avaliação e itens de lista serão apagados. Se quiser só esconder, use Arquivar.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProduct(product!.id);
      toast('Produto excluído');
      navigate('/comparar', { replace: true });
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function toggleArchive() {
    await setProductArchived(product!.id, !product!.archived);
    toast(product!.archived ? 'Produto reativado' : 'Produto arquivado');
  }

  const best = stats?.recentMin;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back
        title={product.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {[brand?.name, packageLabel(product), category?.name, product.subcategory].filter(Boolean).join(' · ')}
            {product.archived && <Chip tone="warn">arquivado</Chip>}
          </span>
        }
        actions={
          <IconButton label="Editar produto" onClick={() => actions.openProduct({ productId: product.id })}>
            <Pencil className="h-5 w-5" />
          </IconButton>
        }
      />

      {product.image && <img src={product.image} alt={product.name} className="-mt-3 h-40 w-40 rounded-xl object-cover" />}

      <div className="flex gap-2">
        <Button icon={<Tag className="h-4 w-4" />} className="flex-1" onClick={() => actions.openPrice({ productId: product.id })}>
          Registrar preço
        </Button>
        <Button variant="secondary" icon={<ListPlus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
          Lista
        </Button>
      </div>

      {stats ? (
        <>
          <section aria-labelledby="melhor" className="rounded-xl bg-surface p-5 shadow-card">
            <h2 id="melhor" className="text-sm font-semibold text-muted">
              {best ? `Menor preço recente (até ${settings.staleDays} dias)` : 'Menor preço histórico'}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PriceTag value={money((best ?? stats.historicMin).packagePrice)} tone={best ? 'best' : 'plain'} size="lg" />
              <div className="text-sm">
                <div className="font-semibold">{storeName((best ?? stats.historicMin).storeId)}</div>
                <div className="text-muted">
                  {formatUnitPrice((best ?? stats.historicMin).unitPrice, product.unit)} · {relativeDays((best ?? stats.historicMin).record.date)}
                </div>
              </div>
            </div>
            {!best && (
              <p className="mt-3 text-xs text-warn">
                Todos os preços têm mais de {settings.staleDays} dias. Isso mostra onde já foi mais barato, não onde está mais barato hoje.
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
              <StatItem label="Menor histórico" q={stats.historicMin} unit={product.unit} storeName={storeName} />
              <StatItem label="Maior registrado" q={stats.historicMax} unit={product.unit} storeName={storeName} />
              <div>
                <dt className="text-xs font-semibold text-muted">Último preço</dt>
                <dd className="price mt-0.5 text-lg font-bold">{money(stats.last.packagePrice)}</dd>
                <dd className="mt-0.5">{stats.lastChange && <ChangeBadge change={stats.lastChange} />}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">Preço médio</dt>
                <dd className="price mt-0.5 text-lg font-bold">{money(stats.avgPackage)}</dd>
                <dd className="text-xs text-muted">{formatUnitPrice(stats.avgUnit, product.unit)}</dd>
              </div>
            </dl>
            {stats.lastConfirmed && (
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
                <ShoppingCart className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
                Última compra confirmada: <span className="price font-bold text-ink">{money(stats.lastConfirmed.packagePrice)}</span> em{' '}
                {storeName(stats.lastConfirmed.storeId)}, {formatDate(stats.lastConfirmed.record.date)}
              </p>
            )}
          </section>

          <Section title="Por mercado" id="por-mercado">
            <Card className="divide-y divide-line">
              {stats.byStore.map((q, i) => {
                const st = stores.get(q.storeId);
                const diff = q.packagePrice - stats.byStore[0].packagePrice;
                return (
                  <Link key={q.storeId} to={`/mercados/${q.storeId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                    <PlaceMark name={st?.name ?? '?'} color={st?.color ?? '#64748B'} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{storeName(q.storeId)}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {relativeDays(q.record.date)}
                        {q.stale && <Chip tone="warn">desatualizado</Chip>}
                        {q.record.promo && <Chip tone="lime">promoção</Chip>}
                        {q.confirmed && <Chip tone="info">compra</Chip>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="price font-bold">{money(q.packagePrice)}</div>
                      <div className="text-[11px] text-muted">{i === 0 ? 'mais barato' : `+${money(diff)}`}</div>
                    </div>
                  </Link>
                );
              })}
            </Card>
            <p className="text-xs text-muted">Último preço registrado em cada mercado.</p>
          </Section>

          {records.length > 1 && (
            <Section title="Histórico" id="historico-grafico">
              <Card className="p-4">
                <Suspense fallback={<Skeleton className="h-56 w-full" />}>
                  <PriceHistoryChart product={product} records={records} stores={stores} />
                </Suspense>
              </Card>
            </Section>
          )}
        </>
      ) : (
        <EmptyState icon={<Tag className="h-6 w-6" />} title="Sem preços ainda" action={<Button onClick={() => actions.openPrice({ productId: product.id })}>Registrar preço</Button>}>
          Registre o preço deste produto nos mercados que você visita para comparar.
        </EmptyState>
      )}

      <Section title="Sua avaliação" id="avaliacao">
        <Card className="p-4">
          {review ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Stars value={reviewScore(review)} size={18} />
                <span className="price text-lg font-bold">{reviewScore(review).toFixed(1).replace('.', ',')}</span>
                {review.favorite && <Chip tone="bad" icon={<Heart className="h-3 w-3 fill-current" aria-hidden />}>favorito</Chip>}
                {review.avoid && <Chip tone="bad" icon={<Ban className="h-3 w-3" aria-hidden />}>não comprar</Chip>}
              </div>
              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                <div>Geral: <span className="font-semibold text-ink">{review.overall}</span></div>
                {review.quality && <div>Qualidade: <span className="font-semibold text-ink">{review.quality}</span></div>}
                {review.value && <div>Custo-benefício: <span className="font-semibold text-ink">{review.value}</span></div>}
              </dl>
              {review.comment && <p className="text-[15px]">“{review.comment}”</p>}
              <p className="text-xs text-muted">Avaliado em {formatDate(review.date)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">Sem nota ainda. Suas avaliações entram nas sugestões do comparador.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Star className="h-4 w-4" />} onClick={() => actions.openReview({ targetType: 'product', targetId: product.id })}>
              {review ? 'Editar avaliação' : 'Avaliar produto'}
            </Button>
            {brand && (
              <Button size="sm" variant="ghost" onClick={() => actions.openReview({ targetType: 'brand', targetId: brand.id })}>
                {brandReview ? `Marca ${brand.name}: ${brandReview.overall}★` : `Avaliar a marca ${brand.name}`}
              </Button>
            )}
          </div>
        </Card>
      </Section>

      {records.length > 0 && (
        <Section title={`Registros (${records.length})`} id="registros">
          <Card className="divide-y divide-line">
            {sortedRecords.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{storeName(r.storeId)}</div>
                  <div className="text-xs text-muted">
                    {formatDate(r.date)}
                    {r.quantity > 1 ? ` · ${r.quantity} por ${money(r.price)}` : ''}
                    {r.promo ? ' · promoção' : ''}
                    {r.source === 'purchase' ? ' · compra' : ''}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="price font-bold">{money(packagePrice(r))}</div>
                  <div className="text-[11px] text-muted">{formatUnitPrice(recordUnitPrice(r, product), product.unit)}</div>
                </div>
                {r.source === 'purchase' ? (
                  <IconButton label="Abrir compra" onClick={() => navigate(`/compras/${r.purchaseId}`)}>
                    <ShoppingCart className="h-4 w-4" />
                  </IconButton>
                ) : (
                  <div className="flex">
                    <IconButton label="Editar registro" onClick={() => actions.openPrice({ priceId: r.id })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Excluir registro"
                      onClick={async () => {
                        if (await confirm({ title: 'Excluir este preço?', message: `${money(r.price)} em ${storeName(r.storeId)}, ${formatDate(r.date)}.`, confirmLabel: 'Excluir', danger: true })) {
                          await deletePrice(r.id);
                          toast('Preço excluído');
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            ))}
          </Card>
        </Section>
      )}

      {(product.description || product.notes || product.barcode) && (
        <Section title="Detalhes" id="detalhes">
          <Card className="flex flex-col gap-2 p-4 text-sm">
            {product.barcode && <div><span className="text-muted">Código de barras: </span><span className="tnum">{product.barcode}</span></div>}
            {product.description && <p>{product.description}</p>}
            {product.notes && <p className="text-muted">{product.notes}</p>}
          </Card>
        </Section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        <Button variant="secondary" size="sm" icon={product.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} onClick={toggleArchive}>
          {product.archived ? 'Reativar' : 'Arquivar'}
        </Button>
        <Button variant="ghost" size="sm" className="text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={remove}>
          Excluir produto
        </Button>
      </div>

      <AddToListSheet open={addOpen} onClose={() => setAddOpen(false)} productId={product.id} productName={product.name} />
    </div>
  );
}

function StatItem({ label, q, unit, storeName }: { label: string; q: StoreQuote; unit: Parameters<typeof formatUnitPrice>[1]; storeName: (id: string) => string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="price mt-0.5 text-lg font-bold">{money(q.packagePrice)}</dd>
      <dd className="truncate text-xs text-muted">
        {storeName(q.storeId)} · {formatDate(q.record.date)}
      </dd>
      <dd className="price text-[11px] text-muted">{formatUnitPrice(q.unitPrice, unit)}</dd>
    </div>
  );
}
