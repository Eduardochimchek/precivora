import { compareWithLast, priceChange, productStats } from '@/services/comparison';
import { daysAgo, NOW, price, product } from './fixtures';

describe('priceChange', () => {
  it('25,90 → 23,90 = −7,72%', () => {
    const c = priceChange(25.9, 23.9);
    expect(c.direction).toBe('down');
    expect(c.diff).toBe(-2);
    expect(c.pct * 100).toBeCloseTo(-7.72, 2);
  });
  it('detecta alta e igualdade', () => {
    expect(priceChange(10, 11).direction).toBe('up');
    expect(priceChange(10, 10).direction).toBe('same');
  });
});

describe('productStats', () => {
  const p = product({ id: 'arroz', unit: 'kg', packageSize: 5 });
  const records = [
    price({ productId: 'arroz', storeId: 'A', price: 28, date: daysAgo(60) }),
    price({ productId: 'arroz', storeId: 'A', price: 26, date: daysAgo(10) }),
    price({ productId: 'arroz', storeId: 'B', price: 22, date: daysAgo(90) }),
    price({ productId: 'arroz', storeId: 'C', price: 25, date: daysAgo(3), source: 'purchase', purchaseId: 'x' }),
    price({ productId: 'arroz', storeId: 'A', price: 24, date: daysAgo(1) }),
  ];

  it('retorna null sem registros', () => {
    expect(productStats(p, [], 30, NOW)).toBeNull();
  });

  it('calcula mínimo, máximo, último, média e por unidade', () => {
    const s = productStats(p, records, 30, NOW)!;
    expect(s.count).toBe(5);
    expect(s.historicMin.packagePrice).toBe(22);
    expect(s.historicMin.storeId).toBe('B');
    expect(s.historicMax.packagePrice).toBe(28);
    expect(s.last.packagePrice).toBe(24);
    expect(s.avgPackage).toBe(25);
    expect(s.avgUnit).toBe(5);
    expect(s.lastChange?.previous).toBe(26);
    expect(s.lastChange?.direction).toBe('down');
  });

  it('menor recente ignora preço desatualizado e byStore pega o mais recente de cada mercado', () => {
    const s = productStats(p, records, 30, NOW)!;
    expect(s.recentMin?.storeId).toBe('A');
    expect(s.recentMin?.packagePrice).toBe(24);
    expect(s.byStore.map((q) => [q.storeId, q.packagePrice])).toEqual([
      ['B', 22],
      ['A', 24],
      ['C', 25],
    ]);
    expect(s.byStore[0].stale).toBe(true);
    expect(s.allStale).toBe(false);
  });

  it('último confirmado vem de compra', () => {
    const s = productStats(p, records, 30, NOW)!;
    expect(s.lastConfirmed?.storeId).toBe('C');
    expect(s.lastConfirmed?.confirmed).toBe(true);
  });

  it('allStale quando todos são antigos', () => {
    const s = productStats(p, [price({ productId: 'arroz', storeId: 'A', price: 20, date: daysAgo(40) })], 30, NOW)!;
    expect(s.allStale).toBe(true);
    expect(s.recentMin).toBeUndefined();
  });
});

describe('compareWithLast', () => {
  const recs = [
    price({ productId: 'p', storeId: 'A', price: 25.9, date: daysAgo(5) }),
    price({ productId: 'p', storeId: 'B', price: 20, date: daysAgo(1) }),
  ];
  it('prefere o último preço do mesmo mercado', () => {
    const r = compareWithLast(recs, 'A', 23.9)!;
    expect(r.sameStore).toBe(true);
    expect(r.change.previous).toBe(25.9);
    expect(r.change.pct * 100).toBeCloseTo(-7.72, 2);
  });
  it('cai para o mais recente geral quando o mercado é novo', () => {
    const r = compareWithLast(recs, 'Z', 21)!;
    expect(r.sameStore).toBe(false);
    expect(r.change.previous).toBe(20);
  });
  it('null sem histórico', () => {
    expect(compareWithLast([], 'A', 1)).toBeNull();
  });
});
