import type { Product, PriceRecord, Unit } from '@/types';
import { money } from '@/utils/format';

export type Dimension = 'mass' | 'volume' | 'count' | 'pack' | 'box';

interface UnitInfo {
  label: string;
  name: string;
  dimension: Dimension;
  /** Fator para a unidade-base da dimensão (kg, L, unidade, pacote, caixa). */
  factor: number;
}

export const UNIT_INFO: Record<Unit, UnitInfo> = {
  kg: { label: 'kg', name: 'quilograma (kg)', dimension: 'mass', factor: 1 },
  g: { label: 'g', name: 'grama (g)', dimension: 'mass', factor: 0.001 },
  L: { label: 'L', name: 'litro (L)', dimension: 'volume', factor: 1 },
  ml: { label: 'ml', name: 'mililitro (ml)', dimension: 'volume', factor: 0.001 },
  un: { label: 'un', name: 'unidade', dimension: 'count', factor: 1 },
  dz: { label: 'dz', name: 'dúzia', dimension: 'count', factor: 12 },
  pct: { label: 'pct', name: 'pacote', dimension: 'pack', factor: 1 },
  cx: { label: 'cx', name: 'caixa', dimension: 'box', factor: 1 },
};

export const BASE_LABEL: Record<Dimension, string> = {
  mass: 'kg',
  volume: 'L',
  count: 'un',
  pack: 'pacote',
  box: 'caixa',
};

export const DIMENSION_NAME: Record<Dimension, string> = {
  mass: 'peso',
  volume: 'volume',
  count: 'unidades',
  pack: 'pacotes',
  box: 'caixas',
};

export const dimensionOf = (unit: Unit): Dimension => UNIT_INFO[unit].dimension;

/** Conteúdo da embalagem na unidade-base (ex.: 500 g → 0,5 kg; 1 dz → 12 un). */
export function contentInBase(product: Pick<Product, 'unit' | 'packageSize'>): number {
  return product.packageSize * UNIT_INFO[product.unit].factor;
}

/** Preço de uma embalagem a partir de um registro (que pode ser "3 por R$ 10"). */
export function packagePrice(record: Pick<PriceRecord, 'price' | 'quantity'>): number {
  return record.price / (record.quantity > 0 ? record.quantity : 1);
}

/** Preço por unidade-base (R$/kg, R$/L, R$/un...). */
export function unitPrice(price: number, product: Pick<Product, 'unit' | 'packageSize'>): number {
  const c = contentInBase(product);
  return c > 0 ? price / c : NaN;
}

export function recordUnitPrice(record: Pick<PriceRecord, 'price' | 'quantity'>, product: Pick<Product, 'unit' | 'packageSize'>): number {
  return unitPrice(packagePrice(record), product);
}

export function comparable(a: Pick<Product, 'unit'>, b: Pick<Product, 'unit'>): boolean {
  return dimensionOf(a.unit) === dimensionOf(b.unit);
}

export function formatUnitPrice(value: number, unit: Unit): string {
  return `${money(value)}/${BASE_LABEL[dimensionOf(unit)]}`;
}

export function packageLabel(product: Pick<Product, 'unit' | 'packageSize'>): string {
  const n = product.packageSize.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  if (product.unit === 'dz') return product.packageSize === 1 ? '1 dúzia' : `${n} dúzias`;
  if (product.unit === 'pct') return product.packageSize === 1 ? '1 pacote' : `${n} pacotes`;
  if (product.unit === 'cx') return product.packageSize === 1 ? '1 caixa' : `${n} caixas`;
  return `${n} ${UNIT_INFO[product.unit].label}`;
}
