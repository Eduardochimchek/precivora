import { ALL_TABLES, db } from '@/db/database';

export async function resetDb() {
  if (!db.isOpen()) await db.open();
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear();
  });
}
