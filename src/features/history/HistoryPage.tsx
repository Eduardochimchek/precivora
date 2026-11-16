import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Download, History, Plus, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Card, EmptyState, ListSkeleton, PlaceMark, Section, Segmented, Sheet, Skeleton, Stat, useFeedback } from '@/design-system';
import { useCategories, useFuelPrices, useMapById, usePrices, useProducts, usePurchaseItems, usePurchases, useStations, useStores } from '@/hooks/useData';
import { categorySpending, estimatedSavings, monthlySpending, priceMovers } from '@/services/analytics';
import { toCsv } from '@/services/csv';
import { FUEL_LABEL } from '@/services/fuel';
import { UNIT_INFO, packageLabel, packagePrice } from '@/services/units';
import { formatDate, formatDateTime, formatMonthLong, monthKey } from '@/utils/date';
import { money, percent } from '@/utils/format';
import { downloadText } from '@/utils/download';
import { capitalizeFirst } from '@/utils/text';

const MonthlyChart = lazy(() => import('./MonthlyChart').then((m) => ({ default: m.MonthlyChart })));

export default function HistoryPage() {
  const { toast } = useFeedback();
  const purchases = usePurchases();
  const items = usePurchaseItems();
  const prices = usePrices();
  const products = useProducts();
  const productMap = useMapById(products);
  const categories = useMapById(useCategories());
  const stores = useStores();
  const storeMap = useMapById(stores);
  const fuel = useFuelPrices();
  const stationMap = useMapById(useStations());
  const [months, setMonths] = useState<'3' | '6' | '12'>('6');
  const [exportOpen, setExportOpen] = useState(false);

  const since = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - Number(months) + 1, 1).toISOString();
  }, [months]);

  const data = useMemo(() => {
    if (!purchases || !items || !prices || !products) return null;
    const inPeriod = (p: { date: string }) => p.date >= since;
    const periodPurchases = purchases.filter(inPeriod);
    const spent = periodPurchases.reduce((s, p) => s + p.total, 0);
    return {
      spent,
      count: periodPurchases.length,
      avg: periodPurchases.length ? spent / periodPurchases.length : 0,
      savings: estimatedSavings(items, purchases, prices, inPeriod),
      monthly: monthlySpending(purchases, Number(months)),
      cats: categorySpending(items, purchases, productMap, categories, inPeriod).slice(0, 6),
      movers: priceMovers(products, prices, since),
    };
  }, [purchases, items, prices, products, productMap, categories, since, months]);

  const grouped = useMemo(() => {
    const g = new Map<string, NonNullable<typeof purchases>>();
    for (const p of purchases ?? []) {
      const k = monthKey(p.date);
      g.set(k, [...(g.get(k) ?? []), p]);
    }
    return [...g.entries()];
  }, [purchases]);

  function exportCsv(kind: 'compras' | 'precos' | 'combustiveis' | 'produtos') {
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'compras') {
      const byId = new Map((purchases ?? []).map((p) => [p.id, p]));
      downloadText(
        toCsv(items ?? [], [
          { header: 'Data', value: (i) => formatDate(byId.get(i.purchaseId)?.date ?? '') },
          { header: 'Mercado', value: (i) => storeMap.get(byId.get(i.purchaseId)?.storeId ?? '')?.name },
          { header: 'Produto', value: (i) => productMap.get(i.productId)?.name },
          { header: 'Quantidade', value: (i) => i.quantity },
          { header: 'Preço unitário', value: (i) => i.unitPrice },
          { header: 'Subtotal', value: (i) => Math.round(i.quantity * i.unitPrice * 100) / 100 },
        ]),
        `precivora-compras-${stamp}.csv`,
        'text/csv',
      );
    } else if (kind === 'precos') {
      downloadText(
        toCsv(prices ?? [], [
          { header: 'Data', value: (r) => formatDate(r.date) },
          { header: 'Produto', value: (r) => productMap.get(r.productId)?.name },
          { header: 'Embalagem', value: (r) => { const p = productMap.get(r.productId); return p ? `${p.packageSize} ${UNIT_INFO[p.unit].label}` : ''; } },
          { header: 'Mercado', value: (r) => storeMap.get(r.storeId)?.name },
          { header: 'Preço', value: (r) => r.price },
          { header: 'Embalagens', value: (r) => r.quantity },
          { header: 'Preço por embalagem', value: (r) => Math.round(packagePrice(r) * 100) / 100 },
          { header: 'Promoção', value: (r) => (r.promo ? 'sim' : 'não') },
          { header: 'Origem', value: (r) => (r.source === 'purchase' ? 'compra' : 'anotado') },
          { header: 'Observações', value: (r) => r.notes },
        ]),
        `precivora-precos-${stamp}.csv`,
        'text/csv',
      );
    } else if (kind === 'combustiveis') {
      downloadText(
        toCsv(fuel ?? [], [
          { header: 'Data e hora', value: (r) => formatDateTime(r.date) },
          { header: 'Posto', value: (r) => stationMap.get(r.stationId)?.name },
          { header: 'Combustível', value: (r) => FUEL_LABEL[r.fuel] },
          { header: 'Preço', value: (r) => r.price },
          { header: 'Promoção', value: (r) => (r.promo ? 'sim' : 'não') },
          { header: 'Observações', value: (r) => r.notes },
        ]),
        `precivora-combustiveis-${stamp}.csv`,
        'text/csv',
      );
    } else {
      downloadText(
        toCsv(products ?? [], [
          { header: 'Produto', value: (p) => p.name },
          { header: 'Categoria', value: (p) => categories.get(p.categoryId ?? '')?.name },
          { header: 'Subcategoria', value: (p) => p.subcategory },
          { header: 'Conteúdo', value: (p) => p.packageSize },
          { header: 'Unidade', value: (p) => UNIT_INFO[p.unit].label },
          { header: 'Código de barras', value: (p) => p.barcode },
          { header: 'Arquivado', value: (p) => (p.archived ? 'sim' : 'não') },
        ]),
        `precivora-produtos-${stamp}.csv`,
        'text/csv',
      );
    }
    setExportOpen(false);
    toast('Arquivo CSV gerado');
  }

  const maxCat = Math.max(1, ...(data?.cats.map((c) => c.total) ?? [1]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Histórico"
        subtitle="Suas compras e como os preços mudaram."
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => setExportOpen(true)} aria-label="Exportar CSV">
              CSV
            </Button>
            <Link to="/compras/nova" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-on-primary hover:opacity-90">
              <Plus className="h-4 w-4" aria-hidden />
              Compra
            </Link>
          </>
        }
      />

      {!data || !purchases ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <ListSkeleton rows={3} />
        </div>
      ) : (
        <>
          <Segmented
            label="Período"
            value={months}
            onChange={setMonths}
            options={[
              { value: '3', label: '3 meses' },
              { value: '6', label: '6 meses' },
              { value: '12', label: '12 meses' },
            ]}
          />
          <Card className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
            <Stat label="Total gasto" value={money(data.spent)} />
            <Stat label="Compras" value={data.count} />
            <Stat label="Média por compra" value={money(data.avg)} />
            <Stat label="Economia estimada" value={<span className="text-lime-ink">{money(data.savings)}</span>} sub="vs. sua média de preços" />
          </Card>

          {purchases.length > 0 && (
            <Section title="Gasto por mês" id="gasto-mes">
              <Card className="p-4">
                <Suspense fallback={<Skeleton className="h-52 w-full" />}>
                  <MonthlyChart data={data.monthly} />
                </Suspense>
              </Card>
            </Section>
          )}

          {data.cats.length > 0 && (
            <Section title="Categorias com mais gastos" id="categorias">
              <Card className="flex flex-col gap-3 p-4">
                {data.cats.map((c) => (
                  <div key={c.categoryId} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
                      <span className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                    </span>
                    <span className="price w-24 text-right font-bold">{money(c.total)}</span>
                  </div>
                ))}
              </Card>
            </Section>
          )}

          {(data.movers.up.length > 0 || data.movers.down.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <MoverList title="Mais subiram" items={data.movers.up.slice(0, 5)} up />
              <MoverList title="Mais caíram" items={data.movers.down.slice(0, 5)} />
            </div>
          )}

          <Section title="Compras" id="compras">
            {!purchases.length ? (
              <EmptyState
                icon={<History className="h-6 w-6" />}
                title="Nenhuma compra registrada"
                action={
                  <Link to="/compras/nova" className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-semibold text-on-primary">
                    Registrar compra
                  </Link>
                }
              >
                Registrar o que você pagou mostra seus gastos, a economia e confirma os preços.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-5">
                {grouped.map(([k, ps]) => (
                  <div key={k}>
                    <h3 className="mb-2 flex justify-between text-sm font-semibold text-muted">
                      <span>{capitalizeFirst(formatMonthLong(new Date(ps[0].date)))}</span>
                      <span className="price">{money(ps.reduce((s, p) => s + p.total, 0))}</span>
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-card">
                      {ps.map((p) => {
                        const st = storeMap.get(p.storeId);
                        const n = items?.filter((i) => i.purchaseId === p.id).length ?? 0;
                        return (
                          <li key={p.id}>
                            <Link to={`/compras/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                              <PlaceMark name={st?.name ?? '?'} color={st?.color ?? '#64748B'} size={36} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold">{st?.name ?? 'Mercado removido'}</div>
                                <div className="text-xs text-muted">
                                  {formatDate(p.date)} · {n} {n === 1 ? 'item' : 'itens'}
                                </div>
                              </div>
                              <span className="price font-bold">{money(p.total)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Exportar CSV" description="Abre no Excel ou Planilhas Google. Para guardar tudo, use o backup.">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" icon={<ShoppingCart className="h-4 w-4" />} onClick={() => exportCsv('compras')} disabled={!items?.length}>
            Itens das compras
          </Button>
          <Button variant="secondary" onClick={() => exportCsv('precos')} disabled={!prices?.length}>
            Preços registrados
          </Button>
          <Button variant="secondary" onClick={() => exportCsv('combustiveis')} disabled={!fuel?.length}>
            Preços de combustível
          </Button>
          <Button variant="secondary" onClick={() => exportCsv('produtos')} disabled={!products?.length}>
            Produtos
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function MoverList({ title, items, up }: { title: string; items: ReturnType<typeof priceMovers>['up']; up?: boolean }) {
  return (
    <section aria-label={title} className="rounded-lg bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        {up ? <ArrowUpRight className="h-4 w-4 text-danger" aria-hidden /> : <ArrowDownRight className="h-4 w-4 text-success" aria-hidden />}
        {title}
      </h2>
      {items.length ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((m) => (
            <li key={m.product.id}>
              <Link to={`/produtos/${m.product.id}`} className="flex items-center gap-2 text-sm hover:underline">
                <span className="min-w-0 flex-1 truncate">
                  {m.product.name} <span className="text-muted">· {packageLabel(m.product)}</span>
                </span>
                <span className={`price font-bold ${up ? 'text-danger' : 'text-lime-ink'}`}>
                  {up ? '+' : ''}
                  {percent(m.pct)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhum no período.</p>
      )}
    </section>
  );
}
