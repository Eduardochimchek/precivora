import { ALL_TABLES, db, SCHEMA_VERSION, type TableName } from '@/db/database';
import { tableSchemas } from './schemas';
import { searchKey } from '@/utils/text';
import { builtinSegmentRows, DEFAULT_CATEGORIES, SEG_COMBUSTIVEL, SEG_MERCADO } from '@/db/defaults';
import { logActivity } from '@/repositories/activity';

export const BACKUP_APP = 'precivora';
export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  schemaVersion: number;
  exportedAt: string;
  data: Partial<Record<TableName, unknown[]>>;
}

export type ImportMode = 'merge' | 'replace';

export interface TableSummary {
  table: TableName;
  incoming: number;
  /** Registros que já existem (mesmo id, ou mesmo nome em marcas/categorias, ou avaliação do mesmo item). */
  duplicates: number;
  added: number;
}

export interface BackupAnalysis {
  ok: boolean;
  errors: string[];
  backup?: BackupFile;
  exportedAt?: string;
  schemaVersion?: number;
  tables: TableSummary[];
}

export const TABLE_LABEL: Record<TableName, string> = {
  segments: 'Tipos de lugar',
  categories: 'Categorias',
  brands: 'Marcas',
  products: 'Produtos',
  stores: 'Lugares',
  prices: 'Preços',
  fuelPrices: 'Preços de combustível',
  reviews: 'Avaliações',
  purchases: 'Compras',
  purchaseItems: 'Itens de compras',
  lists: 'Listas',
  listItems: 'Itens de listas',
  categoryBudgets: 'Limites por categoria',
  activities: 'Atividades',
  settings: 'Configurações',
};

export async function exportBackup(): Promise<BackupFile> {
  const data: Partial<Record<TableName, unknown[]>> = {};
  await db.transaction('r', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) data[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `precivora-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/** Migra dados de backups de versões antigas do esquema para a atual. */
function migrate(backup: BackupFile): BackupFile {
  if (backup.schemaVersion < 2) {
    const fix = (rows: unknown[] | undefined) =>
      (rows ?? []).map((r) => {
        const o = r as { name?: string; nameKey?: string };
        return { ...o, nameKey: o.nameKey ?? searchKey(o.name ?? '') };
      });
    backup.data.products = fix(backup.data.products);
    backup.data.brands = fix(backup.data.brands);
  }
  if (backup.schemaVersion < 3) {
    const data = backup.data as Record<string, unknown[] | undefined>;
    const stores = (data.stores ?? []).map((r) => ({ segmentId: SEG_MERCADO, ...(r as object) }));
    const stations = (data.stations ?? []).map((r) => ({ ...(r as object), segmentId: SEG_COMBUSTIVEL }));
    data.stores = [...stores, ...stations];
    delete data.stations;
    data.segments = builtinSegmentRows(backup.exportedAt ?? new Date().toISOString());
    const segOf = new Map(DEFAULT_CATEGORIES.map(([n, , seg]) => [n, seg]));
    data.categories = (data.categories ?? []).map((r) => {
      const c = r as { name?: string; segmentId?: string };
      const seg = c.name ? segOf.get(c.name) : undefined;
      return seg && !c.segmentId ? { ...c, segmentId: seg } : c;
    });
  }
  backup.schemaVersion = SCHEMA_VERSION;
  return backup;
}

const pk = (t: TableName) => (t === 'settings' ? 'key' : 'id');

/** Lê e valida o arquivo. Nada é gravado aqui. */
export async function analyzeBackup(text: string, mode: ImportMode): Promise<BackupAnalysis> {
  const errors: string[] = [];
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, errors: ['Arquivo grande demais (limite de 50 MB).'], tables: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['O arquivo não é um JSON válido.'], tables: [] };
  }
  const b = raw as Partial<BackupFile>;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || typeof b.data !== 'object' || !b.data) {
    return { ok: false, errors: ['Este arquivo não é um backup do Precivora.'], tables: [] };
  }
  if (b.format !== BACKUP_FORMAT || typeof b.schemaVersion !== 'number') {
    return { ok: false, errors: ['Formato de backup desconhecido.'], tables: [] };
  }
  if (b.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Backup criado por uma versão mais nova do Precivora (esquema ${b.schemaVersion}). Atualize o app antes de importar.`],
      tables: [],
    };
  }
  const backup = migrate(structuredClone(b as BackupFile));

  for (const t of ALL_TABLES) {
    const rows = backup.data[t];
    if (rows == null) continue;
    if (!Array.isArray(rows)) {
      errors.push(`${TABLE_LABEL[t]}: estrutura inválida.`);
      continue;
    }
    const schema = tableSchemas[t];
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      const r = schema.safeParse(row);
      if (!r.success) {
        if (errors.length < 8) errors.push(`${TABLE_LABEL[t]} #${i + 1}: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
        else if (errors.length === 8) errors.push('…e outros registros inválidos.');
        return;
      }
      const key = String((row as Record<string, unknown>)[pk(t)]);
      if (seen.has(key)) errors.push(`${TABLE_LABEL[t]}: identificador repetido (${key.slice(0, 8)}).`);
      seen.add(key);
    });
  }
  if (errors.length) return { ok: false, errors, tables: [] };

  // Integridade referencial (considerando o que já existe quando for mesclar)
  const ids = async (t: TableName) => {
    const set = new Set(((backup.data[t] ?? []) as { id: string }[]).map((r) => r.id));
    if (mode === 'merge') for (const k of await db.table(t).toCollection().primaryKeys()) set.add(String(k));
    return set;
  };
  const [products, stores, purchases, lists, brands, categories, segments] = await Promise.all(
    (['products', 'stores', 'purchases', 'lists', 'brands', 'categories', 'segments'] as TableName[]).map(ids),
  );
  const refCheck = (t: TableName, field: string, set: Set<string>, optional = false) => {
    for (const r of (backup.data[t] ?? []) as Record<string, string>[]) {
      const v = r[field];
      if (v == null && optional) continue;
      if (!set.has(v)) {
        errors.push(`${TABLE_LABEL[t]}: referência a registro inexistente (${field}).`);
        return;
      }
    }
  };
  refCheck('prices', 'productId', products);
  refCheck('prices', 'storeId', stores);
  refCheck('fuelPrices', 'stationId', stores);
  refCheck('stores', 'segmentId', segments);
  refCheck('categories', 'segmentId', segments, true);
  refCheck('products', 'segmentId', segments, true);
  refCheck('purchases', 'storeId', stores);
  refCheck('purchaseItems', 'purchaseId', purchases);
  refCheck('purchaseItems', 'productId', products);
  refCheck('listItems', 'listId', lists);
  refCheck('listItems', 'productId', products);
  refCheck('products', 'brandId', brands, true);
  refCheck('products', 'categoryId', categories, true);
  refCheck('categoryBudgets', 'categoryId', categories);
  if (errors.length) return { ok: false, errors, tables: [] };

  const tables: TableSummary[] = [];
  for (const t of ALL_TABLES) {
    const rows = (backup.data[t] ?? []) as Record<string, unknown>[];
    if (!rows.length) continue;
    let duplicates = 0;
    if (mode === 'merge') {
      const existing = new Set((await db.table(t).toCollection().primaryKeys()).map(String));
      const dupNames = t === 'brands' || t === 'categories' || t === 'segments' ? await namesOf(t) : null;
      const reviewTargets = t === 'reviews' ? new Set((await db.reviews.toArray()).map((r) => `${r.targetType}:${r.targetId}`)) : null;
      for (const r of rows) {
        const isDup =
          existing.has(String(r[pk(t)])) ||
          (dupNames && dupNames.has(searchKey(String(r.name)))) ||
          (reviewTargets && reviewTargets.has(`${r.targetType}:${r.targetId}`));
        if (isDup) duplicates++;
      }
    }
    tables.push({ table: t, incoming: rows.length, duplicates, added: rows.length - duplicates });
  }
  return { ok: true, errors: [], backup, exportedAt: backup.exportedAt, schemaVersion: b.schemaVersion, tables };
}

async function namesOf(t: 'brands' | 'categories' | 'segments'): Promise<Set<string>> {
  const rows = (await db.table(t).toArray()) as { name: string }[];
  return new Set(rows.map((r) => searchKey(r.name)));
}

/**
 * Grava um backup já validado. "replace" apaga tudo antes; "merge" só acrescenta o que não existe,
 * reaproveitando marcas e categorias com o mesmo nome (configurações já definidas no aparelho são mantidas).
 */
export async function applyBackup(analysis: BackupAnalysis, mode: ImportMode): Promise<number> {
  if (!analysis.ok || !analysis.backup) throw new Error('Backup não validado');
  const data = structuredClone(analysis.backup.data);
  let written = 0;
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    if (mode === 'replace') {
      for (const t of ALL_TABLES) await db.table(t).clear();
      for (const t of ALL_TABLES) {
        const rows = data[t] ?? [];
        if (rows.length) await db.table(t).bulkAdd(rows);
        written += rows.length;
      }
      return;
    }

    // merge: mapeia marcas/categorias de mesmo nome para os ids existentes
    const remap = { brands: new Map<string, string>(), categories: new Map<string, string>(), segments: new Map<string, string>() };
    for (const t of ['brands', 'categories', 'segments'] as const) {
      const existing = new Map(((await db.table(t).toArray()) as { id: string; name: string }[]).map((r) => [searchKey(r.name), r.id]));
      for (const r of (data[t] ?? []) as { id: string; name: string }[]) {
        const match = existing.get(searchKey(r.name));
        if (match && match !== r.id) remap[t].set(r.id, match);
      }
    }
    for (const p of (data.products ?? []) as { brandId?: string; categoryId?: string; segmentId?: string }[]) {
      if (p.brandId && remap.brands.has(p.brandId)) p.brandId = remap.brands.get(p.brandId);
      if (p.categoryId && remap.categories.has(p.categoryId)) p.categoryId = remap.categories.get(p.categoryId);
      if (p.segmentId && remap.segments.has(p.segmentId)) p.segmentId = remap.segments.get(p.segmentId);
    }
    for (const r of [...((data.stores ?? []) as { segmentId?: string }[]), ...((data.categories ?? []) as { segmentId?: string }[])]) {
      if (r.segmentId && remap.segments.has(r.segmentId)) r.segmentId = remap.segments.get(r.segmentId);
    }
    for (const r of (data.reviews ?? []) as { targetType: string; targetId: string }[]) {
      if (r.targetType === 'brand' && remap.brands.has(r.targetId)) r.targetId = remap.brands.get(r.targetId)!;
    }
    for (const c of (data.categoryBudgets ?? []) as { categoryId: string }[]) {
      if (remap.categories.has(c.categoryId)) c.categoryId = remap.categories.get(c.categoryId)!;
    }
    data.brands = ((data.brands ?? []) as { id: string }[]).filter((r) => !remap.brands.has(r.id));
    data.categories = ((data.categories ?? []) as { id: string }[]).filter((r) => !remap.categories.has(r.id));
    data.segments = ((data.segments ?? []) as { id: string }[]).filter((r) => !remap.segments.has(r.id));

    const reviewTargets = new Set((await db.reviews.toArray()).map((r) => `${r.targetType}:${r.targetId}`));
    const budgetCats = new Set((await db.categoryBudgets.toArray()).map((b) => b.categoryId));

    for (const t of ALL_TABLES) {
      const rows = (data[t] ?? []) as Record<string, unknown>[];
      if (!rows.length) continue;
      const existing = new Set((await db.table(t).toCollection().primaryKeys()).map(String));
      const fresh = rows.filter((r) => {
        if (existing.has(String(r[pk(t)]))) return false;
        if (t === 'reviews') return !reviewTargets.has(`${r.targetType}:${r.targetId}`);
        if (t === 'categoryBudgets') return !budgetCats.has(String(r.categoryId));
        return true;
      });
      if (fresh.length) await db.table(t).bulkAdd(fresh);
      written += fresh.length;
    }
  });
  await logActivity('backup', mode === 'replace' ? 'Backup restaurado (substituição)' : `Backup mesclado: ${written} registros`);
  return written;
}

export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}
