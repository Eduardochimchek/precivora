import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownRight,
  Check,
  ChevronRight,
  Fuel,
  ListChecks,
  MapPin,
  Package,
  PackagePlus,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Tag,
  X,
} from 'lucide-react';
import { db } from '@/db/database';
import { Card, Chip, IconButton, ListSkeleton, LogoSymbol, PlaceMark, PriceTag, ProgressBar, Section, Skeleton, cx } from '@/design-system';
import { isNative } from '@/app/native';
import { useSettings } from '@/app/SettingsContext';
import { useActions } from '@/features/forms/ActionsContext';
import { useBrands, useFuelPrices, useMapById, usePrices, useProducts, usePurchaseItems, usePurchases, useStations, useStores } from '@/hooks/useData';
import { productStats } from '@/services/comparison';
import { FUEL_LABEL, rankStations } from '@/services/fuel';
import { budgetLevel, estimatedSavings } from '@/services/analytics';
import { formatUnitPrice, packageLabel, packagePrice, recordUnitPrice } from '@/services/units';
import { formatMonthLong, greeting, relativeDays, startOfMonth } from '@/utils/date';
import { money, money3, percent } from '@/utils/format';
import { capitalizeFirst } from '@/utils/text';
import type { ActivityKind, FuelType, ID } from '@/types';
import { UpdateBanner } from '@/features/update/UpdateBanner';

const ACTIVITY_ICON: Record<ActivityKind, typeof Tag> = {
  price: Tag,
  fuel: Fuel,
  purchase: ShoppingCart,
  product: Package,
  store: Store,
  station: Fuel,
  segment: Store,
  review: Star,
  list: ListChecks,
  backup: ShieldCheck,
};

export function DashboardPage() {
  const { settings, update } = useSettings();
  const actions = useActions();
  const products = useProducts();
  const stores = useStores();
  const stations = useStations();
  const prices = usePrices();
  const fuelPrices = useFuelPrices();
  const purchases = usePurchases();
  const items = usePurchaseItems();
  const brands = useMapById(useBrands());
  const storeMap = useMapById(stores);
  const stationMap = useMapById(stations);
  const productMap = useMapById(products);
  const activities = useLiveQuery(() => db.activities.orderBy('createdAt').reverse().limit(6).toArray(), []);

  const loading = !products || !stores || !stations || !prices || !fuelPrices || !purchases || !items;
  const listCount = useLiveQuery(() => db.lists.count(), []);

  const month = useMemo(() => {
    if (!purchases || !items || !prices) return null;
    const from = startOfMonth().toISOString();
    const inMonth = (p: { date: string }) => p.date >= from;
    const spent = purchases.filter(inMonth).reduce((s, p) => s + p.total, 0);
    return { spent, savings: estimatedSavings(items, purchases, prices, inMonth), count: purchases.filter(inMonth).length };
  }, [purchases, items, prices]);

  const opportunities = useMemo(() => {
    if (!products || !prices) return [];
    const byProduct = new Map<ID, typeof prices>();
    for (const r of prices) byProduct.set(r.productId, [...(byProduct.get(r.productId) ?? []), r]);
    return products
      .filter((p) => !p.archived)
      .map((p) => ({ p, s: productStats(p, byProduct.get(p.id) ?? [], settings.staleDays) }))
      .filter((x) => x.s && x.s.count >= 2 && x.s.recentMin && x.s.recentMin.packagePrice < x.s.avgPackage)
      .map((x) => ({ ...x, pct: (x.s!.avgPackage - x.s!.recentMin!.packagePrice) / x.s!.avgPackage }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [products, prices, settings.staleDays]);

  const cheapestFuel = useMemo(() => {
    if (!fuelPrices || !stationMap.size) return [];
    const active = fuelPrices.filter((r) => stationMap.get(r.stationId)?.active);
    const fuels = (['gasolina_comum', 'etanol', 'diesel_s10', 'gasolina_aditivada', 'diesel', 'gnv', 'gasolina_premium'] as FuelType[]).filter((f) =>
      active.some((r) => r.fuel === f),
    );
    return fuels.slice(0, 3).map((fuel) => {
      const rank = rankStations(active, fuel, 7);
      return { fuel, best: rank[0], spread: rank.length > 1 ? rank[rank.length - 1].record.price - rank[0].record.price : 0, count: rank.length };
    });
  }, [fuelPrices, stationMap]);

  const recentPrices = useMemo(() => (prices ? [...prices].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5) : []), [prices]);
  const name = settings.userName.trim().split(' ')[0];
  const now = new Date();
  const budget = settings.monthlyBudget;
  const level = month ? budgetLevel(month.spent, budget) : 'none';

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-3 pt-5 md:pt-9">
        <LogoSymbol className="h-9 w-9 text-ink md:hidden" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight md:text-[34px]">
            {greeting(now)}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="text-sm text-muted">{capitalizeFirst(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now))}</p>
        </div>
      </header>

      <UpdateBanner />

      {loading ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <ListSkeleton rows={3} />
        </div>
      ) : (
        <>
          {isNative ? (
            <Link to="/notas/importar?auto=1" data-tour="scan" className="group -mt-2 flex items-center gap-4 rounded-2xl bg-lime p-4 text-navy shadow-card transition-[filter] hover:brightness-95 active:brightness-90">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-lime">
                <ScanLine className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">Escanear nota fiscal</span>
                <span className="text-sm text-navy/75">Lugar, produtos e preços de uma vez</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ) : (
            <button type="button" data-tour="scan" onClick={() => actions.openPrice()} className="group -mt-2 flex items-center gap-4 rounded-2xl bg-lime p-4 text-left text-navy shadow-card transition-[filter] hover:brightness-95 active:brightness-90">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy text-lime">
                <Tag className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">Registrar preço</span>
                <span className="text-sm text-navy/75">Anote o que viu na prateleira</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
            </button>
          )}

          {!settings.checklistHidden && (
            <FirstSteps
              steps={[
                ...(isNative
                  ? [{ label: 'Escanear sua primeira nota fiscal', done: purchases!.some((p) => !!p.receiptKey), to: '/notas/importar?auto=1' }]
                  : []),
                { label: 'Cadastrar um lugar', done: stores!.length + stations!.length > 0, onClick: () => actions.openPlace({ mode: 'items' }) },
                { label: 'Registrar um preço', done: prices!.length + fuelPrices!.length > 0, onClick: () => actions.openPrice() },
                { label: 'Montar uma lista de compras', done: (listCount ?? 0) > 0, to: '/listas' },
                { label: 'Fazer o primeiro backup', done: !!(settings.lastBackupAt || settings.lastAutoBackupAt), to: '/backup' },
              ]}
              onHide={() => update({ checklistHidden: true })}
            />
          )}

          <SavingsPanel
            savings={month?.savings ?? 0}
            spent={month?.spent ?? 0}
            purchases={month?.count ?? 0}
            budget={budget}
            goal={settings.savingsGoal}
            level={level}
          />

          <nav aria-label="Atalhos" data-tour="shortcuts" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:px-0">
            {isNative && <Shortcut icon={Tag} label="Registrar preço" onClick={() => actions.openPrice()} primary />}
            <Shortcut icon={Fuel} label="Combustível" onClick={() => actions.openFuel()} primary={!isNative} />
            <Shortcut icon={ShoppingCart} label="Compra sem nota" to="/compras/nova" />
            <Shortcut icon={PackagePlus} label="Produto" onClick={() => actions.openProduct()} />
            <Shortcut icon={MapPin} label="Lugar" onClick={() => actions.openPlace({ mode: 'items' })} />
          </nav>

          <dl className="grid grid-cols-3 divide-x divide-line rounded-lg bg-surface py-4 shadow-card">
            <Counter label="Produtos" value={products!.filter((p) => !p.archived).length} to="/produtos" />
            <Counter label="Preços" value={prices!.length + fuelPrices!.length} to="/comparar" />
            <Counter label="Lugares" value={stores!.length + stations!.length} to="/lugares" />
          </dl>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2 xl:items-start">
          <Section
            title="Oportunidades"
            id="sec-oportunidades"
            action={
              <Link to="/comparar" className="-my-2.5 py-2.5 pl-3 text-sm font-semibold text-accent">
                Comparar
              </Link>
            }
          >
            {opportunities.length ? (
              <ul className="flex flex-col gap-2">
                {opportunities.map(({ p, s, pct }) => (
                  <li key={p.id}>
                    <Link to={`/produtos/${p.id}`} className="flex items-center gap-3 rounded-lg bg-surface p-3.5 shadow-card transition-colors hover:bg-sunken">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.name}</div>
                        <div className="truncate text-xs text-muted">
                          {[p.brandId ? brands.get(p.brandId)?.name : null, packageLabel(p)].filter(Boolean).join(' · ')}
                        </div>
                        <p className="mt-1.5 text-xs leading-snug">
                          <ArrowDownRight className="mr-1 inline h-3.5 w-3.5 align-[-3px] text-success" aria-hidden />
                          <span className="font-semibold text-lime-ink">{percent(pct)} abaixo da sua média</span>
                          <span className="text-muted"> em {storeMap.get(s!.recentMin!.storeId)?.name}</span>
                        </p>
                      </div>
                      <PriceTag value={money(s!.recentMin!.packagePrice)} tone="best" size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-surface p-4 text-sm text-muted shadow-card">
                Quando um produto tiver dois ou mais preços registrados, os que estiverem abaixo da sua média aparecem aqui.
              </p>
            )}
          </Section>

          <Section
            title="Combustível"
            id="sec-combustivel"
            action={
              <Link to="/combustiveis" className="-my-2.5 py-2.5 pl-3 text-sm font-semibold text-accent">
                Ver postos
              </Link>
            }
          >
            {cheapestFuel.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {cheapestFuel.map(({ fuel, best, spread, count }) => (
                  <Link key={fuel} to={`/combustiveis?f=${fuel}`} className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-card hover:bg-sunken">
                    <span className="text-sm font-semibold text-muted">{FUEL_LABEL[fuel]}</span>
                    <span className="price text-[26px] font-bold leading-none">{money3(best.record.price)}</span>
                    <span className="truncate text-xs text-muted">
                      {stationMap.get(best.stationId)?.name} · {relativeDays(best.record.date)}
                    </span>
                    {count > 1 && spread > 0 && (
                      <span className="text-xs font-semibold text-lime-ink">{money3(spread)} por litro abaixo do mais caro</span>
                    )}
                    {best.stale && <Chip tone="warn" className="self-start">Preço com mais de 7 dias</Chip>}
                  </Link>
                ))}
              </div>
            ) : (
              <button
                onClick={() => (stations!.length ? actions.openFuel() : actions.openPlace({ mode: 'fuel' }))}
                className="flex w-full items-center gap-3 rounded-lg bg-surface p-4 text-left shadow-card hover:bg-sunken"
              >
                <Fuel className="h-5 w-5 text-accent" aria-hidden />
                <span className="flex-1 text-sm">
                  {stations!.length ? 'Registre o preço da bomba para comparar postos.' : 'Cadastre os postos que você costuma usar.'}
                </span>
                <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
              </button>
            )}
          </Section>

          <Section title="Últimos preços" id="sec-ultimos">
            {recentPrices.length ? (
              <Card as="section" className="divide-y divide-line">
                {recentPrices.map((r) => {
                  const p = productMap.get(r.productId);
                  const st = storeMap.get(r.storeId);
                  if (!p) return null;
                  return (
                    <Link key={r.id} to={`/produtos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunken">
                      <PlaceMark name={st?.name ?? '?'} color={st?.color ?? '#64748B'} logo={st?.logo} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-semibold">{p.name}</div>
                        <div className="truncate text-xs text-muted">
                          {st?.name} · {relativeDays(r.date)}
                          {r.source === 'purchase' ? ' · compra' : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="price font-bold">{money(packagePrice(r))}</div>
                        <div className="text-[11px] text-muted">{formatUnitPrice(recordUnitPrice(r, p), p.unit)}</div>
                      </div>
                    </Link>
                  );
                })}
              </Card>
            ) : (
              <button onClick={() => actions.openPrice()} className="flex w-full items-center gap-3 rounded-lg bg-surface p-4 text-left shadow-card hover:bg-sunken">
                <Tag className="h-5 w-5 text-accent" aria-hidden />
                <span className="flex-1 text-sm">Registre o primeiro preço — leva poucos segundos.</span>
                <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
              </button>
            )}
          </Section>

          </div>

          {!!activities?.length && (
            <Section title="Atividade recente" id="sec-atividade">
              <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
                {activities.map((a) => {
                  const Icon = ACTIVITY_ICON[a.kind];
                  return (
                    <li key={a.id} className="relative flex items-center gap-3 text-sm">
                      <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-bg">
                        <Icon className="h-3.5 w-3.5 text-muted" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{a.label}</span>
                      <span className="shrink-0 text-xs text-muted">{relativeDays(a.createdAt)}</span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function SavingsPanel({
  savings,
  spent,
  purchases,
  budget,
  goal,
  level,
}: {
  savings: number;
  spent: number;
  purchases: number;
  budget: number;
  goal: number;
  level: ReturnType<typeof budgetLevel>;
}) {
  const monthName = formatMonthLong(new Date()).split(' ')[0];
  return (
    <section aria-labelledby="economia-titulo" className="relative overflow-hidden rounded-2xl bg-navy p-5 text-[#F1F5F9] shadow-float dark:bg-raised md:p-7">
      <svg aria-hidden viewBox="0 0 200 120" className="absolute -right-4 top-3 h-24 w-44 text-lime opacity-[0.14] md:h-32 md:w-56" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 20 L70 70 L100 45 L170 105" />
        <path d="M130 105 H170 V68" />
      </svg>
      <h2 id="economia-titulo" className="relative text-sm font-semibold text-[#94A3B8]">
        Economia estimada em {monthName}
      </h2>
      <p className="price relative mt-2 text-[44px] font-bold leading-none text-lime md:text-[56px]">{money(savings)}</p>
      <p className="relative mt-2 max-w-xs text-xs text-[#94A3B8]">
        {purchases
          ? `Em ${purchases} compra${purchases > 1 ? 's' : ''}, comparando o que você pagou com a média dos seus registros.`
          : 'Registre suas compras para acompanhar quanto está economizando.'}
      </p>
      <Link to="/orcamento" className="relative mt-5 block rounded-lg bg-white/[0.06] p-3.5 hover:bg-white/10">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="whitespace-nowrap text-[#CBD5E1]">Gasto no mês</span>
          <span className="price font-bold">
            {money(spent)}
            {budget > 0 && <span className="font-normal text-[#94A3B8]"> de {money(budget)}</span>}
          </span>
        </div>
        {budget > 0 ? (
          <ProgressBar value={spent / budget} tone={level} label="Orçamento do mês consumido" />
        ) : (
          <span className="text-xs text-[#94A3B8]">Defina um orçamento mensal para ver o quanto já usou.</span>
        )}
        {goal > 0 && (
          <div className="mt-2 text-xs text-[#94A3B8]">
            Meta de economia: {money(goal)} · {percent(Math.min(1, savings / goal))} alcançado
          </div>
        )}
      </Link>
    </section>
  );
}

function Shortcut({ icon: Icon, label, onClick, to, primary }: { icon: typeof Tag; label: string; onClick?: () => void; to?: string; primary?: boolean }) {
  const cls = cx(
    'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
    primary ? 'bg-primary text-on-primary hover:opacity-90' : 'border border-line bg-surface hover:bg-sunken',
  );
  const content = (
    <>
      <Icon className={cx('h-4 w-4', primary && 'text-lime dark:text-lime-ink')} aria-hidden />
      {label}
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}

function Counter({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-0.5 px-2 hover:opacity-80">
      <dd className="price text-2xl font-bold">{value.toLocaleString('pt-BR')}</dd>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
    </Link>
  );
}

interface FirstStep {
  label: string;
  done: boolean;
  to?: string;
  onClick?: () => void;
}

function FirstSteps({ steps, onHide }: { steps: FirstStep[]; onHide: () => void }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-labelledby="primeiros-passos" className="rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="primeiros-passos" className="font-bold">
            Primeiros passos
          </h2>
          <p className="text-xs text-muted">
            {done} de {steps.length} concluídos
          </p>
        </div>
        <IconButton label="Ocultar primeiros passos" className="-mr-2" onClick={onHide}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <ProgressBar value={done / steps.length} tone="ok" label="Primeiros passos concluídos" />
      <ul className="mt-2 flex flex-col">
        {steps.map((s) => {
          const inner = (
            <>
              <span
                className={cx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                  s.done ? 'border-transparent bg-lime-ink text-white dark:bg-lime dark:text-navy' : 'border-line',
                )}
              >
                {s.done && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
              </span>
              <span className={cx('flex-1 text-sm', s.done ? 'text-muted line-through' : 'font-semibold')}>{s.label}</span>
              {!s.done && <ChevronRight className="h-4 w-4 text-muted" aria-hidden />}
              <span className="sr-only">{s.done ? '(concluído)' : ''}</span>
            </>
          );
          const cls = 'flex min-h-11 w-full items-center gap-3 rounded-md py-2 text-left';
          return (
            <li key={s.label}>
              {s.done ? (
                <div className={cls}>{inner}</div>
              ) : s.to ? (
                <Link to={s.to} className={cx(cls, 'hover:bg-sunken')}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={s.onClick} className={cx(cls, 'hover:bg-sunken')}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
