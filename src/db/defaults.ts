import type { Category, Segment } from '@/types';
import { newId } from '@/utils/id';

export const SEG_MERCADO = 'seg-mercado';
export const SEG_FARMACIA = 'seg-farmacia';
export const SEG_COMBUSTIVEL = 'seg-combustivel';

/** Segmentos que vêm com o app (IDs fixos para backups de aparelhos diferentes se reconhecerem). */
export const BUILTIN_SEGMENTS: Pick<Segment, 'id' | 'name' | 'icon' | 'color' | 'mode' | 'order'>[] = [
  { id: SEG_MERCADO, name: 'Mercado', icon: 'cart', color: '#2a78d6', mode: 'items', order: 0 },
  { id: SEG_FARMACIA, name: 'Farmácia', icon: 'pill', color: '#1baf7a', mode: 'items', order: 1 },
  { id: SEG_COMBUSTIVEL, name: 'Combustível', icon: 'fuel', color: '#eda100', mode: 'fuel', order: 2 },
];

/** Categorias iniciais (dados de referência, editáveis). Sem segmento = valem para todos. */
export const DEFAULT_CATEGORIES: [string, string, string | undefined][] = [
  ['Mercearia', '#D97706', SEG_MERCADO],
  ['Hortifrúti', '#16A34A', SEG_MERCADO],
  ['Carnes e peixes', '#DC2626', SEG_MERCADO],
  ['Laticínios e frios', '#0EA5E9', SEG_MERCADO],
  ['Padaria', '#A16207', SEG_MERCADO],
  ['Bebidas', '#7C3AED', SEG_MERCADO],
  ['Limpeza', '#0891B2', SEG_MERCADO],
  ['Higiene e beleza', '#DB2777', undefined],
  ['Bebê', '#F59E0B', undefined],
  ['Pet', '#65A30D', undefined],
  ['Utilidades', '#475569', undefined],
  ['Medicamentos', '#0D9488', SEG_FARMACIA],
  ['Dermocosméticos', '#C026D3', SEG_FARMACIA],
  ['Vitaminas e suplementos', '#EA580C', SEG_FARMACIA],
  ['Primeiros socorros', '#E11D48', SEG_FARMACIA],
];

export function builtinSegmentRows(now: string): Segment[] {
  return BUILTIN_SEGMENTS.map((s) => ({ ...s, builtin: true, createdAt: now, updatedAt: now }));
}

export function defaultCategoryRows(now: string, only?: Set<string>): Category[] {
  return DEFAULT_CATEGORIES.filter(([name]) => !only || only.has(name)).map(([name, color, segmentId]) => ({
    id: newId(),
    name,
    color,
    segmentId,
    createdAt: now,
    updatedAt: now,
  }));
}
