import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Ban, Heart, Info, Plus, Scale, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Chip, EmptyState, IconButton, ListSkeleton, PriceTag, Segmented, SelectField, Stars, TextField, Toggle, cx } from '@/design-system';
import { useActions } from '@/features/forms/ActionsContext';
import { useSettings } from '@/app/SettingsContext';
import { useBrands, useCategories, useMapById, usePrices, useProducts, useReviews, useStores } from '@/hooks/useData';
import { productStats, type ProductStats } from '@/services/comparison';
import { rankProducts, brandRating, type Suggestion } from '@/services/recommendations';
import { DIMENSION_NAME, dimensionOf, formatUnitPrice, packageLabel } from '@/services/units';
import { relativeDays } from '@/utils/date';
import { money, parseDecimal } from '@/utils/format';
import { matches } from '@/utils/text';
import type { ID, PriceRecord, Product } from '@/types';

type Sort = 'recomendados' | 'menor' | 'maior' | 'recente';
const PERIODS = [
  { v: '0', l: 'Todo o período' },
  { v: '7', l: 'Últimos 7 dias' },
  { v: '30', l: 'Últimos 30 dias' },
  { v: '90', l: 'Últimos 3 meses' },
  { v: '365', l: 'Último ano' },
];

export default function ComparePage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const actions = useActions();
  const [params, setParams] = useSearchParams();
  const products = useProducts();
  const prices = usePrices();
  const reviews = useReviews();
  const brandsList = useBrands();
  const brands = useMapById(brandsList);
  const categories = useCategories();
  const stores = useStores();
  const storeMap = useMapById(stores);

  const query = params.get('q') ?? '';
  const [showFilters, setShowFilters] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [period, setPeriod] = useState('0');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('recomendados');

  const activeFilters = [categoryId, brandId, storeId, period !== '0', minPrice, maxPrice, promoOnly].filter(Boolean).length;

  const filteredPrices = useMemo(() => {
    if (!prices) return undefined;
    const since = Number(period) > 0 ? new Date(Date.now() - Number(period) * 86_400_000).toISOString() : '';
    return prices.filter((r) => (!storeId || r.storeId === storeId) && (!since || r.date >= since) && (!promoOnly || r.promo));
  }, [prices, storeId, period, promoOnly]);

  const rows = useMemo(() => {
    if (!products || !filteredPrices) return undefined;
    const byProduct = new Map<ID, PriceRecord[]>();
    for (const r of filteredPrices) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
    const min = parseDecimal(minPrice);
    const max = parseDecimal(maxPrice);
    const hasPriceFilter = storeId || period !== '0' || promoOnly || min > 0 || max > 0;
    return products
      .filter((p) => !p.archived)
      .filter((p) => !categoryId || p.categoryId === categoryId)
      .filter((p) => !brandId || p.brandId === brandId)
      .filter((p) => matches(`${p.name} ${brands.get(p.brandId ?? '')?.name ?? ''} ${p.subcategory ?? ''} ${p.barcode ?? ''}`, query))
      .map((p) => ({ product: p, stats: productStats(p, byProduct.get(p.id) ?? [], settings.staleDays), records: byProduct.get(p.id) ?? [] }))
      .filter((r) => !hasPriceFilter || r.stats)
      .filter((r) => {
        const ref = r.stats ? (r.stats.recentMin ?? r.stats.historicMin).packagePrice : NaN;
        return (!(min > 0) || ref >= min) && (!(max > 0) || ref <= max);
      });
  }, [products, filteredPrices, categoryId, brandId, storeId, period, promoOnly, minPrice, maxPrice, query, brands, settings.staleDays]);

  const suggestions = useMemo(() => {
    if (!rows || !reviews || !filteredPrices || !brandsList) return [];
    return rankProducts(
      rows.map((r) => r.product),
      { brands, reviews, prices: filteredPrices, staleDays: settings.staleDays },
    );
  }, [rows, reviews, filteredPrices, brands, brandsList, settings.staleDays]);
  const suggestionBy = useMemo(() => new Map(suggestions.map((s, i) => [s.product.id, { s, i }])), [suggestions]);

  const sorted = useMemo(() => {
    if (!rows) return undefined;
    const ref = (s: ProductStats | null) => (s ? (s.recentMin ?? s.historicMin).unitPrice : NaN);
    const copy = [...rows];
    if (sort === 'recomendados') copy.sort((a, b) => (suggestionBy.get(a.product.id)?.i ?? 0) - (suggestionBy.get(b.product.id)?.i ?? 0));
    if (sort === 'menor') copy.sort((a, b) => (ref(a.stats) || Infinity) - (ref(b.stats) || Infinity));
    if (sort === 'maior') copy.sort((a, b) => (ref(b.stats) || -Infinity) - (ref(a.stats) || -Infinity));
    if (sort === 'recente') copy.sort((a, b) => (b.stats?.lastUpdate ?? '').localeCompare(a.stats?.lastUpdate ?? ''));
    return copy;
  }, [rows, sort, suggestionBy]);

  const dims = new Set((rows ?? []).map((r) => dimensionOf(r.product.unit)));
  const matchingBrands = useMemo(
    () => (query.trim() && brandsList && products && reviews ? brandsList.filter((b) => matches(b.name, query)).slice(0, 6).map((b) => ({ b, ...brandRating(b.id, products, reviews) })) : []),
    [query, brandsList, products, reviews],
  );
  const topSuggestions = query.trim() ? suggestions.filter((s) => (s.rating != null || s.bestUnitPrice != null) && !s.avoid).slice(0, 3) : [];

  const loading = !sorted;

  return (
    <div>
      <PageHeader title="Comparar" subtitle="Preços, unidades e avaliações dos produtos que você acompanha." />
      <Segmented
        label="O que comparar"
        value="mercado"
        onChange={(v) => v === 'combustivel' && navigate('/combustiveis')}
        options={[
          { value: 'mercado', label: 'Mercado' },
          { value: 'combustivel', label: 'Combustível' },
        ]}
        className="mb-4"
      />

      <div className="sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pt-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              aria-label="Buscar produto"
              placeholder="Buscar produto, marca ou código"
              value={query}
              onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
              className="h-12 w-full rounded-md border border-line bg-surface pl-10 pr-10 text-[15px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            {query && (
              <IconButton label="Limpar busca" className="absolute right-0.5 top-0.5" onClick={() => setParams({}, { replace: true })}>
                <X className="h-4 w-4" />
              </IconButton>
            )}
          </div>
          <Button
            variant="secondary"
            className="relative h-12 w-12 px-0"
            aria-label="Filtros"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {activeFilters > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1 text-[11px] font-bold text-navy">{activeFilters}</span>
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-none" role="radiogroup" aria-label="Ordenar">
          {(
            [
              ['recomendados', 'Recomendados'],
              ['menor', 'Menor preço'],
              ['maior', 'Maior preço'],
              ['recente', 'Mais recentes'],
            ] as [Sort, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              role="radio"
              aria-checked={sort === v}
              onClick={() => setSort(v)}
              className={cx(
                'h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                sort === v ? 'border-transparent bg-primary text-on-primary' : 'border-line text-muted hover:text-ink',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 grid animate-fade-in grid-cols-2 gap-3 rounded-lg bg-surface p-4 shadow-card">
          <SelectField label="Categoria" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Marca" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">Todas</option>
            {brandsList?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <SelectField label="Mercado" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Todos</option>
            {stores?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
          <SelectField label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </SelectField>
          <TextField label="Preço mínimo" prefix="R$" inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <TextField label="Preço máximo" prefix="R$" inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <Toggle className="col-span-2" label="Só promoções" checked={promoOnly} onChange={setPromoOnly} />
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2 justify-self-start"
              onClick={() => {
                setCategoryId('');
                setBrandId('');
                setStoreId('');
                setPeriod('0');
                setMinPrice('');
                setMaxPrice('');
                setPromoOnly(false);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : !products!.length ? (
        <EmptyState
          icon={<Scale className="h-6 w-6" />}
          title="Nada para comparar ainda"
          action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => actions.openProduct()}>Cadastrar produto</Button>}
        >
          Cadastre produtos e registre preços em mais de um mercado para ver quem cobra menos.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {topSuggestions.length > 0 && <SuggestionBlock items={topSuggestions} query={query} storeName={(id) => storeMap.get(id)?.name} />}

          {matchingBrands.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Marcas</h2>
              <div className="flex flex-wrap gap-2">
                {matchingBrands.map(({ b, avg, count }) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBrandId(b.id);
                      setShowFilters(true);
                    }}
                    className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-3 pr-3 text-sm font-semibold hover:bg-sunken"
                  >
                    {b.name}
                    {avg != null ? <Stars value={avg} size={11} /> : <span className="text-xs font-normal text-muted">sem nota</span>}
                    {count > 0 && <span className="text-xs font-normal text-muted">({count})</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dims.size > 1 && (
            <p className="flex items-start gap-2 rounded-lg bg-warn/[.08] p-3 text-xs text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              Os resultados misturam {[...dims].map((d) => DIMENSION_NAME[d]).join(', ')}. O preço por unidade só é comparável entre produtos medidos do mesmo jeito.
            </p>
          )}

          <section aria-label="Resultados">
            <p className="mb-2 text-sm text-muted" aria-live="polite">
              {sorted!.length === 1 ? '1 produto' : `${sorted!.length} produtos`}
            </p>
            {sorted!.length ? (
              <ul className="flex flex-col gap-2">
                {sorted!.map(({ product, stats }) => (
                  <ResultRow
                    key={product.id}
                    product={product}
                    stats={stats}
                    brand={product.brandId ? brands.get(product.brandId)?.name : undefined}
                    suggestion={suggestionBy.get(product.id)?.s}
                    storeName={(id) => storeMap.get(id)?.name ?? 'mercado'}
                    staleDays={settings.staleDays}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="Nenhum produto encontrado"
                action={
                  query ? (
                    <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => actions.openProduct({ initialName: query })}>
                      Cadastrar “{query}”
                    </Button>
                  ) : undefined
                }
              >
                Tente outro termo ou ajuste os filtros.
              </EmptyState>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function SuggestionBlock({ items, query, storeName }: { items: Suggestion[]; query: string; storeName: (id: ID) => string | undefined }) {
  return (
    <section aria-labelledby="sugestoes" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="sugestoes" className="flex items-center gap-2 text-base font-bold">
        <Sparkles className="h-4 w-4 text-lime-ink" aria-hidden />
        Melhores escolhas para “{query.trim()}”
      </h2>
      <p className="mt-0.5 text-xs text-muted">Combina suas avaliações, o preço por unidade e o histórico. Só usa o que você registrou.</p>
      <ol className="mt-3 flex flex-col gap-3">
        {items.map((s, i) => (
          <li key={s.product.id} className="flex gap-3">
            <span className="price mt-0.5 w-5 text-lg font-bold text-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <Link to={`/produtos/${s.product.id}`} className="font-semibold hover:underline">
                {s.product.name}
                {s.brand ? <span className="font-normal text-muted"> · {s.brand.name}</span> : null}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {s.rating != null && (
                  <span className="inline-flex items-center gap-1">
                    <Stars value={s.rating} size={11} />
                    <span className="font-semibold">{s.rating.toFixed(1).replace('.', ',')}</span>
                  </span>
                )}
                {s.bestUnitPrice != null && (
                  <span className="price font-semibold">
                    {formatUnitPrice(s.bestUnitPrice, s.product.unit)}
                    {s.bestStoreId ? <span className="font-sans font-normal text-muted"> em {storeName(s.bestStoreId)}</span> : null}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">{s.reasons.slice(0, 3).join(' · ')}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultRow({
  product,
  stats,
  brand,
  suggestion,
  storeName,
  staleDays,
}: {
  product: Product;
  stats: ProductStats | null;
  brand?: string;
  suggestion?: Suggestion;
  storeName: (id: ID) => string;
  staleDays: number;
}) {
  const ref = stats?.recentMin ?? stats?.historicMin;
  const isRecent = !!stats?.recentMin;
  return (
    <li>
      <Link to={`/produtos/${product.id}`} className="flex gap-3 rounded-lg bg-surface p-4 shadow-card transition-colors hover:bg-sunken">
        {product.image ? (
          <img src={product.image} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <span className="font-semibold leading-snug">{product.name}</span>
            {suggestion?.favorite && <Heart className="mt-1 h-3.5 w-3.5 shrink-0 fill-current text-danger" aria-label="Favorito" />}
            {suggestion?.avoid && <Ban className="mt-1 h-3.5 w-3.5 shrink-0 text-danger" aria-label="Não comprar novamente" />}
          </div>
          <div className="truncate text-xs text-muted">{[brand, packageLabel(product)].filter(Boolean).join(' · ')}</div>
          {suggestion?.rating != null && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Stars value={suggestion.rating} size={11} />
              {suggestion.ratingSource === 'brand' && <span className="text-muted">nota da marca</span>}
            </div>
          )}
          {ref ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>
                {isRecent ? 'Menor recente' : 'Menor histórico'} em <span className="font-semibold text-ink">{storeName(ref.storeId)}</span>
              </span>
              <span>· {relativeDays(ref.record.date)}</span>
              {ref.confirmed && <Chip tone="info">confirmado em compra</Chip>}
              {ref.record.promo && <Chip tone="lime">promoção</Chip>}
              {stats!.allStale && (
                <Chip tone="warn" icon={<Info className="h-3 w-3" aria-hidden />}>
                  desatualizado (+{staleDays} dias)
                </Chip>
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted">Sem preço registrado</div>
          )}
        </div>
        {ref && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <PriceTag value={money(ref.packagePrice)} tone={isRecent ? 'best' : 'plain'} size="sm" />
            <span className="price text-[11px] text-muted">{formatUnitPrice(ref.unitPrice, product.unit)}</span>
            {stats!.byStore.length > 1 && <span className="text-[11px] text-muted">{stats!.byStore.length} mercados</span>}
          </div>
        )}
      </Link>
    </li>
  );
}
