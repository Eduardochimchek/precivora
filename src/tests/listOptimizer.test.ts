import { optimizeList, type Quote, type QuoteTable } from '@/services/listOptimizer';

const q = (price: number, stale = false): Quote => ({ price, date: '2026-11-10T12:00:00Z', stale });
function table(rows: Record<string, Record<string, number>>): QuoteTable {
  return new Map(Object.entries(rows).map(([p, s]) => [p, new Map(Object.entries(s).map(([st, v]) => [st, q(v)]))]));
}
const items = [
  { itemId: 'i1', productId: 'arroz', quantity: 1 },
  { itemId: 'i2', productId: 'feijao', quantity: 2 },
  { itemId: 'i3', productId: 'cafe', quantity: 1 },
];
// A é o melhor mercado único (30+2*8+20=66), B tem café muito barato
const quotes = table({
  arroz: { A: 30, B: 32, C: 35 },
  feijao: { A: 8, B: 9, C: 7.5 },
  cafe: { A: 20, B: 10, C: 22 },
});
const stores = ['A', 'B', 'C'];

describe('optimizeList', () => {
  it('soma o total por mercado e acha o melhor mercado único', () => {
    const r = optimizeList(items, quotes, stores, { tripCost: 0, preferSingleStore: false, minSplitSavings: 0 });
    const totals = Object.fromEntries(r.perStore.map((s) => [s.storeId, s.total]));
    expect(totals).toEqual({ A: 66, B: 60, C: 72 });
    expect(r.bestSingle?.storeId).toBe('B');
  });

  it('recomenda dividir quando compensa mesmo com deslocamento', () => {
    // B sozinho = 60; A(arroz 30) + B(café 10) + C(feijão 15) = 55 + 2 viagens extras
    const r = optimizeList(items, quotes, stores, { tripCost: 1, preferSingleStore: false, minSplitSavings: 0 });
    expect(r.recommendation.kind).toBe('split');
    expect(r.split!.stores.length).toBeGreaterThan(1);
    expect(r.recommendation.netSavings).toBeGreaterThan(0);
    expect(r.split!.total).toBe(r.split!.goods + r.split!.travelCost);
  });

  it('com deslocamento caro, fica em um mercado só', () => {
    const r = optimizeList(items, quotes, stores, { tripCost: 20, preferSingleStore: false, minSplitSavings: 0 });
    expect(r.recommendation.kind).toBe('single');
    expect(r.recommendation.stores).toEqual(['B']);
    expect(r.recommendation.total).toBe(60);
  });

  it('respeita preferência por um mercado e economia mínima', () => {
    const r = optimizeList(items, quotes, stores, { tripCost: 1, preferSingleStore: true, minSplitSavings: 50 });
    expect(r.recommendation.kind).toBe('single');
    expect(r.recommendation.netSavings).toBeGreaterThan(0);
    const r2 = optimizeList(items, quotes, stores, { tripCost: 1, preferSingleStore: true, minSplitSavings: 1 });
    expect(r2.recommendation.kind).toBe('split');
  });

  it('sem mercado completo, monta a combinação', () => {
    const partial = table({ arroz: { A: 30 }, feijao: { B: 8 }, cafe: { A: 20 } });
    const r = optimizeList(items, partial, stores, { tripCost: 5, preferSingleStore: false, minSplitSavings: 0 });
    expect(r.bestSingle).toBeUndefined();
    expect(r.recommendation.kind).toBe('split');
    expect(r.recommendation.stores.sort()).toEqual(['A', 'B']);
    expect(r.recommendation.total).toBe(30 + 16 + 20 + 5);
  });

  it('sem nenhum preço, informa que faltam dados', () => {
    const r = optimizeList(items, new Map(), stores, { tripCost: 5, preferSingleStore: false, minSplitSavings: 0 });
    expect(r.recommendation.kind).toBe('insufficient');
    expect(r.unpricedItems).toHaveLength(3);
  });

  it('itens sem preço ficam de fora do cálculo e listados', () => {
    const r = optimizeList([...items, { itemId: 'i4', productId: 'sal', quantity: 1 }], quotes, stores, {
      tripCost: 20,
      preferSingleStore: false,
      minSplitSavings: 0,
    });
    expect(r.unpricedItems.map((i) => i.productId)).toEqual(['sal']);
    expect(r.pricedItems).toBe(3);
    expect(r.bestSingle?.complete).toBe(true);
  });
});
