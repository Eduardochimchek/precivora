import { ALL_TABLES, db } from '@/db/database';
import { builtinSegmentRows } from '@/db/defaults';

/** Zera o banco e recoloca os tipos de lugar padrão (como num app recém-instalado, sem categorias). */
export async function resetDb() {
  if (!db.isOpen()) await db.open();
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
    await db.segments.bulkAdd(builtinSegmentRows('2026-01-01T00:00:00Z'));
  });
}
