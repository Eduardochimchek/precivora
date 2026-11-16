import { db } from '@/db/database';
import type { ActivityKind, ID } from '@/types';
import { newId } from '@/utils/id';

const MAX_ACTIVITIES = 300;

export async function logActivity(kind: ActivityKind, label: string, refId?: ID): Promise<void> {
  await db.activities.add({ id: newId(), kind, label, refId, createdAt: new Date().toISOString() });
  const count = await db.activities.count();
  if (count > MAX_ACTIVITIES) {
    const old = await db.activities.orderBy('createdAt').limit(count - MAX_ACTIVITIES).primaryKeys();
    await db.activities.bulkDelete(old);
  }
}
