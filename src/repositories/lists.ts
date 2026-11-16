import { db } from '@/db/database';
import type { ID, ListItem, Priority } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText } from '@/utils/text';
import { listItemSchema, listSchema } from '@/services/schemas';
import { validate, ValidationError } from './errors';
import { logActivity } from './activity';

export async function createList(name: string): Promise<ID> {
  const clean = cleanText(name, 80);
  if (!clean) throw new ValidationError('Dê um nome para a lista');
  const now = nowISO();
  const list = validate(listSchema, { id: newId(), name: clean, archived: false, createdAt: now, updatedAt: now });
  await db.lists.add(list);
  await logActivity('list', `Lista criada: ${clean}`, list.id);
  return list.id;
}

export async function renameList(id: ID, name: string): Promise<void> {
  const clean = cleanText(name, 80);
  if (!clean) throw new ValidationError('Dê um nome para a lista');
  await db.lists.update(id, { name: clean, updatedAt: nowISO() });
}

export async function setListArchived(id: ID, archived: boolean): Promise<void> {
  await db.lists.update(id, { archived, updatedAt: nowISO() });
}

export async function duplicateList(id: ID): Promise<ID> {
  const list = await db.lists.get(id);
  if (!list) throw new ValidationError('Lista não encontrada');
  const items = await db.listItems.where('listId').equals(id).toArray();
  const newListId = await createList(`${list.name} (cópia)`.slice(0, 80));
  const now = nowISO();
  await db.listItems.bulkAdd(items.map((i) => ({ ...i, id: newId(), listId: newListId, checked: false, createdAt: now, updatedAt: now })));
  return newListId;
}

export async function deleteList(id: ID): Promise<void> {
  await db.transaction('rw', [db.lists, db.listItems], async () => {
    await db.listItems.where('listId').equals(id).delete();
    await db.lists.delete(id);
  });
}

export async function addListItem(listId: ID, productId: ID, quantity = 1, priority: Priority = 'media'): Promise<ID> {
  const existing = await db.listItems.where('listId').equals(listId).filter((i) => i.productId === productId).first();
  const now = nowISO();
  if (existing) {
    await db.listItems.update(existing.id, { quantity: existing.quantity + quantity, checked: false, updatedAt: now });
    return existing.id;
  }
  const item: ListItem = validate(listItemSchema, {
    id: newId(),
    listId,
    productId,
    quantity,
    priority,
    checked: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.listItems.add(item);
  await db.lists.update(listId, { updatedAt: now });
  return item.id;
}

export async function updateListItem(id: ID, patch: Partial<Pick<ListItem, 'quantity' | 'priority' | 'checked' | 'notes'>>): Promise<void> {
  if (patch.quantity != null && !(patch.quantity > 0)) throw new ValidationError('Quantidade deve ser maior que zero');
  const now = nowISO();
  const item = await db.listItems.get(id);
  await db.listItems.update(id, { ...patch, notes: patch.notes !== undefined ? cleanText(patch.notes, 300) : item?.notes, updatedAt: now });
  if (item) await db.lists.update(item.listId, { updatedAt: now });
}

export async function removeListItem(id: ID): Promise<void> {
  await db.listItems.delete(id);
}

export async function clearChecked(listId: ID): Promise<number> {
  return db.listItems.where('listId').equals(listId).filter((i) => i.checked).delete();
}
