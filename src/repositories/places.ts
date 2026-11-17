import { db } from '@/db/database';
import type { ID, Place, Segment } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText } from '@/utils/text';
import { placeSchema, segmentSchema } from '@/services/schemas';
import { validate, ValidationError } from './errors';
import { logActivity } from './activity';

export interface PlaceInput {
  segmentId: ID;
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  notes?: string;
  color: string;
  active: boolean;
  flag?: string;
  /** Mantido quando omitido (o formulário não edita o CNPJ). */
  cnpj?: string;
}

/** Cria ou atualiza um lugar (mercado, farmácia, posto...). */
export async function savePlace(input: PlaceInput, id?: ID): Promise<ID> {
  const name = cleanText(input.name, 100);
  if (!name) throw new ValidationError('Informe o nome');
  const segment = await db.segments.get(input.segmentId);
  if (!segment) throw new ValidationError('Escolha o tipo de lugar');
  const now = nowISO();
  const prev = id ? await db.stores.get(id) : undefined;
  if (prev && prev.segmentId !== segment.id) {
    const prevSeg = await db.segments.get(prev.segmentId);
    const hasFuel = (await db.fuelPrices.where('stationId').equals(id!).count()) > 0;
    const hasItems = (await db.prices.where('storeId').equals(id!).count()) + (await db.purchases.where('storeId').equals(id!).count()) > 0;
    if ((prevSeg?.mode === 'fuel' && hasFuel && segment.mode !== 'fuel') || (prevSeg?.mode !== 'fuel' && hasItems && segment.mode === 'fuel')) {
      throw new ValidationError('Este lugar já tem preços registrados; não dá para trocar entre combustível e produtos.');
    }
  }
  const place: Place = validate(placeSchema, {
    id: id ?? newId(),
    segmentId: segment.id,
    name,
    address: cleanText(input.address, 200),
    neighborhood: cleanText(input.neighborhood, 80),
    city: cleanText(input.city, 80),
    flag: segment.mode === 'fuel' ? cleanText(input.flag, 60) : undefined,
    cnpj: input.cnpj ?? prev?.cnpj,
    notes: cleanText(input.notes, 1000),
    color: input.color,
    active: input.active,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.stores.put(place);
  if (!id) await logActivity(segment.mode === 'fuel' ? 'station' : 'store', `${segment.name}: ${place.name}`, place.id);
  return place.id;
}

/** Exclui o lugar e seus preços. Bloqueado se houver compras registradas nele. */
export async function deletePlace(id: ID): Promise<void> {
  const purchases = await db.purchases.where('storeId').equals(id).count();
  if (purchases > 0) throw new ValidationError('Há compras registradas neste lugar. Marque como inativo em vez de excluir.');
  await db.transaction('rw', [db.stores, db.prices, db.fuelPrices, db.receiptLinks], async () => {
    await db.receiptLinks.where('placeId').equals(id).delete();
    await db.prices.where('storeId').equals(id).delete();
    await db.fuelPrices.where('stationId').equals(id).delete();
    await db.stores.delete(id);
  });
}

export interface SegmentInput {
  name: string;
  icon: string;
  color: string;
}

/** Cria ou edita um segmento. Segmentos criados pelo usuário são sempre do modo "itens". */
export async function saveSegment(input: SegmentInput, id?: ID): Promise<ID> {
  const name = cleanText(input.name, 40);
  if (!name) throw new ValidationError('Dê um nome ao tipo de lugar');
  const all = await db.segments.toArray();
  if (all.some((s) => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) throw new ValidationError('Já existe um tipo com esse nome');
  const now = nowISO();
  const prev = id ? all.find((s) => s.id === id) : undefined;
  const segment: Segment = validate(segmentSchema, {
    id: id ?? newId(),
    name,
    icon: input.icon,
    color: input.color,
    mode: prev?.mode ?? 'items',
    builtin: prev?.builtin ?? false,
    order: prev?.order ?? Math.max(-1, ...all.map((s) => s.order)) + 1,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.segments.put(segment);
  if (!id) await logActivity('segment', `Novo tipo de lugar: ${name}`, segment.id);
  return segment.id;
}

export async function deleteSegment(id: ID): Promise<void> {
  const seg = await db.segments.get(id);
  if (!seg) return;
  if (seg.builtin) throw new ValidationError('Os tipos que vêm com o app podem ser renomeados, mas não excluídos.');
  const places = await db.stores.where('segmentId').equals(id).count();
  if (places > 0) throw new ValidationError(`Há ${places} lugar(es) deste tipo. Mude o tipo deles ou exclua-os antes.`);
  await db.transaction('rw', [db.segments, db.categories, db.products], async () => {
    await db.categories.where('segmentId').equals(id).modify({ segmentId: undefined });
    await db.products.where('segmentId').equals(id).modify({ segmentId: undefined });
    await db.segments.delete(id);
  });
}
