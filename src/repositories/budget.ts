import { db } from '@/db/database';
import type { ID } from '@/types';
import { newId } from '@/utils/id';
import { categoryBudgetSchema } from '@/services/schemas';
import { validate } from './errors';

export async function setCategoryLimit(categoryId: ID, limit: number): Promise<void> {
  const existing = await db.categoryBudgets.where('categoryId').equals(categoryId).first();
  if (!(limit > 0)) {
    if (existing) await db.categoryBudgets.delete(existing.id);
    return;
  }
  await db.categoryBudgets.put(validate(categoryBudgetSchema, { id: existing?.id ?? newId(), categoryId, limit }));
}
