import Dexie from 'dexie';
import { DEFAULT_CATEGORIES, PrecivoraDB, SCHEMA_VERSION } from '@/db/database';
import { SEG_COMBUSTIVEL, SEG_MERCADO } from '@/db/defaults';

describe('migração do banco', () => {
  it('v1 → v3: nameKey, tipos de lugar, postos viram lugares e categorias da farmácia', async () => {
    const name = 'precivora-mig-test';
    await Dexie.delete(name);
    const v1 = new Dexie(name);
    v1.version(1).stores({
      categories: 'id, name',
      brands: 'id, name',
      products: 'id, name, brandId, categoryId, barcode',
      stores: 'id, name',
      stations: 'id, name',
      prices: 'id, productId, storeId, date, purchaseId, [productId+date]',
      fuelPrices: 'id, stationId, fuel, date, [fuel+date]',
      reviews: 'id, targetId, [targetType+targetId]',
      purchases: 'id, storeId, date',
      purchaseItems: 'id, purchaseId, productId',
      lists: 'id, updatedAt',
      listItems: 'id, listId, productId',
      categoryBudgets: 'id, &categoryId',
      activities: 'id, createdAt',
      settings: 'key',
    });
    await v1.open();
    const now = '2026-01-01T00:00:00Z';
    await v1.table('categories').add({ id: 'c1', name: 'Mercearia', color: '#D97706', createdAt: now, updatedAt: now });
    await v1.table('products').add({ id: 'p1', name: 'Feijão Carioca', unit: 'kg', packageSize: 1, archived: false, createdAt: now, updatedAt: now });
    await v1.table('brands').add({ id: 'b1', name: 'Camil', createdAt: now, updatedAt: now });
    await v1.table('stores').add({ id: 's1', name: 'Mercado A', color: '#2a78d6', active: true, createdAt: now, updatedAt: now });
    await v1.table('stations').add({ id: 'st1', name: 'Posto B', flag: 'Bandeira branca', color: '#eda100', active: true, createdAt: now, updatedAt: now });
    await v1.table('fuelPrices').add({ id: 'f1', stationId: 'st1', fuel: 'etanol', price: 4.19, date: now, promo: false, createdAt: now, updatedAt: now });
    v1.close();

    const v2 = new PrecivoraDB(name);
    await v2.open();
    expect(v2.verno).toBe(SCHEMA_VERSION);
    expect((await v2.products.get('p1'))!.nameKey).toBe('feijao carioca');
    expect((await v2.brands.get('b1'))!.nameKey).toBe('camil');
    expect((await v2.segments.toArray()).map((s) => s.id).sort()).toEqual(['seg-combustivel', 'seg-farmacia', 'seg-mercado']);
    expect((await v2.stores.get('s1'))!.segmentId).toBe(SEG_MERCADO);
    const posto = (await v2.stores.get('st1'))!;
    expect(posto.segmentId).toBe(SEG_COMBUSTIVEL);
    expect(posto.flag).toBe('Bandeira branca');
    expect((await v2.fuelPrices.get('f1'))!.stationId).toBe('st1');
    expect(v2.tables.map((t) => t.name)).not.toContain('stations');
    expect((await v2.categories.get('c1'))!.segmentId).toBe(SEG_MERCADO);
    // só as categorias novas da farmácia são acrescentadas; as de mercado que o usuário apagou não voltam
    expect(await v2.categories.count()).toBe(1 + DEFAULT_CATEGORIES.filter(([, , seg]) => seg === 'seg-farmacia').length);
    expect(await v2.products.where('nameKey').equals('feijao carioca').count()).toBe(1);
    v2.close();
    await Dexie.delete(name);
  });

  it('banco novo é criado com as categorias padrão', async () => {
    const name = 'precivora-fresh-test';
    await Dexie.delete(name);
    const fresh = new PrecivoraDB(name);
    await fresh.open();
    expect(await fresh.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await fresh.segments.count()).toBe(3);
    fresh.close();
    await Dexie.delete(name);
  });
});
