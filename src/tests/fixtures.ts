import type { FuelPrice, PriceRecord, Product, Review } from '@/types';

let seq = 0;
const now = '2026-11-16T12:00:00.000Z';

export function product(p: Partial<Product> = {}): Product {
  const id = p.id ?? `p${++seq}`;
  return {
    id,
    name: p.name ?? `Produto ${id}`,
    nameKey: (p.name ?? `produto ${id}`).toLowerCase(),
    unit: 'kg',
    packageSize: 1,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...p,
  };
}

export function price(p: Partial<PriceRecord> & { productId: string; storeId: string; price: number }): PriceRecord {
  return {
    id: p.id ?? `r${++seq}`,
    quantity: 1,
    date: now,
    promo: false,
    source: 'manual',
    createdAt: p.date ?? now,
    updatedAt: now,
    ...p,
  };
}

export function fuel(p: Partial<FuelPrice> & { stationId: string; price: number }): FuelPrice {
  return { id: p.id ?? `f${++seq}`, fuel: 'gasolina_comum', date: now, promo: false, createdAt: now, updatedAt: now, ...p };
}

export function review(p: Partial<Review> & { targetId: string; overall: number }): Review {
  return {
    id: p.id ?? `v${++seq}`,
    targetType: 'product',
    favorite: false,
    avoid: false,
    date: now,
    createdAt: now,
    updatedAt: now,
    ...p,
  };
}

export const daysAgo = (n: number, from = new Date('2026-11-16T12:00:00.000Z')) => new Date(from.getTime() - n * 86_400_000).toISOString();
export const NOW = new Date('2026-11-16T12:00:00.000Z');
