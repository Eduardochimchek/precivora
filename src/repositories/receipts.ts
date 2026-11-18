import { db } from '@/db/database';
import { SEG_COMBUSTIVEL, SEG_MERCADO } from '@/db/defaults';
import type { FuelType, ID, ReceiptLink, Unit } from '@/types';
import { descriptionKey, fuelFromDescription, guessPackage, prettyItemName, type Receipt, type ReceiptItem } from '@/services/nfce';
import { receiptLinkSchema } from '@/services/schemas';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { searchKey } from '@/utils/text';
import { bestMatch, STRONG_MATCH, WEAK_MATCH, type MatchCandidate } from '@/services/productMatch';
import { validate, ValidationError } from './errors';
import { savePlace } from './places';
import { saveProduct } from './catalog';
import { savePurchase } from './purchases';
import { saveFuelPrice } from './prices';

export type ItemDecision =
  | { action: 'link'; productId: ID }
  | { action: 'new'; name: string; unit: Unit; packageSize: number }
  | { action: 'fuel'; fuel: FuelType }
  | { action: 'skip' };

export interface DraftItem {
  item: ReceiptItem;
  linkKey: string;
  /** Sugestão para lugar de produtos (vínculo, nome igual ou produto novo). */
  decision: ItemDecision;
  /** Como o produto foi reconhecido: vínculo salvo neste lugar, nome igual ou descrição parecida. */
  matchedBy?: 'link' | 'name' | 'similar';
  /** Produto parecido sugerido quando a semelhança não basta para ligar sozinho. */
  similar?: { productId: ID; score: number };
  fuel?: FuelType;
}

export interface ReceiptDraft {
  receipt: Receipt;
  /** Lugar já cadastrado com o mesmo CNPJ. */
  placeId?: ID;
  suggestedSegmentId: ID;
  /** A nota parece ser de posto (lugar de combustível ou todos os itens são combustível). */
  fuelPlace: boolean;
  alreadyImported: boolean;
  items: DraftItem[];
}

/** Decisões para lugar de combustível: cada item vira o combustível reconhecido ou é ignorado. */
export const fuelDecisions = (draft: ReceiptDraft): ItemDecision[] => draft.items.map((i) => (i.fuel ? { action: 'fuel', fuel: i.fuel } : { action: 'skip' }));

export const linkKeyOf = (item: Pick<ReceiptItem, 'code' | 'description'>) => (item.code ? `c:${item.code}` : `d:${descriptionKey(item.description)}`);

export async function isReceiptImported(key?: string): Promise<boolean> {
  if (!key) return false;
  const purchases = await db.purchases.where('receiptKey').equals(key).count();
  if (purchases) return true;
  return (await db.fuelPrices.filter((f) => f.receiptKey === key).count()) > 0;
}

/** Textos de cada produto ativo para a busca por semelhança: nome com marca e descrições de notas já ligadas. */
async function matchCandidates(): Promise<MatchCandidate[]> {
  const [products, brands, links] = await Promise.all([db.products.toArray(), db.brands.toArray(), db.receiptLinks.toArray()]);
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const byProduct = new Map<ID, string[]>();
  for (const l of links) byProduct.set(l.productId, [...(byProduct.get(l.productId) ?? []), l.description]);
  return products
    .filter((p) => !p.archived)
    .map((p) => {
      const sized = p.unit === 'kg' || p.unit === 'g' || p.unit === 'L' || p.unit === 'ml' ? ` ${p.packageSize}${p.unit}` : '';
      const brand = p.brandId ? brandName.get(p.brandId) : undefined;
      return { id: p.id, texts: [`${p.name} ${brand ?? ''}${p.name.match(/\d\s*(kg|g|l|ml)\b/i) ? '' : sized}`, ...(byProduct.get(p.id) ?? [])] };
    });
}

/** Monta a proposta de importação: reconhece o lugar pelo CNPJ e os produtos pelos vínculos já feitos. */
export async function draftFromReceipt(receipt: Receipt): Promise<ReceiptDraft> {
  const place = receipt.store.cnpj ? await db.stores.where('cnpj').equals(receipt.store.cnpj).first() : undefined;
  const fuels = receipt.items.map((i) => fuelFromDescription(i.description));
  const allFuel = fuels.every(Boolean);
  const segment = place ? await db.segments.get(place.segmentId) : undefined;
  const fuelPlace = segment ? segment.mode === 'fuel' : allFuel;

  const candidates = await matchCandidates();
  const items: DraftItem[] = [];
  for (const [idx, item] of receipt.items.entries()) {
    const linkKey = linkKeyOf(item);
    const fuel = fuels[idx];
    let decision: ItemDecision | undefined;
    let matchedBy: DraftItem['matchedBy'];
    if (place) {
      const link = await db.receiptLinks.where('[placeId+key]').equals([place.id, linkKey]).first();
      if (link && (await db.products.get(link.productId))) {
        decision = { action: 'link', productId: link.productId };
        matchedBy = 'link';
      }
    }
    if (!decision) {
      const byName = await db.products.where('nameKey').equals(searchKey(prettyItemName(item.description))).first();
      if (byName && !byName.archived) {
        decision = { action: 'link', productId: byName.id };
        matchedBy = 'name';
      }
    }
    let similar: DraftItem['similar'];
    if (!decision && !fuel) {
      const m = bestMatch(item.description, candidates);
      if (m && m.score >= STRONG_MATCH) {
        decision = { action: 'link', productId: m.id };
        matchedBy = 'similar';
      } else if (m && m.score >= WEAK_MATCH) similar = { productId: m.id, score: m.score };
    }
    items.push({ item, linkKey, matchedBy, similar, fuel, decision: decision ?? { action: 'new', name: prettyItemName(item.description), ...guessPackage(item) } });
  }

  return {
    receipt,
    placeId: place?.id,
    suggestedSegmentId: place?.segmentId ?? (allFuel ? SEG_COMBUSTIVEL : SEG_MERCADO),
    fuelPlace,
    alreadyImported: await isReceiptImported(receipt.accessKey),
    items,
  };
}

export interface ImportInput {
  receipt: Receipt;
  /** Lugar existente; sem ele, cria um novo com os dados da nota. */
  placeId?: ID;
  newPlace?: { name: string; segmentId: ID; color: string };
  date: string;
  /** Uma decisão por item da nota, na mesma ordem. */
  decisions: ItemDecision[];
}

export interface ImportResult {
  placeId: ID;
  purchaseId?: ID;
  imported: number;
}

/** Grava tudo de uma vez: lugar (se novo), produtos novos, vínculos e a compra (ou os preços de combustível). */
export async function importReceipt(input: ImportInput): Promise<ImportResult> {
  const { receipt, decisions } = input;
  if (decisions.length !== receipt.items.length) throw new ValidationError('Itens da nota não conferem');
  if (await isReceiptImported(receipt.accessKey)) throw new ValidationError('Esta nota já foi importada');
  if (!decisions.some((d) => d.action !== 'skip')) throw new ValidationError('Escolha ao menos um item para importar');

  return db.transaction('rw', db.tables, async () => {
    let placeId = input.placeId;
    if (!placeId) {
      if (!input.newPlace) throw new ValidationError('Escolha o lugar da compra');
      const { store } = receipt;
      placeId = await savePlace({
        segmentId: input.newPlace.segmentId,
        name: input.newPlace.name,
        address: store.address,
        neighborhood: store.neighborhood,
        city: store.city,
        color: input.newPlace.color,
        active: true,
        cnpj: store.cnpj,
      });
    } else if (receipt.store.cnpj) {
      const place = await db.stores.get(placeId);
      if (place && !place.cnpj) await db.stores.update(placeId, { cnpj: receipt.store.cnpj });
    }
    const place = await db.stores.get(placeId);
    const segment = place ? await db.segments.get(place.segmentId) : undefined;
    if (!place || !segment) throw new ValidationError('Lugar não encontrado');

    if (segment.mode === 'fuel') {
      let imported = 0;
      for (const [idx, d] of decisions.entries()) {
        if (d.action !== 'fuel') continue;
        await saveFuelPrice({ stationId: placeId, fuel: d.fuel, price: receipt.items[idx].unitPrice, date: input.date, notes: 'Importado da nota fiscal', receiptKey: receipt.accessKey });
        imported++;
      }
      if (!imported) throw new ValidationError('Escolha o combustível de ao menos um item');
      return { placeId, imported };
    }

    const now = nowISO();
    const lines: { productId: ID; quantity: number; unitPrice: number }[] = [];
    const created = new Map<string, ID>();
    for (const [idx, d] of decisions.entries()) {
      const item = receipt.items[idx];
      let productId: ID;
      if (d.action === 'link') productId = d.productId;
      else if (d.action === 'new') {
        const nameKey = searchKey(d.name);
        const existing = created.get(nameKey) ?? (await db.products.where('nameKey').equals(nameKey).first())?.id;
        productId = existing ?? (await saveProduct({ name: d.name, unit: d.unit, packageSize: d.packageSize, segmentId: segment.id }));
        created.set(nameKey, productId);
      } else continue;
      const key = linkKeyOf(item);
      const prev = await db.receiptLinks.where('[placeId+key]').equals([placeId, key]).first();
      const link: ReceiptLink = validate(receiptLinkSchema, {
        id: prev?.id ?? newId(),
        placeId,
        key,
        description: item.description.slice(0, 200),
        productId,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      });
      await db.receiptLinks.put(link);
      lines.push({ productId, quantity: item.quantity, unitPrice: Math.round(item.unitPrice * 100) / 100 });
    }
    const purchaseId = await savePurchase({
      storeId: placeId,
      date: input.date,
      notes: receipt.number ? `NFC-e nº ${receipt.number}` : 'Importada da nota fiscal',
      receiptKey: receipt.accessKey,
      items: lines,
    });
    return { placeId, purchaseId, imported: lines.length };
  });
}
