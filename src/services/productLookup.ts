import type { Unit } from '@/types';

/** Dados de um produto encontrados pelo código de barras numa base pública. */
export interface ProductInfo {
  barcode: string;
  name?: string;
  brand?: string;
  unit?: Unit;
  packageSize?: number;
  imageUrl?: string;
  source: string;
}

export class LookupOffline extends Error {}

const SOURCES: Record<string, { host: string; label: string }> = {
  food: { host: 'world.openfoodfacts.org', label: 'Open Food Facts' },
  beauty: { host: 'world.openbeautyfacts.org', label: 'Open Beauty Facts' },
  petfood: { host: 'world.openpetfoodfacts.org', label: 'Open Pet Food Facts' },
  product: { host: 'world.openproductsfacts.org', label: 'Open Products Facts' },
};

const FIELDS = 'product_name_pt,product_name,generic_name_pt,generic_name,brands,quantity,product_quantity,product_quantity_unit,image_front_small_url,image_front_url';

/** Código de barras EAN-8, UPC-A (12), EAN-13 ou GTIN-14 com dígito verificador certo. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const clean = (v: unknown, max: number) => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s ? s.slice(0, max) : undefined;
};

/** Quantidade da embalagem ("395 g", "2l", "1,5 kg") para unidade do app; g/ml a partir de 1000 vira kg/L. */
export function parsePackage(amount: number | undefined, unitRaw: string | undefined, text?: string): { unit: Unit; packageSize: number } | undefined {
  let n = amount;
  let u = unitRaw?.toLowerCase().trim();
  if (!(n && n > 0 && u) && text && !/\d\s*x\s*\d/i.test(text)) {
    const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|gr|l|lt|ml|cl)\b/i.exec(text);
    if (m) {
      n = Number(m[1].replace(',', '.'));
      u = m[2].toLowerCase();
    }
  }
  if (!n || !(n > 0) || !u) return undefined;
  if (u === 'gr') u = 'g';
  if (u === 'lt') u = 'l';
  if (u === 'cl') {
    n *= 10;
    u = 'ml';
  }
  const round = (x: number) => Math.round(x * 1000) / 1000;
  if (u === 'kg') return { unit: 'kg', packageSize: round(n) };
  if (u === 'l') return { unit: 'L', packageSize: round(n) };
  if (u === 'g') return n >= 1000 ? { unit: 'kg', packageSize: round(n / 1000) } : { unit: 'g', packageSize: round(n) };
  if (u === 'ml') return n >= 1000 ? { unit: 'L', packageSize: round(n / 1000) } : { unit: 'ml', packageSize: round(n) };
  return undefined;
}

/** Converte a resposta da API do Open Food Facts (e bases irmãs). */
export function productFromApi(barcode: string, json: unknown, source: string): ProductInfo | undefined {
  const data = json as { status?: number; product?: Record<string, unknown> };
  const p = data?.status === 1 ? data.product : undefined;
  if (!p) return undefined;
  const name = clean(p.product_name_pt, 120) ?? clean(p.product_name, 120) ?? clean(p.generic_name_pt, 120) ?? clean(p.generic_name, 120);
  const brand = clean(String(p.brands ?? '').split(',')[0], 80);
  const pkg = parsePackage(Number(p.product_quantity) || undefined, clean(p.product_quantity_unit, 10), clean(p.quantity, 40));
  const image = clean(p.image_front_small_url, 500) ?? clean(p.image_front_url, 500);
  return {
    barcode,
    name,
    brand,
    ...pkg,
    imageUrl: image && /^https:\/\/images\.open[a-z]+facts\.org\//.test(image) ? image : undefined,
    source,
  };
}

/** Tipo indicado quando o código existe em outra base ("product found with a different product type: beauty"). */
const otherType = (json: unknown) => /different product type:\s*([a-z]+)/i.exec(String((json as { status_verbose?: string })?.status_verbose ?? ''))?.[1]?.toLowerCase();

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) return await res.json().catch(() => ({}));
    if (!res.ok) throw new LookupOffline(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err instanceof LookupOffline) throw err;
    throw new LookupOffline((err as Error)?.message ?? 'rede');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca o produto pelo código de barras nas bases abertas (Open Food Facts e irmãs).
 * Envia só o código; nada do usuário sai do aparelho.
 */
export async function lookupBarcode(barcode: string, fetchImpl: typeof fetch = fetch): Promise<ProductInfo | undefined> {
  const url = (type: string) => `https://${SOURCES[type].host}/api/v2/product/${barcode}.json?fields=${FIELDS}`;
  const first = await fetchJson(url('food'), fetchImpl);
  const found = productFromApi(barcode, first, SOURCES.food.label);
  if (found) return found;
  const type = otherType(first);
  if (!type || !SOURCES[type] || type === 'food') return undefined;
  return productFromApi(barcode, await fetchJson(url(type), fetchImpl), SOURCES[type].label);
}
