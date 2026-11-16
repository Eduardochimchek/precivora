import type { Category, CategoryBudget, ID, PriceRecord, Product, Purchase, PurchaseItem } from '@/types';
import { formatMonth, monthKey } from '@/utils/date';
import { packagePrice, unitPrice } from './units';

const round = (v: number) => Math.round(v * 100) / 100;

export function monthlySpending(purchases: Purchase[], months = 6, now = new Date()) {
  const out: { key: string; label: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: formatMonth(d.toISOString()), total: 0 });
  }
  const idx = new Map(out.map((m, i) => [m.key, i]));
  for (const p of purchases) {
    const i = idx.get(monthKey(p.date));
    if (i != null) out[i].total = round(out[i].total + p.total);
  }
  return out;
}

export interface CategorySpend {
  categoryId: ID | 'none';
  name: string;
  color: string;
  total: number;
}

export function categorySpending(
  items: PurchaseItem[],
  purchases: Purchase[],
  products: Map<ID, Product>,
  categories: Map<ID, Category>,
  filter?: (p: Purchase) => boolean,
): CategorySpend[] {
  const allowed = new Set(purchases.filter((p) => !filter || filter(p)).map((p) => p.id));
  const totals = new Map<string, number>();
  for (const it of items) {
    if (!allowed.has(it.purchaseId)) continue;
    const cat = products.get(it.productId)?.categoryId ?? 'none';
    totals.set(cat, (totals.get(cat) ?? 0) + it.quantity * it.unitPrice);
  }
  return [...totals.entries()]
    .map(([id, total]) => {
      const c = id === 'none' ? undefined : categories.get(id);
      return { categoryId: id as ID | 'none', name: c?.name ?? 'Sem categoria', color: c?.color ?? '#94A3B8', total: round(total) };
    })
    .sort((a, b) => b.total - a.total);
}

export interface PriceMover {
  product: Product;
  first: number;
  last: number;
  pct: number;
  firstDate: string;
  lastDate: string;
}

/** Produtos cujo preço por unidade mais subiu ou caiu entre o primeiro e o último registro do período. */
export function priceMovers(products: Product[], prices: PriceRecord[], sinceISO?: string): { up: PriceMover[]; down: PriceMover[] } {
  const byProduct = new Map<ID, PriceRecord[]>();
  for (const r of prices) {
    if (sinceISO && r.date < sinceISO) continue;
    const arr = byProduct.get(r.productId);
    if (arr) arr.push(r);
    else byProduct.set(r.productId, [r]);
  }
  const movers: PriceMover[] = [];
  for (const product of products) {
    const recs = byProduct.get(product.id);
    if (!recs || recs.length < 2) continue;
    recs.sort((a, b) => (a.date < b.date ? -1 : 1));
    const f = recs[0];
    const l = recs[recs.length - 1];
    if (f.date.slice(0, 10) === l.date.slice(0, 10)) continue;
    const first = unitPrice(packagePrice(f), product);
    const last = unitPrice(packagePrice(l), product);
    if (!(first > 0)) continue;
    movers.push({ product, first, last, pct: (last - first) / first, firstDate: f.date, lastDate: l.date });
  }
  return {
    up: movers.filter((m) => m.pct > 0.001).sort((a, b) => b.pct - a.pct),
    down: movers.filter((m) => m.pct < -0.001).sort((a, b) => a.pct - b.pct),
  };
}

/**
 * Economia estimada das compras: para cada item, quanto foi pago abaixo da média dos preços
 * que você registrou para o produto em outros momentos/mercados. Só conta diferenças positivas.
 */
export function estimatedSavings(items: PurchaseItem[], purchases: Purchase[], prices: PriceRecord[], filter?: (p: Purchase) => boolean): number {
  const allowed = new Set(purchases.filter((p) => !filter || filter(p)).map((p) => p.id));
  const byProduct = new Map<ID, PriceRecord[]>();
  for (const r of prices) {
    const arr = byProduct.get(r.productId);
    if (arr) arr.push(r);
    else byProduct.set(r.productId, [r]);
  }
  let total = 0;
  for (const it of items) {
    if (!allowed.has(it.purchaseId)) continue;
    const others = (byProduct.get(it.productId) ?? []).filter((r) => r.purchaseId !== it.purchaseId);
    if (others.length < 1) continue;
    const avg = others.reduce((s, r) => s + packagePrice(r), 0) / others.length;
    if (avg > it.unitPrice) total += (avg - it.unitPrice) * it.quantity;
  }
  return round(total);
}

export type BudgetLevel = 'ok' | 'warn' | 'over' | 'none';

export const budgetLevel = (spent: number, limit: number): BudgetLevel =>
  !(limit > 0) ? 'none' : spent >= limit ? 'over' : spent >= limit * 0.8 ? 'warn' : 'ok';

export interface CategoryBudgetStatus {
  budget: CategoryBudget;
  category?: Category;
  spent: number;
  pct: number;
  level: BudgetLevel;
}

export function categoryBudgetStatus(budgets: CategoryBudget[], spend: CategorySpend[], categories: Map<ID, Category>): CategoryBudgetStatus[] {
  const spent = new Map(spend.map((s) => [s.categoryId, s.total]));
  return budgets
    .map((b) => {
      const s = spent.get(b.categoryId) ?? 0;
      return { budget: b, category: categories.get(b.categoryId), spent: s, pct: b.limit > 0 ? s / b.limit : 0, level: budgetLevel(s, b.limit) };
    })
    .sort((a, b) => b.pct - a.pct);
}
