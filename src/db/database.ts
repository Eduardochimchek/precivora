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
  SettingRow,
  ShoppingList,
  Station,
  Store,
} from '@/types';
import { searchKey } from '@/utils/text';
import { newId } from '@/utils/id';

export const DB_NAME = 'precivora';
/** Versão do esquema. Ao mudar, adicione um novo `this.version(n)` com `upgrade` e atualize o backup. */
export const SCHEMA_VERSION = 2;

export class PrecivoraDB extends Dexie {
  categories!: EntityTable<Category, 'id'>;
  brands!: EntityTable<Brand, 'id'>;
  products!: EntityTable<Product, 'id'>;
  stores!: EntityTable<Store, 'id'>;
  stations!: EntityTable<Station, 'id'>;
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

    this.on('populate', (tx) => {
      const now = new Date().toISOString();
      tx.table('categories').bulkAdd(
        DEFAULT_CATEGORIES.map(([name, color]) => ({ id: newId(), name, color, createdAt: now, updatedAt: now })),
      );
    });
  }
}

/** Categorias iniciais (dados de referência, editáveis pelo usuário). */
export const DEFAULT_CATEGORIES: [string, string][] = [
  ['Mercearia', '#D97706'],
  ['Hortifrúti', '#16A34A'],
  ['Carnes e peixes', '#DC2626'],
  ['Laticínios e frios', '#0EA5E9'],
  ['Padaria', '#A16207'],
  ['Bebidas', '#7C3AED'],
  ['Limpeza', '#0891B2'],
  ['Higiene e beleza', '#DB2777'],
  ['Bebê', '#F59E0B'],
  ['Pet', '#65A30D'],
  ['Utilidades', '#475569'],
];

export const db = new PrecivoraDB();

export const ALL_TABLES = [
  'categories',
  'brands',
  'products',
  'stores',
  'stations',
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
