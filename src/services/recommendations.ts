import type { Brand, ID, PriceRecord, Product, Review } from '@/types';
import { productStats } from './comparison';
import { dimensionOf } from './units';

export interface Suggestion {
  product: Product;
  brand?: Brand;
  /** 0 a 100 */
  score: number;
  /** Nota usada no ranking (do produto, ou da marca quando o produto não tem avaliação). */
  rating?: number;
  ratingSource?: 'product' | 'brand';
  bestUnitPrice?: number;
  bestPackagePrice?: number;
  bestStoreId?: ID;
  favorite: boolean;
  avoid: boolean;
  reasons: string[];
  /** Produtos de dimensões diferentes (kg × unidade) não são comparados por preço entre si. */
  comparableGroup: string;
}

const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
};

/** Nota de um review: média de geral, qualidade e custo-benefício informados. */
export const reviewScore = (r: Review) => avg([r.overall, r.quality, r.value])!;

/**
 * Ordena produtos combinando avaliação pessoal, custo por unidade, tendência de preço e preferências.
 * Só usa avaliações e preços que o usuário registrou.
 */
export function rankProducts(
  products: Product[],
  ctx: { brands: Map<ID, Brand>; reviews: Review[]; prices: PriceRecord[]; staleDays: number; now?: Date },
): Suggestion[] {
  const productReviews = new Map<ID, Review>();
  const brandReviews = new Map<ID, Review>();
  for (const r of ctx.reviews) (r.targetType === 'product' ? productReviews : brandReviews).set(r.targetId, r);
  const pricesBy = new Map<ID, PriceRecord[]>();
  for (const p of ctx.prices) {
    const arr = pricesBy.get(p.productId);
    if (arr) arr.push(p);
    else pricesBy.set(p.productId, [p]);
  }

  const base = products.map((product) => {
    const pr = productReviews.get(product.id);
    const br = product.brandId ? brandReviews.get(product.brandId) : undefined;
    const stats = productStats(product, pricesBy.get(product.id) ?? [], ctx.staleDays, ctx.now);
    const ref = stats?.recentMin ?? stats?.historicMin;
    return {
      product,
      brand: product.brandId ? ctx.brands.get(product.brandId) : undefined,
      review: pr ?? br,
      ratingSource: pr ? ('product' as const) : br ? ('brand' as const) : undefined,
      favorite: !!(pr?.favorite || br?.favorite),
      avoid: !!(pr?.avoid || br?.avoid),
      stats,
      ref,
      group: dimensionOf(product.unit),
    };
  });

  // Faixa de preço por unidade dentro de cada grupo comparável
  const ranges = new Map<string, { min: number; max: number }>();
  for (const b of base) {
    if (!b.ref || !Number.isFinite(b.ref.unitPrice)) continue;
    const r = ranges.get(b.group);
    if (!r) ranges.set(b.group, { min: b.ref.unitPrice, max: b.ref.unitPrice });
    else {
      r.min = Math.min(r.min, b.ref.unitPrice);
      r.max = Math.max(r.max, b.ref.unitPrice);
    }
  }

  return base
    .map((b): Suggestion => {
      const reasons: string[] = [];
      const parts: { w: number; v: number }[] = [];
      const rating = b.review ? reviewScore(b.review) : undefined;

      if (rating != null) {
        parts.push({ w: 0.5, v: (rating - 1) / 4 });
        reasons.push(
          b.ratingSource === 'product'
            ? `Sua nota: ${rating.toFixed(1).replace('.', ',')} de 5`
            : `Sem nota própria; a marca tem ${rating.toFixed(1).replace('.', ',')} de 5`,
        );
        if (rating <= 2.5) reasons.push('Avaliação baixa pesa contra, mesmo se for barato');
      } else {
        reasons.push('Ainda sem avaliação sua');
      }

      const range = ranges.get(b.group);
      if (b.ref && range) {
        const span = range.max - range.min;
        // proporcional ao menor preço: 10% mais caro perde ~10% do componente (min-max exagerava diferenças pequenas)
        const v = b.ref.unitPrice > 0 ? range.min / b.ref.unitPrice : 1;
        parts.push({ w: 0.35, v });
        if (span > 0 && b.ref.unitPrice === range.min) reasons.push('Menor preço por unidade entre os comparáveis');
        if (b.ref.stale) reasons.push('Preço de referência desatualizado');
      } else {
        reasons.push('Sem preço registrado');
      }

      if (b.stats && b.stats.count >= 2) {
        const trend = b.stats.avgPackage > 0 ? (b.stats.avgPackage - b.stats.last.packagePrice) / b.stats.avgPackage : 0;
        parts.push({ w: 0.15, v: Math.max(0, Math.min(1, 0.5 + trend * 5)) });
        if (trend > 0.03) reasons.push('Último preço abaixo da sua média');
        if (trend < -0.03) reasons.push('Último preço acima da sua média');
      }

      const wsum = parts.reduce((s, p) => s + p.w, 0);
      let score = wsum > 0 ? (parts.reduce((s, p) => s + p.w * p.v, 0) / wsum) * 100 : 0;
      if (rating == null) score *= 0.85;
      if (b.favorite) {
        score = Math.min(100, score + 10);
        reasons.unshift('Marcado como favorito');
      }
      if (b.avoid) {
        score = Math.min(score, 5);
        reasons.unshift('Você marcou para não comprar novamente');
      }

      return {
        product: b.product,
        brand: b.brand,
        score: Math.round(score),
        rating,
        ratingSource: b.ratingSource,
        bestUnitPrice: b.ref?.unitPrice,
        bestPackagePrice: b.ref?.packagePrice,
        bestStoreId: b.ref?.storeId,
        favorite: b.favorite,
        avoid: b.avoid,
        reasons,
        comparableGroup: b.group,
      };
    })
    .sort((a, b) => Number(a.avoid) - Number(b.avoid) || b.score - a.score);
}

/** Média das avaliações de uma marca considerando a nota da própria marca e a dos seus produtos. */
export function brandRating(brandId: ID, products: Product[], reviews: Review[]): { avg?: number; count: number } {
  const ids = new Set(products.filter((p) => p.brandId === brandId).map((p) => p.id));
  const scores = reviews
    .filter((r) => (r.targetType === 'brand' && r.targetId === brandId) || (r.targetType === 'product' && ids.has(r.targetId)))
    .map(reviewScore);
  return { avg: avg(scores), count: scores.length };
}
