import Dexie from 'dexie';
import { DEFAULT_CATEGORIES, PrecivoraDB } from '@/db/database';

describe('migração do banco', () => {
  it('v1 → v2 preenche nameKey sem duplicar categorias padrão', async () => {
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
    v1.close();

    const v2 = new PrecivoraDB(name);
    await v2.open();
    expect(v2.verno).toBe(2);
    expect((await v2.products.get('p1'))!.nameKey).toBe('feijao carioca');
    expect((await v2.brands.get('b1'))!.nameKey).toBe('camil');
    expect(await v2.categories.count()).toBe(1);
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
    fresh.close();
    await Dexie.delete(name);
  });
});
