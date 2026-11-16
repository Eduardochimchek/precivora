import { db, SCHEMA_VERSION } from '@/db/database';
import { analyzeBackup, applyBackup, exportBackup, wipeAllData } from '@/services/backup';
import { saveProduct } from '@/repositories/catalog';
import { savePlace } from '@/repositories/places';
import { SEG_MERCADO } from '@/db/defaults';
import { savePrice } from '@/repositories/prices';
import { savePurchase } from '@/repositories/purchases';
import { saveReview } from '@/repositories/reviews';
import { resetDb } from './db-helpers';

beforeEach(resetDb);

async function seed() {
  await db.categories.add({ id: 'cat1', name: 'Mercearia', color: '#D97706', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
  const s = await savePlace({ segmentId: SEG_MERCADO, name: 'Mercado A', color: '#2a78d6', active: true });
  const p = await saveProduct({ name: 'Arroz', brandName: 'Tio João', categoryId: 'cat1', unit: 'kg', packageSize: 5 });
  await savePrice({ productId: p, storeId: s, price: 25.9, date: '2026-11-01T12:00:00Z' });
  await savePurchase({ storeId: s, date: '2026-11-02T12:00:00Z', items: [{ productId: p, quantity: 1, unitPrice: 24.9 }] });
  await saveReview({ targetType: 'product', targetId: p, overall: 4, favorite: true, avoid: false });
  await db.settings.put({ key: 'userName', value: 'Teste' });
  return { s, p };
}

const counts = async () => Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.count()])));

describe('backup', () => {
  it('mesclar traz configurações ausentes e mantém as já definidas (resumo = gravação)', async () => {
    await seed();
    const b = await exportBackup();
    b.data.settings = [
      { key: 'userName', value: 'Outro' },
      { key: 'monthlyBudget', value: 900 },
    ];
    const a = await analyzeBackup(JSON.stringify(b), 'merge');
    expect(a.tables.find((t) => t.table === 'settings')).toMatchObject({ incoming: 2, duplicates: 1, added: 1 });
    await applyBackup(a, 'merge');
    expect((await db.settings.get('userName'))?.value).toBe('Teste');
    expect((await db.settings.get('monthlyBudget'))?.value).toBe(900);
  });

  it('mesclar o próprio backup não adiciona nada', async () => {
    await seed();
    const text = JSON.stringify(await exportBackup());
    const a = await analyzeBackup(text, 'merge');
    expect(a.ok).toBe(true);
    expect(a.tables.every((t) => t.added === 0)).toBe(true);
    const before = await counts();
    await applyBackup(a, 'merge');
    const after = await counts();
    expect({ ...after, activities: 0 }).toEqual({ ...before, activities: 0 });
  });

  it('substituir restaura os dados idênticos depois de apagar tudo', async () => {
    await seed();
    const b = await exportBackup();
    const snapshot = JSON.parse(JSON.stringify(b.data));
    await wipeAllData();
    expect(await db.products.count()).toBe(0);
    const a = await analyzeBackup(JSON.stringify(b), 'replace');
    expect(a.ok).toBe(true);
    await applyBackup(a, 'replace');
    for (const t of ['products', 'brands', 'stores', 'prices', 'purchases', 'purchaseItems', 'reviews', 'categories', 'settings'] as const) {
      const rows = await db.table(t).toArray();
      expect(rows).toHaveLength(snapshot[t].length);
      expect(rows).toEqual(expect.arrayContaining(snapshot[t]));
    }
  });

  it('rejeita arquivo que não é JSON, de outro app ou de versão futura', async () => {
    expect((await analyzeBackup('{oops', 'merge')).errors[0]).toMatch(/JSON válido/);
    expect((await analyzeBackup(JSON.stringify({ app: 'outro', data: {} }), 'merge')).errors[0]).toMatch(/não é um backup/);
    const future = { app: 'precivora', format: 1, schemaVersion: SCHEMA_VERSION + 1, exportedAt: '', data: {} };
    const r = await analyzeBackup(JSON.stringify(future), 'merge');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/versão mais nova/);
  });

  it('rejeita registro inválido, referência quebrada e id repetido', async () => {
    await seed();
    const b = await exportBackup();

    const bad = structuredClone(b);
    (bad.data.prices![0] as { price: number }).price = -5;
    expect((await analyzeBackup(JSON.stringify(bad), 'replace')).ok).toBe(false);

    const broken = structuredClone(b);
    (broken.data.prices![0] as { productId: string }).productId = 'nao-existe';
    const r = await analyzeBackup(JSON.stringify(broken), 'replace');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/referência a registro inexistente/);

    const dup = structuredClone(b);
    dup.data.stores!.push(dup.data.stores![0]);
    const d = await analyzeBackup(JSON.stringify(dup), 'replace');
    expect(d.ok).toBe(false);
    expect(d.errors.join(' ')).toMatch(/identificador repetido/);
  });

  it('migra backup do esquema 1 (sem nameKey)', async () => {
    await seed();
    const b = await exportBackup();
    b.schemaVersion = 1;
    for (const p of b.data.products as { nameKey?: string }[]) delete p.nameKey;
    for (const p of b.data.brands as { nameKey?: string }[]) delete p.nameKey;
    await wipeAllData();
    const a = await analyzeBackup(JSON.stringify(b), 'replace');
    expect(a.ok).toBe(true);
    await applyBackup(a, 'replace');
    expect((await db.products.toArray())[0].nameKey).toBe('arroz');
    expect((await db.brands.toArray())[0].nameKey).toBe('tio joao');
  });

  it('mescla reaproveitando marca de mesmo nome e remapeando o produto', async () => {
    await saveProduct({ name: 'Feijão', brandName: 'Tio João', unit: 'kg', packageSize: 1 });
    const existingBrand = (await db.brands.toArray())[0];
    const now = '2026-11-01T12:00:00.000Z';
    const backup = {
      app: 'precivora',
      format: 1,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now,
      data: {
        brands: [{ id: 'outra-id', name: 'TIO JOAO', nameKey: 'tio joao', createdAt: now, updatedAt: now }],
        products: [{ id: 'p-novo', name: 'Arroz', nameKey: 'arroz', brandId: 'outra-id', unit: 'kg', packageSize: 5, archived: false, createdAt: now, updatedAt: now }],
        reviews: [{ id: 'rv', targetType: 'brand', targetId: 'outra-id', overall: 5, favorite: false, avoid: false, date: now, createdAt: now, updatedAt: now }],
      },
    };
    const a = await analyzeBackup(JSON.stringify(backup), 'merge');
    expect(a.ok).toBe(true);
    expect(a.tables.find((t) => t.table === 'brands')!.duplicates).toBe(1);
    await applyBackup(a, 'merge');
    expect(await db.brands.count()).toBe(1);
    expect((await db.products.get('p-novo'))!.brandId).toBe(existingBrand.id);
    expect((await db.reviews.get('rv'))!.targetId).toBe(existingBrand.id);
  });
});
