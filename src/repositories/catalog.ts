import { db } from '@/db/database';
import type { Brand, Category, ID, Product, Unit } from '@/types';
import { newId } from '@/utils/id';
import { nowISO } from '@/utils/date';
import { cleanText, searchKey } from '@/utils/text';
import { brandSchema, categorySchema, productSchema } from '@/services/schemas';
import { validate, ValidationError } from './errors';
import { logActivity } from './activity';

export interface ProductInput {
  name: string;
  brandName?: string;
  brandId?: ID;
  categoryId?: ID;
  subcategory?: string;
  barcode?: string;
  unit: Unit;
  packageSize: number;
  image?: string;
  description?: string;
  notes?: string;
}

/** Encontra a marca pelo nome (sem diferenciar acentos/maiúsculas) ou cria uma nova. */
export async function ensureBrand(name: string): Promise<ID | undefined> {
  const clean = cleanText(name, 80);
  if (!clean) return undefined;
  const key = searchKey(clean);
  const existing = await db.brands.where('nameKey').equals(key).first();
  if (existing) return existing.id;
  const now = nowISO();
  const brand: Brand = validate(brandSchema, { id: newId(), name: clean, nameKey: key, createdAt: now, updatedAt: now });
  await db.brands.add(brand);
  return brand.id;
}

export async function renameBrand(id: ID, name: string): Promise<void> {
  const clean = cleanText(name, 80);
  if (!clean) throw new ValidationError('Informe o nome da marca');
  const key = searchKey(clean);
  const dup = await db.brands.where('nameKey').equals(key).first();
  if (dup && dup.id !== id) throw new ValidationError('Já existe uma marca com esse nome');
  await db.brands.update(id, { name: clean, nameKey: key, updatedAt: nowISO() });
}

export async function deleteBrand(id: ID): Promise<void> {
  await db.transaction('rw', [db.brands, db.products, db.reviews], async () => {
    await db.products.where('brandId').equals(id).modify({ brandId: undefined });
    await db.reviews.where('[targetType+targetId]').equals(['brand', id]).delete();
    await db.brands.delete(id);
  });
}

export async function saveCategory(input: { id?: ID; name: string; color: string }): Promise<ID> {
  const now = nowISO();
  const name = cleanText(input.name, 60);
  if (!name) throw new ValidationError('Informe o nome da categoria');
  if (input.id) {
    await db.categories.update(input.id, { name, color: input.color, updatedAt: now });
    return input.id;
  }
  const c: Category = validate(categorySchema, { id: newId(), name, color: input.color, createdAt: now, updatedAt: now });
  await db.categories.add(c);
  return c.id;
}

export async function deleteCategory(id: ID): Promise<void> {
  await db.transaction('rw', [db.categories, db.products, db.categoryBudgets], async () => {
    await db.products.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.categoryBudgets.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  });
}

export async function saveProduct(input: ProductInput, id?: ID): Promise<ID> {
  const name = cleanText(input.name, 120);
  if (!name) throw new ValidationError('Informe o nome do produto');
  if (!(input.packageSize > 0)) throw new ValidationError('Informe a quantidade da embalagem');
  const barcode = cleanText(input.barcode, 14)?.replace(/\D/g, '') || undefined;
  if (barcode) {
    const dup = await db.products.where('barcode').equals(barcode).first();
    if (dup && dup.id !== id) throw new ValidationError(`Código de barras já usado em "${dup.name}"`);
  }
  const brandId = input.brandId ?? (input.brandName ? await ensureBrand(input.brandName) : undefined);
  const now = nowISO();
  const prev = id ? await db.products.get(id) : undefined;
  const product: Product = validate(productSchema, {
    id: id ?? newId(),
    name,
    nameKey: searchKey(name),
    brandId,
    categoryId: input.categoryId || undefined,
    subcategory: cleanText(input.subcategory, 60),
    barcode,
    unit: input.unit,
    packageSize: input.packageSize,
    image: input.image,
    description: cleanText(input.description, 1000),
    notes: cleanText(input.notes, 1000),
    archived: prev?.archived ?? false,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  });
  await db.products.put(product);
  if (!id) await logActivity('product', `Produto cadastrado: ${name}`, product.id);
  return product.id;
}

export async function setProductArchived(id: ID, archived: boolean): Promise<void> {
  await db.products.update(id, { archived, updatedAt: nowISO() });
}

/** Exclui o produto e tudo o que depende dele (preços, avaliações, itens de lista). Itens de compras passadas são mantidos. */
export async function deleteProduct(id: ID): Promise<void> {
  await db.transaction('rw', [db.products, db.prices, db.reviews, db.listItems, db.purchaseItems], async () => {
    const used = await db.purchaseItems.where('productId').equals(id).count();
    if (used > 0) throw new ValidationError('Este produto aparece em compras registradas. Arquive em vez de excluir.');
    await db.prices.where('productId').equals(id).delete();
    await db.reviews.where('[targetType+targetId]').equals(['product', id]).delete();
    await db.listItems.where('productId').equals(id).delete();
    await db.products.delete(id);
  });
}
