import type { ID } from '@/types';

export interface OptimizerItem {
  itemId: ID;
  productId: ID;
  quantity: number;
}

export interface Quote {
  /** Preço de uma embalagem. */
  price: number;
  date: string;
  stale: boolean;
}

/** productId → storeId → preço mais recente naquele mercado. */
export type QuoteTable = Map<ID, Map<ID, Quote>>;

export interface OptimizerOptions {
  tripCost: number;
  preferSingleStore: boolean;
  minSplitSavings: number;
}

export interface StoreTotal {
  storeId: ID;
  total: number;
  covered: number;
  missing: ID[];
  staleCount: number;
  complete: boolean;
}

export interface Assignment {
  itemId: ID;
  productId: ID;
  storeId: ID;
  price: number;
  subtotal: number;
}

export interface SplitPlan {
  stores: ID[];
  goods: number;
  travelCost: number;
  total: number;
  assignments: Assignment[];
}

export interface Recommendation {
  kind: 'single' | 'split' | 'insufficient';
  stores: ID[];
  total: number;
  /** Economia líquida da compra dividida sobre o melhor mercado único (já descontado o deslocamento). */
  netSavings: number;
  reason: string;
}

export interface OptimizationResult {
  pricedItems: number;
  unpricedItems: OptimizerItem[];
  perStore: StoreTotal[];
  bestSingle?: StoreTotal;
  split?: SplitPlan;
  recommendation: Recommendation;
}

const round = (v: number) => Math.round(v * 100) / 100;
const MAX_EXACT_STORES = 14;

function planFor(stores: ID[], items: OptimizerItem[], quotes: QuoteTable, tripCost: number): SplitPlan | null {
  const assignments: Assignment[] = [];
  let goods = 0;
  for (const item of items) {
    const byStore = quotes.get(item.productId)!;
    let best: { storeId: ID; price: number } | null = null;
    for (const s of stores) {
      const q = byStore.get(s);
      if (q && (!best || q.price < best.price)) best = { storeId: s, price: q.price };
    }
    if (!best) return null;
    const subtotal = best.price * item.quantity;
    goods += subtotal;
    assignments.push({ itemId: item.itemId, productId: item.productId, storeId: best.storeId, price: best.price, subtotal: round(subtotal) });
  }
  const used = [...new Set(assignments.map((a) => a.storeId))];
  const travelCost = Math.max(0, used.length - 1) * tripCost;
  return { stores: used, goods: round(goods), travelCost: round(travelCost), total: round(goods + travelCost), assignments };
}

/**
 * Compara a lista inteira entre mercados usando o preço mais recente de cada produto em cada mercado.
 * A compra dividida considera o custo de cada deslocamento extra.
 */
export function optimizeList(items: OptimizerItem[], quotes: QuoteTable, storeIds: ID[], opts: OptimizerOptions): OptimizationResult {
  const priced = items.filter((i) => (quotes.get(i.productId)?.size ?? 0) > 0);
  const unpricedItems = items.filter((i) => !priced.includes(i));

  const perStore: StoreTotal[] = storeIds
    .map((storeId) => {
      let total = 0;
      let covered = 0;
      let staleCount = 0;
      const missing: ID[] = [];
      for (const item of priced) {
        const q = quotes.get(item.productId)?.get(storeId);
        if (!q) {
          missing.push(item.productId);
          continue;
        }
        covered++;
        total += q.price * item.quantity;
        if (q.stale) staleCount++;
      }
      return { storeId, total: round(total), covered, missing, staleCount, complete: priced.length > 0 && missing.length === 0 };
    })
    .filter((s) => s.covered > 0)
    .sort((a, b) => Number(b.complete) - Number(a.complete) || (a.complete ? a.total - b.total : b.covered - a.covered || a.total - b.total));

  const bestSingle = perStore.find((s) => s.complete);

  if (!priced.length) {
    return {
      pricedItems: 0,
      unpricedItems,
      perStore,
      recommendation: { kind: 'insufficient', stores: [], total: 0, netSavings: 0, reason: 'Nenhum item da lista tem preço registrado ainda.' },
    };
  }

  const candidates = perStore.map((s) => s.storeId);
  let split: SplitPlan | null = null;
  if (candidates.length <= MAX_EXACT_STORES) {
    for (let mask = 1; mask < 1 << candidates.length; mask++) {
      const subset = candidates.filter((_, i) => mask & (1 << i));
      const plan = planFor(subset, priced, quotes, opts.tripCost);
      if (plan && (!split || plan.total < split.total - 0.004 || (Math.abs(plan.total - split.total) < 0.005 && plan.stores.length < split.stores.length))) {
        split = plan;
      }
    }
  } else {
    split = planFor(candidates, priced, quotes, opts.tripCost);
  }

  let recommendation: Recommendation;
  if (!split) {
    recommendation = { kind: 'insufficient', stores: [], total: 0, netSavings: 0, reason: 'Não foi possível montar uma combinação com os preços registrados.' };
  } else if (!bestSingle) {
    recommendation = {
      kind: 'split',
      stores: split.stores,
      total: split.total,
      netSavings: 0,
      reason: 'Nenhum lugar tem preço registrado de todos os itens; a combinação abaixo cobre a lista.',
    };
  } else {
    const netSavings = round(bestSingle.total - split.total);
    const isSplit = split.stores.length > 1 && netSavings > 0;
    if (!isSplit) {
      recommendation = {
        kind: 'single',
        stores: [bestSingle.storeId],
        total: bestSingle.total,
        netSavings: 0,
        reason:
          split.stores.length > 1
            ? 'Dividir a compra não compensa depois de somar o custo de deslocamento.'
            : 'Este lugar tem o menor total para a lista inteira.',
      };
    } else if (opts.preferSingleStore && netSavings < opts.minSplitSavings) {
      recommendation = {
        kind: 'single',
        stores: [bestSingle.storeId],
        total: bestSingle.total,
        netSavings,
        reason: `Dividir economizaria só ${netSavings.toFixed(2).replace('.', ',')} reais, abaixo do mínimo que você definiu para ir a mais de um lugar.`,
      };
    } else {
      recommendation = {
        kind: 'split',
        stores: split.stores,
        total: split.total,
        netSavings,
        reason: `Dividir entre ${split.stores.length} lugares economiza mesmo somando ${split.travelCost.toFixed(2).replace('.', ',')} reais de deslocamento.`,
      };
    }
  }

  return { pricedItems: priced.length, unpricedItems, perStore, bestSingle, split: split ?? undefined, recommendation };
}
