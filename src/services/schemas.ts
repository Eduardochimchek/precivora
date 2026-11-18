import { z } from 'zod';
import { FUEL_TYPES, UNITS } from '@/types';

const id = z.string().min(1).max(64);
const iso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');
const text = (max = 500) => z.string().max(max).optional();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const stamps = { createdAt: iso, updatedAt: iso };
const money = z.number().finite().min(0).max(1_000_000);
const rating = z.number().int().min(1).max(5);

export const segmentSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  icon: z.string().min(1).max(30),
  color,
  mode: z.enum(['items', 'fuel']),
  builtin: z.boolean(),
  order: z.number().int().min(0).max(10_000),
  ...stamps,
});
export const categorySchema = z.object({ id, name: z.string().min(1).max(60), color, segmentId: id.optional(), ...stamps });
export const brandSchema = z.object({ id, name: z.string().min(1).max(80), nameKey: z.string().max(80), ...stamps });
export const productSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  nameKey: z.string().max(120),
  segmentId: id.optional(),
  brandId: id.optional(),
  categoryId: id.optional(),
  subcategory: text(60),
  barcode: z.string().regex(/^[0-9]{6,14}$/).optional(),
  unit: z.enum(UNITS),
  packageSize: z.number().finite().positive().max(100_000),
  image: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  description: text(1000),
  notes: text(1000),
  archived: z.boolean(),
  ...stamps,
});
export const placeSchema = z.object({
  id,
  segmentId: id,
  name: z.string().min(1).max(100),
  flag: text(60),
  address: text(200),
  neighborhood: text(80),
  city: text(80),
  notes: text(1000),
  color,
  active: z.boolean(),
  cnpj: z.string().regex(/^\d{14}$/).optional(),
  logo: z
    .string()
    .max(200_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  favorite: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  geo: z.enum(['exact', 'street', 'area', 'none']).optional(),
  geoAt: iso.optional(),
  ...stamps,
});
export const priceSchema = z.object({
  id,
  productId: id,
  storeId: id,
  price: money.refine((v) => v > 0, 'Preço deve ser maior que zero'),
  quantity: z.number().finite().positive().max(1000),
  date: iso,
  promo: z.boolean(),
  notes: text(500),
  source: z.enum(['manual', 'purchase']),
  purchaseId: id.optional(),
  ...stamps,
});
export const fuelPriceSchema = z.object({
  id,
  stationId: id,
  fuel: z.enum(FUEL_TYPES),
  price: z.number().finite().positive().max(100),
  date: iso,
  promo: z.boolean(),
  notes: text(500),
  receiptKey: z.string().regex(/^\d{44}$/).optional(),
  ...stamps,
});
export const reviewSchema = z.object({
  id,
  targetType: z.enum(['product', 'brand']),
  targetId: id,
  overall: rating,
  quality: rating.optional(),
  value: rating.optional(),
  comment: text(1000),
  favorite: z.boolean(),
  avoid: z.boolean(),
  date: iso,
  ...stamps,
});
export const purchaseSchema = z.object({ id, storeId: id, date: iso, total: money, notes: text(1000), receiptKey: z.string().regex(/^\d{44}$/).optional(), ...stamps });
export const receiptLinkSchema = z.object({ id, placeId: id, key: z.string().min(3).max(200), description: z.string().min(1).max(200), productId: id, ...stamps });
export const purchaseItemSchema = z.object({
  id,
  purchaseId: id,
  productId: id,
  quantity: z.number().finite().positive().max(10_000),
  unitPrice: money,
});
export const listSchema = z.object({ id, name: z.string().min(1).max(80), archived: z.boolean(), ...stamps });
export const listItemSchema = z.object({
  id,
  listId: id,
  productId: id,
  quantity: z.number().finite().positive().max(10_000),
  priority: z.enum(['alta', 'media', 'baixa']),
  checked: z.boolean(),
  notes: text(300),
  ...stamps,
});
export const categoryBudgetSchema = z.object({ id, categoryId: id, limit: money });
export const activitySchema = z.object({
  id,
  kind: z.enum(['price', 'fuel', 'purchase', 'product', 'store', 'station', 'segment', 'review', 'list', 'backup']),
  label: z.string().max(200),
  refId: id.optional(),
  createdAt: iso,
});
export const settingSchema = z.object({ key: z.string().min(1).max(40), value: z.unknown() });

export const tableSchemas = {
  segments: segmentSchema,
  categories: categorySchema,
  brands: brandSchema,
  products: productSchema,
  stores: placeSchema,
  prices: priceSchema,
  fuelPrices: fuelPriceSchema,
  reviews: reviewSchema,
  purchases: purchaseSchema,
  purchaseItems: purchaseItemSchema,
  lists: listSchema,
  listItems: listItemSchema,
  categoryBudgets: categoryBudgetSchema,
  activities: activitySchema,
  settings: settingSchema,
  receiptLinks: receiptLinkSchema,
} as const;

/** Primeira mensagem de erro legível de um resultado do zod. */
const FIELD_LABEL: Record<string, string> = {
  name: 'Nome',
  price: 'Preço',
  packageSize: 'Conteúdo da embalagem',
  quantity: 'Quantidade',
  unitPrice: 'Preço unitário',
  barcode: 'Código de barras',
  address: 'Endereço',
  neighborhood: 'Bairro',
  city: 'Cidade',
  notes: 'Observações',
  description: 'Descrição',
  date: 'Data',
  image: 'Foto',
  logo: 'Logo',
  cnpj: 'CNPJ',
  color: 'Cor',
  flag: 'Bandeira',
  subcategory: 'Subcategoria',
  limit: 'Limite',
};

const num = (n: unknown) => (typeof n === 'number' || typeof n === 'bigint' ? Number(n).toLocaleString('pt-BR') : String(n));

/** Primeiro problema de validação, em português e com o nome do campo. */
export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0] as z.core.$ZodIssue | undefined;
  if (!i) return 'Dados inválidos';
  const key = String(i.path[i.path.length - 1] ?? '');
  const label = FIELD_LABEL[key] ?? 'Valor';
  const isText = 'origin' in i && i.origin === 'string';
  switch (i.code) {
    case 'too_big':
      return isText ? `${label}: no máximo ${num(i.maximum)} caracteres` : `${label}: o máximo é ${num(i.maximum)}`;
    case 'too_small':
      return isText ? `${label}: obrigatório` : `${label}: o mínimo é ${num(i.minimum)}`;
    case 'invalid_type':
      return `${label}: valor inválido`;
    case 'invalid_format':
      return `${label}: formato inválido`;
    case 'invalid_value':
      return `${label}: opção inválida`;
    default:
      return /^[A-Za-z ]+:/.test(i.message) || /expected|invalid/i.test(i.message) ? `${label}: valor inválido` : i.message;
  }
}
