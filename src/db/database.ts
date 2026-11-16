import Dexie, { type EntityTable } from 'dexie';
import type {
  Activity,
  Brand,
  Category,
  CategoryBudget,
  FuelPrice,
  ListItem,
  PriceRecord,
  Product,
  Purchase,
  PurchaseItem,
  Review,
  Segment,
  SettingRow,
  ShoppingList,
  Store,
} from '@/types';
import { searchKey } from '@/utils/text';
import { builtinSegmentRows, defaultCategoryRows, DEFAULT_CATEGORIES, SEG_COMBUSTIVEL, SEG_MERCADO } from './defaults';

export const DB_NAME = 'precivora';
/** Versão do esquema. Ao mudar, adicione um novo `this.version(n)` com `upgrade` e atualize o backup. */
export const SCHEMA_VERSION = 3;

export class PrecivoraDB extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  brands!: EntityTable<Brand, 'id'>;
  products!: EntityTable<Product, 'id'>;
  segments!: EntityTable<Segment, 'id'>;
  /** Todos os lugares (mercados, farmácias, postos...), cada um com seu `segmentId`. */
  stores!: EntityTable<Store, 'id'>;
  prices!: EntityTable<PriceRecord, 'id'>;
  fuelPrices!: EntityTable<FuelPrice, 'id'>;
  reviews!: EntityTable<Review, 'id'>;
  purchases!: EntityTable<Purchase, 'id'>;
  purchaseItems!: EntityTable<PurchaseItem, 'id'>;
  lists!: EntityTable<ShoppingList, 'id'>;
  listItems!: EntityTable<ListItem, 'id'>;
  categoryBudgets!: EntityTable<CategoryBudget, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = DB_NAME) {
    super(name);

    // v1 — esquema inicial
    this.version(1).stores({
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

    // v2 — chave de busca normalizada (sem acentos) para produtos e marcas
    this.version(2)
      .stores({
        brands: 'id, name, nameKey',
        products: 'id, name, nameKey, brandId, categoryId, barcode',
      })
      .upgrade(async (tx) => {
        await tx.table('products').toCollection().modify((p: Product) => {
          p.nameKey = searchKey(p.name);
        });
        await tx.table('brands').toCollection().modify((b: Brand) => {
          b.nameKey = searchKey(b.name);
        });
      });

    // v3 — segmentos (Mercado, Farmácia, Combustível + criados pelo usuário).
    // Postos passam para a tabela de lugares com o segmento Combustível, mantendo os IDs.
    this.version(3)
      .stores({
        segments: 'id, order',
        stores: 'id, name, segmentId',
        categories: 'id, name, segmentId',
        products: 'id, name, nameKey, brandId, categoryId, barcode, segmentId',
        stations: null,
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        await tx.table('segments').bulkPut(builtinSegmentRows(now));
        await tx.table('stores').toCollection().modify((p: Store) => {
          if (!p.segmentId) p.segmentId = SEG_MERCADO;
        });
        const oldStations = await tx.table('stations').toArray();
        if (oldStations.length) await tx.table('stores').bulkPut(oldStations.map((st) => ({ ...st, segmentId: SEG_COMBUSTIVEL })));
        const segOf = new Map(DEFAULT_CATEGORIES.map(([n, , seg]) => [n, seg]));
        const existing = new Set<string>();
        await tx.table('categories').toCollection().modify((c: Category) => {
          existing.add(c.name);
          const seg = segOf.get(c.name);
          if (seg && !c.segmentId) c.segmentId = seg;
        });
        const newOnes = new Set(DEFAULT_CATEGORIES.filter(([n, , seg]) => !existing.has(n) && seg && seg !== SEG_MERCADO).map(([n]) => n));
        if (newOnes.size) await tx.table('categories').bulkAdd(defaultCategoryRows(now, newOnes));
      });

    this.on('populate', (tx) => {
      const now = new Date().toISOString();
      tx.table('segments').bulkAdd(builtinSegmentRows(now));
      tx.table('categories').bulkAdd(defaultCategoryRows(now));
    });
  }
}

export { DEFAULT_CATEGORIES } from './defaults';

export const db = new PrecivoraDB();

export const ALL_TABLES = [
  'segments',
  'categories',
  'brands',
  'products',
  'stores',
  'prices',
  'fuelPrices',
  'reviews',
  'purchases',
  'purchaseItems',
  'lists',
  'listItems',
  'categoryBudgets',
  'activities',
  'settings',
] as const;
export type TableName = (typeof ALL_TABLES)[number];

/** Pede ao navegador armazenamento persistente (reduz o risco de limpeza automática). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
