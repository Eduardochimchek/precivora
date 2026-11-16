import { db } from '@/db/database';
import type { ID, Station, Store } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText } from '@/utils/text';
import { stationSchema, storeSchema } from '@/services/schemas';
import { validate, ValidationError } from './errors';
import { logActivity } from './activity';

export interface PlaceInput {
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  notes?: string;
  color: string;
  active: boolean;
  flag?: string;
}

function base(input: PlaceInput) {
  const name = cleanText(input.name, 100);
  if (!name) throw new ValidationError('Informe o nome');
  return {
    name,
    address: cleanText(input.address, 200),
    neighborhood: cleanText(input.neighborhood, 80),
    city: cleanText(input.city, 80),
    notes: cleanText(input.notes, 1000),
    color: input.color,
    active: input.active,
  };
}

export async function saveStore(input: PlaceInput, id?: ID): Promise<ID> {
  const now = nowISO();
  const prev = id ? await db.stores.get(id) : undefined;
  const store: Store = validate(storeSchema, { id: id ?? newId(), ...base(input), createdAt: prev?.createdAt ?? now, updatedAt: now });
  await db.stores.put(store);
  if (!id) await logActivity('store', `Mercado cadastrado: ${store.name}`, store.id);
  return store.id;
}

export async function deleteStore(id: ID): Promise<void> {
  const purchases = await db.purchases.where('storeId').equals(id).count();
  if (purchases > 0) throw new ValidationError('Há compras registradas neste mercado. Marque como inativo em vez de excluir.');
  await db.transaction('rw', [db.stores, db.prices], async () => {
    await db.prices.where('storeId').equals(id).delete();
    await db.stores.delete(id);
  });
}

export async function saveStation(input: PlaceInput, id?: ID): Promise<ID> {
  const now = nowISO();
  const prev = id ? await db.stations.get(id) : undefined;
  const station: Station = validate(stationSchema, {
    id: id ?? newId(),
    ...base(input),
    flag: cleanText(input.flag, 60),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.stations.put(station);
  if (!id) await logActivity('station', `Posto cadastrado: ${station.name}`, station.id);
  return station.id;
}

export async function deleteStation(id: ID): Promise<void> {
  await db.transaction('rw', [db.stations, db.fuelPrices], async () => {
    await db.fuelPrices.where('stationId').equals(id).delete();
    await db.stations.delete(id);
  });
}
