import { db } from '@/db/database';
import type { ID, Purchase, PurchaseItem } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText } from '@/utils/text';
import { money } from '@/utils/format';
import { purchaseItemSchema, purchaseSchema } from '@/services/schemas';
import { validate, ValidationError } from './errors';
import { logActivity } from './activity';

export interface PurchaseInput {
  storeId: ID;
  date: string;
  notes?: string;
  items: { productId: ID; quantity: number; unitPrice: number }[];
}

export const purchaseTotal = (items: { quantity: number; unitPrice: number }[]) =>
  Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100;

/**
 * Registra (ou substitui) uma compra. Cada item também vira um registro de preço
 * com origem "purchase" — o preço confirmado em compra.
 */
export async function savePurchase(input: PurchaseInput, id?: ID): Promise<ID> {
  if (!input.items.length) throw new ValidationError('Adicione ao menos um produto à compra');
  const now = nowISO();
  const purchaseId = id ?? newId();
  const prev = id ? await db.purchases.get(id) : undefined;
  const purchase: Purchase = validate(purchaseSchema, {
    id: purchaseId,
    storeId: input.storeId,
    date: input.date,
    total: purchaseTotal(input.items),
    notes: cleanText(input.notes, 1000),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  const items: PurchaseItem[] = input.items.map((i) =>
    validate(purchaseItemSchema, { id: newId(), purchaseId, productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice }),
  );
  await db.transaction('rw', [db.purchases, db.purchaseItems, db.prices, db.activities, db.stores], async () => {
    await db.purchaseItems.where('purchaseId').equals(purchaseId).delete();
    await db.prices.where('purchaseId').equals(purchaseId).delete();
    await db.purchases.put(purchase);
    await db.purchaseItems.bulkAdd(items);
    await db.prices.bulkAdd(
      items.map((i) => ({
        id: newId(),
        productId: i.productId,
        storeId: purchase.storeId,
        price: i.unitPrice,
        quantity: 1,
        date: purchase.date,
        promo: false,
        source: 'purchase' as const,
        purchaseId,
        createdAt: now,
        updatedAt: now,
      })),
    );
    if (!id) {
      const store = await db.stores.get(purchase.storeId);
      await logActivity('purchase', `Compra de ${money(purchase.total)} em ${store?.name ?? 'mercado'}`, purchaseId);
    }
  });
  return purchaseId;
}

export async function deletePurchase(id: ID): Promise<void> {
  await db.transaction('rw', [db.purchases, db.purchaseItems, db.prices], async () => {
    await db.purchaseItems.where('purchaseId').equals(id).delete();
    await db.prices.where('purchaseId').equals(id).delete();
    await db.purchases.delete(id);
  });
}
