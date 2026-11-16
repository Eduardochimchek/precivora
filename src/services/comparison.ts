import type { ID, PriceRecord, Product } from '@/types';
import { packagePrice, unitPrice } from './units';
import { isStale } from '@/utils/date';

export interface PriceChange {
  previous: number;
  current: number;
  diff: number;
  /** Variação relativa (−0,0772 = −7,72%). */
  pct: number;
  direction: 'down' | 'up' | 'same';
}

export function priceChange(previous: number, current: number): PriceChange {
  const diff = Math.round((current - previous) * 100) / 100;
  const pct = previous > 0 ? (current - previous) / previous : 0;
  return { previous, current, diff, pct, direction: Math.abs(diff) < 0.005 ? 'same' : diff < 0 ? 'down' : 'up' };
}

export interface StoreQuote {
  storeId: ID;
  record: PriceRecord;
  packagePrice: number;
  unitPrice: number;
  stale: boolean;
  confirmed: boolean;
}

export interface ProductStats {
  count: number;
  /** Menor preço já registrado (qualquer data). */
  historicMin: StoreQuote;
  historicMax: StoreQuote;
  last: StoreQuote;
  /** Variação do último registro em relação ao anterior. */
  lastChange?: PriceChange;
  avgPackage: number;
  avgUnit: number;
  /** Menor entre os preços mais recentes de cada mercado que ainda não estão desatualizados. */
  recentMin?: StoreQuote;
  /** Último preço confirmado em uma compra real. */
  lastConfirmed?: StoreQuote;
  /** Preço mais recente de cada mercado, do mais barato ao mais caro. */
  byStore: StoreQuote[];
  lastUpdate: string;
  allStale: boolean;
}

function quote(r: PriceRecord, product: Product, staleDays: number, now: Date): StoreQuote {
  const pp = packagePrice(r);
  return {
    storeId: r.storeId,
    record: r,
    packagePrice: pp,
    unitPrice: unitPrice(pp, product),
    stale: isStale(r.date, staleDays, now),
    confirmed: r.source === 'purchase',
  };
}

/** Mais recente primeiro: pela data do preço e, no mesmo instante, pela ordem em que foi registrado. */
export const byRecent = (a: { date: string; createdAt: string }, b: { date: string; createdAt: string }) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
const byDateDesc = byRecent;

/** Estatísticas de preço de um produto. Retorna `null` quando não há registros. */
export function productStats(product: Product, records: PriceRecord[], staleDays = 30, now = new Date()): ProductStats | null {
  if (!records.length) return null;
  const sorted = [...records].sort(byDateDesc);
  const quotes = sorted.map((r) => quote(r, product, staleDays, now));
  const last = quotes[0];
  const prevSameStore = quotes.find((q, i) => i > 0 && q.storeId === last.storeId) ?? quotes[1];

  const latestPerStore = new Map<ID, StoreQuote>();
  for (const q of quotes) if (!latestPerStore.has(q.storeId)) latestPerStore.set(q.storeId, q);
  const byStore = [...latestPerStore.values()].sort((a, b) => a.packagePrice - b.packagePrice);
  const fresh = byStore.filter((q) => !q.stale);

  let min = quotes[0];
  let max = quotes[0];
  for (const q of quotes) {
    if (q.packagePrice < min.packagePrice) min = q;
    if (q.packagePrice > max.packagePrice) max = q;
  }
  const avgPackage = quotes.reduce((s, q) => s + q.packagePrice, 0) / quotes.length;

  return {
    count: quotes.length,
    historicMin: min,
    historicMax: max,
    last,
    lastChange: prevSameStore ? priceChange(prevSameStore.packagePrice, last.packagePrice) : undefined,
    avgPackage,
    avgUnit: unitPrice(avgPackage, product),
    recentMin: fresh[0],
    lastConfirmed: quotes.find((q) => q.confirmed),
    byStore,
    lastUpdate: last.record.date,
    allStale: fresh.length === 0,
  };
}

/** Variação de um preço novo contra o último registrado no mesmo mercado (ou em qualquer mercado). */
export function compareWithLast(
  records: PriceRecord[],
  storeId: ID,
  newPackagePrice: number,
): { change: PriceChange; sameStore: boolean; reference: PriceRecord } | null {
  const sorted = [...records].sort(byDateDesc);
  const sameStore = sorted.find((r) => r.storeId === storeId);
  const ref = sameStore ?? sorted[0];
  if (!ref) return null;
  return { change: priceChange(packagePrice(ref), newPackagePrice), sameStore: !!sameStore, reference: ref };
}
