import { brandRating, rankProducts, reviewScore } from '@/services/recommendations';
import type { Brand } from '@/types';
import { daysAgo, NOW, price, product, review } from './fixtures';

const brands = new Map<string, Brand>([
  ['rampi', { id: 'rampi', name: 'Rampineli', nameKey: 'rampineli', createdAt: '', updatedAt: '' }],
  ['barato', { id: 'barato', name: 'Barato', nameKey: 'barato', createdAt: '', updatedAt: '' }],
]);

describe('rankProducts', () => {
  const good = product({ id: 'good', name: 'Arroz Rampineli', brandId: 'rampi', packageSize: 5 });
  const cheap = product({ id: 'cheap', name: 'Arroz Barato', brandId: 'barato', packageSize: 5 });
  const prices = [
    price({ productId: 'good', storeId: 'A', price: 27, date: daysAgo(2) }),
    price({ productId: 'cheap', storeId: 'A', price: 24, date: daysAgo(2) }),
  ];

  it('não recomenda o mais barato quando tem nota ruim', () => {
    const r = rankProducts([cheap, good], {
      brands,
      reviews: [review({ targetId: 'good', overall: 5 }), review({ targetId: 'cheap', overall: 1 })],
      prices,
      staleDays: 30,
      now: NOW,
    });
    expect(r[0].product.id).toBe('good');
    expect(r[1].reasons.join(' ')).toMatch(/Avaliação baixa/);
    expect(r[1].reasons.join(' ')).toMatch(/Menor preço por unidade/);
    expect(r.every((s) => s.reasons.length > 0)).toBe(true);
  });

  it('"não comprar novamente" vai para o fim, mesmo com nota alta', () => {
    const r = rankProducts([good, cheap], {
      brands,
      reviews: [review({ targetId: 'good', overall: 5, avoid: true }), review({ targetId: 'cheap', overall: 3 })],
      prices,
      staleDays: 30,
      now: NOW,
    });
    expect(r[r.length - 1].product.id).toBe('good');
    expect(r[r.length - 1].avoid).toBe(true);
    expect(r[r.length - 1].reasons[0]).toMatch(/não comprar/);
  });

  it('favorito sobe no ranking', () => {
    const base = { brands, prices, staleDays: 30, now: NOW };
    const without = rankProducts([good, cheap], { ...base, reviews: [review({ targetId: 'good', overall: 3 }), review({ targetId: 'cheap', overall: 3 })] });
    const withFav = rankProducts([good, cheap], {
      ...base,
      reviews: [review({ targetId: 'good', overall: 3, favorite: true }), review({ targetId: 'cheap', overall: 3 })],
    });
    expect(without[0].product.id).toBe('cheap');
    expect(withFav[0].product.id).toBe('good');
    expect(withFav[0].reasons[0]).toMatch(/favorito/);
  });

  it('usa a nota da marca quando o produto não tem', () => {
    const r = rankProducts([good], { brands, reviews: [review({ targetType: 'brand', targetId: 'rampi', overall: 4 })], prices, staleDays: 30, now: NOW });
    expect(r[0].rating).toBe(4);
    expect(r[0].ratingSource).toBe('brand');
  });

  it('sem avaliação e sem preço ainda gera motivo', () => {
    const r = rankProducts([product({ id: 'x' })], { brands, reviews: [], prices: [], staleDays: 30, now: NOW });
    expect(r[0].reasons).toEqual(['Ainda sem avaliação sua', 'Sem preço registrado']);
    expect(r[0].rating).toBeUndefined();
  });
});

describe('notas', () => {
  it('reviewScore é a média das notas informadas', () => {
    expect(reviewScore(review({ targetId: 'a', overall: 4, quality: 4, value: 5 }))).toBeCloseTo(4.333, 3);
    expect(reviewScore(review({ targetId: 'a', overall: 2 }))).toBe(2);
  });
  it('brandRating junta nota da marca e dos produtos', () => {
    const products = [product({ id: 'p1', brandId: 'rampi' }), product({ id: 'p2', brandId: 'outra' })];
    const r = brandRating('rampi', products, [
      review({ targetType: 'brand', targetId: 'rampi', overall: 5 }),
      review({ targetId: 'p1', overall: 3 }),
      review({ targetId: 'p2', overall: 1 }),
    ]);
    expect(r).toEqual({ avg: 4, count: 2 });
    expect(brandRating('nada', products, []).avg).toBeUndefined();
  });
});
