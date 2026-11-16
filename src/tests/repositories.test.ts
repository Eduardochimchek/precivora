import { db } from '@/db/database';
import { deleteProduct, ensureBrand, saveProduct } from '@/repositories/catalog';
import { deleteStore, saveStore } from '@/repositories/places';
import { deletePurchase, savePurchase } from '@/repositories/purchases';
import { addListItem, createList } from '@/repositories/lists';
import { saveReview } from '@/repositories/reviews';
import { logActivity } from '@/repositories/activity';
import { savePrice } from '@/repositories/prices';
import { ValidationError } from '@/repositories/errors';
import { resetDb } from './db-helpers';

const store = () => saveStore({ name: 'Mercado A', color: '#2a78d6', active: true });
const prod = (name = 'Arroz', extra = {}) => saveProduct({ name, unit: 'kg', packageSize: 5, ...extra });

beforeEach(resetDb);

describe('produtos e marcas', () => {
  it('reaproveita a marca ignorando acentos e maiúsculas', async () => {
    const a = await prod('Arroz 1', { brandName: 'Tio João' });
    const b = await prod('Arroz 2', { brandName: '  tio joao ' });
    const [pa, pb] = await Promise.all([db.products.get(a), db.products.get(b)]);
    expect(pa!.brandId).toBe(pb!.brandId);
    expect(await db.brands.count()).toBe(1);
    expect(await ensureBrand('TIO JOÃO')).toBe(pa!.brandId);
    expect(pa!.nameKey).toBe('arroz 1');
  });

  it('rejeita código de barras repetido', async () => {
    await prod('A', { barcode: '7891234567890' });
    await expect(prod('B', { barcode: '7891234567890' })).rejects.toThrow(/Código de barras já usado/);
  });

  it('valida nome e embalagem', async () => {
    await expect(prod('   ')).rejects.toBeInstanceOf(ValidationError);
    await expect(saveProduct({ name: 'X', unit: 'kg', packageSize: 0 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita preço inválido', async () => {
    const s = await store();
    const p = await prod();
    await expect(savePrice({ productId: p, storeId: s, price: -1, date: new Date().toISOString() })).rejects.toBeInstanceOf(ValidationError);
    const ok = await savePrice({ productId: p, storeId: s, price: 10.456, quantity: 0, date: new Date().toISOString() });
    expect(ok.price).toBe(10.46);
    expect(ok.quantity).toBe(1);
  });
});

describe('compras', () => {
  it('cria itens e preços confirmados; editar não duplica', async () => {
    const s = await store();
    const p1 = await prod('Arroz');
    const p2 = await prod('Feijão');
    const id = await savePurchase({
      storeId: s,
      date: '2026-11-10T12:00:00.000Z',
      items: [
        { productId: p1, quantity: 2, unitPrice: 25 },
        { productId: p2, quantity: 1, unitPrice: 8.5 },
      ],
    });
    expect((await db.purchases.get(id))!.total).toBe(58.5);
    expect(await db.purchaseItems.where('purchaseId').equals(id).count()).toBe(2);
    const prices = await db.prices.where('purchaseId').equals(id).toArray();
    expect(prices).toHaveLength(2);
    expect(prices.every((r) => r.source === 'purchase')).toBe(true);

    await savePurchase({ storeId: s, date: '2026-11-10T12:00:00.000Z', items: [{ productId: p1, quantity: 1, unitPrice: 24 }] }, id);
    expect(await db.purchases.count()).toBe(1);
    expect(await db.purchaseItems.count()).toBe(1);
    expect(await db.prices.count()).toBe(1);
    expect((await db.purchases.get(id))!.total).toBe(24);
  });

  it('excluir compra remove os preços dela', async () => {
    const s = await store();
    const p = await prod();
    await savePrice({ productId: p, storeId: s, price: 30, date: new Date().toISOString() });
    const id = await savePurchase({ storeId: s, date: new Date().toISOString(), items: [{ productId: p, quantity: 1, unitPrice: 25 }] });
    await deletePurchase(id);
    expect(await db.purchases.count()).toBe(0);
    expect(await db.purchaseItems.count()).toBe(0);
    expect(await db.prices.count()).toBe(1);
  });

  it('compra vazia é rejeitada', async () => {
    const s = await store();
    await expect(savePurchase({ storeId: s, date: new Date().toISOString(), items: [] })).rejects.toBeInstanceOf(ValidationError);
  });

  it('bloqueia excluir produto e mercado com compras', async () => {
    const s = await store();
    const p = await prod();
    await savePurchase({ storeId: s, date: new Date().toISOString(), items: [{ productId: p, quantity: 1, unitPrice: 25 }] });
    await expect(deleteProduct(p)).rejects.toThrow(/Arquive/);
    await expect(deleteStore(s)).rejects.toThrow(/inativo/);
    expect(await db.products.count()).toBe(1);
  });

  it('exclui produto sem compra junto com dependências', async () => {
    const s = await store();
    const p = await prod();
    await savePrice({ productId: p, storeId: s, price: 30, date: new Date().toISOString() });
    await saveReview({ targetType: 'product', targetId: p, overall: 4, favorite: false, avoid: false });
    const l = await createList('Mês');
    await addListItem(l, p);
    await deleteProduct(p);
    expect(await db.prices.count()).toBe(0);
    expect(await db.reviews.count()).toBe(0);
    expect(await db.listItems.count()).toBe(0);
  });
});

describe('listas, avaliações e atividade', () => {
  it('somar quantidade de produto repetido na lista', async () => {
    const p = await prod();
    const l = await createList('Compra do mês');
    const a = await addListItem(l, p, 2);
    const b = await addListItem(l, p, 3);
    expect(a).toBe(b);
    expect((await db.listItems.get(a))!.quantity).toBe(5);
  });

  it('avaliação é uma por item (upsert)', async () => {
    const p = await prod();
    const r1 = await saveReview({ targetType: 'product', targetId: p, overall: 3, favorite: false, avoid: false });
    const r2 = await saveReview({ targetType: 'product', targetId: p, overall: 5, quality: 4, favorite: true, avoid: false });
    expect(r2.id).toBe(r1.id);
    expect(await db.reviews.count()).toBe(1);
    expect((await db.reviews.get(r1.id))!.overall).toBe(5);
    await expect(saveReview({ targetType: 'product', targetId: p, overall: 0, favorite: false, avoid: false })).rejects.toBeInstanceOf(ValidationError);
  });

  it('favorito e não comprar novamente são exclusivos', async () => {
    const p = await prod();
    const r = await saveReview({ targetType: 'product', targetId: p, overall: 4, favorite: true, avoid: true });
    expect(r.favorite).toBe(true);
    expect(r.avoid).toBe(false);
  });

  it('atividades são limitadas a 300', async () => {
    for (let i = 0; i < 305; i++) await logActivity('price', `item ${i}`);
    expect(await db.activities.count()).toBe(300);
  });
});
