import { db } from '@/db/database';
import type { FuelPrice, FuelType, ID, PriceRecord } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText } from '@/utils/text';
import { fuelPriceSchema, priceSchema } from '@/services/schemas';
import { FUEL_LABEL } from '@/services/fuel';
import { money, money3 } from '@/utils/format';
import { validate } from './errors';
import { logActivity } from './activity';

export interface PriceInput {
  productId: ID;
  storeId: ID;
  price: number;
  quantity?: number;
  date: string;
  promo?: boolean;
  notes?: string;
}

export async function savePrice(input: PriceInput, id?: ID): Promise<PriceRecord> {
  const now = nowISO();
  const prev = id ? await db.prices.get(id) : undefined;
  const record: PriceRecord = validate(priceSchema, {
    id: id ?? newId(),
    productId: input.productId,
    storeId: input.storeId,
    price: Math.round(input.price * 100) / 100,
    quantity: input.quantity && input.quantity > 0 ? input.quantity : 1,
    date: input.date,
    promo: !!input.promo,
    notes: cleanText(input.notes, 500),
    source: prev?.source ?? 'manual',
    purchaseId: prev?.purchaseId,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.prices.put(record);
  if (!id) {
    const product = await db.products.get(record.productId);
    await logActivity('price', `${product?.name ?? 'Produto'}: ${money(record.price)}`, record.id);
  }
  return record;
}

export async function deletePrice(id: ID): Promise<void> {
  await db.prices.delete(id);
}

/** Preços de um produto, do mais recente para o mais antigo. */
export async function pricesOf(productId: ID): Promise<PriceRecord[]> {
  return db.prices.where('[productId+date]').between([productId, ''], [productId, '￿']).reverse().toArray();
}

export interface FuelPriceInput {
  stationId: ID;
  fuel: FuelType;
  price: number;
  date: string;
  promo?: boolean;
  notes?: string;
}

export async function saveFuelPrice(input: FuelPriceInput, id?: ID): Promise<FuelPrice> {
  const now = nowISO();
  const prev = id ? await db.fuelPrices.get(id) : undefined;
  const record: FuelPrice = validate(fuelPriceSchema, {
    id: id ?? newId(),
    stationId: input.stationId,
    fuel: input.fuel,
    price: Math.round(input.price * 1000) / 1000,
    date: input.date,
    promo: !!input.promo,
    notes: cleanText(input.notes, 500),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.fuelPrices.put(record);
  if (!id) {
    const station = await db.stations.get(record.stationId);
    await logActivity('fuel', `${FUEL_LABEL[record.fuel]} ${money3(record.price)} · ${station?.name ?? 'posto'}`, record.id);
  }
  return record;
}

export async function deleteFuelPrice(id: ID): Promise<void> {
  await db.fuelPrices.delete(id);
}
