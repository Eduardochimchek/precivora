import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/database';
import type { ID } from '@/types';

/** Indexa uma lista por id. */
export function useMapById<T extends { id: ID }>(rows: T[] | undefined): Map<ID, T> {
  return useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
}

export const useProducts = () => useLiveQuery(() => db.products.orderBy('name').toArray(), []);
export const useBrands = () => useLiveQuery(() => db.brands.orderBy('name').toArray(), []);
export const useCategories = () => useLiveQuery(() => db.categories.orderBy('name').toArray(), []);
export const useSegments = () => useLiveQuery(() => db.segments.orderBy('order').toArray(), []);
/** Todos os lugares, de qualquer segmento. */
export const usePlaces = () => useLiveQuery(() => db.stores.orderBy('name').toArray(), []);

/** IDs dos segmentos de combustível. */
async function fuelSegmentIds(): Promise<string[]> {
  return (await db.segments.toArray()).filter((s) => s.mode === 'fuel').map((s) => s.id);
}

/** Lugares de segmentos de produtos (mercado, farmácia, ...). */
export const useStores = () =>
  useLiveQuery(async () => {
    const fuel = new Set(await fuelSegmentIds());
    return (await db.stores.orderBy('name').toArray()).filter((p) => !fuel.has(p.segmentId));
  }, []);

/** Lugares de combustível (postos). */
export const useStations = () =>
  useLiveQuery(async () => {
    const fuel = new Set(await fuelSegmentIds());
    return (await db.stores.orderBy('name').toArray()).filter((p) => fuel.has(p.segmentId));
  }, []);
export const usePrices = () => useLiveQuery(() => db.prices.toArray(), []);
export const useFuelPrices = () => useLiveQuery(() => db.fuelPrices.toArray(), []);
export const useReviews = () => useLiveQuery(() => db.reviews.toArray(), []);
export const usePurchases = () => useLiveQuery(() => db.purchases.orderBy('date').reverse().toArray(), []);
export const usePurchaseItems = () => useLiveQuery(() => db.purchaseItems.toArray(), []);
