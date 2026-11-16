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
export const useStores = () => useLiveQuery(() => db.stores.orderBy('name').toArray(), []);
export const useStations = () => useLiveQuery(() => db.stations.orderBy('name').toArray(), []);
export const usePrices = () => useLiveQuery(() => db.prices.toArray(), []);
export const useFuelPrices = () => useLiveQuery(() => db.fuelPrices.toArray(), []);
export const useReviews = () => useLiveQuery(() => db.reviews.toArray(), []);
export const usePurchases = () => useLiveQuery(() => db.purchases.orderBy('date').reverse().toArray(), []);
export const usePurchaseItems = () => useLiveQuery(() => db.purchaseItems.toArray(), []);
