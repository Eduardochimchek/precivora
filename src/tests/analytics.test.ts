import { budgetLevel, categoryBudgetStatus, categorySpending, estimatedSavings, monthlySpending, priceMovers } from '@/services/analytics';
import type { Category, Purchase, PurchaseItem } from '@/types';
import { price, product } from './fixtures';

const purchase = (id: string, date: string, total: number): Purchase => ({ id, storeId: 'A', date, total, createdAt: date, updatedAt: date });
const item = (purchaseId: string, productId: string, quantity: number, unitPrice: number): PurchaseItem => ({ id: `${purchaseId}-${productId}`, purchaseId, productId, quantity, unitPrice });

describe('monthlySpending', () => {
  it('soma por mês e preenche meses sem compra com zero', () => {
    const now = new Date(2026, 10, 16);
    const r = monthlySpending(
      [purchase('a', new Date(2026, 10, 2, 12).toISOString(), 100), purchase('b', new Date(2026, 10, 10, 12).toISOString(), 50.5), purchase('c', new Date(2026, 8, 5, 12).toISOString(), 20)],
      3,
      now,
    );
    expect(r.map((m) => [m.key, m.total])).toEqual([
      ['2026-09', 20],
      ['2026-10', 0],
      ['2026-11', 150.5],
    ]);
  });
});

describe('categorySpending', () => {
  it('agrupa itens pela categoria do produto', () => {
    const products = new Map([
      ['arroz', product({ id: 'arroz', categoryId: 'merc' })],
      ['sabao', product({ id: 'sabao', categoryId: 'limp' })],
      ['x', product({ id: 'x' })],
    ]);
    const cats = new Map<string, Category>([
      ['merc', { id: 'merc', name: 'Mercearia', color: '#000000', createdAt: '', updatedAt: '' }],
      ['limp', { id: 'limp', name: 'Limpeza', color: '#111111', createdAt: '', updatedAt: '' }],
    ]);
    const ps = [purchase('a', '2026-11-02T12:00:00Z', 0), purchase('old', '2026-01-02T12:00:00Z', 0)];
    const its = [item('a', 'arroz', 2, 25), item('a', 'sabao', 1, 10), item('a', 'x', 1, 3), item('old', 'arroz', 10, 25)];
    const r = categorySpending(its, ps, products, cats, (p) => p.date >= '2026-11-01');
    expect(r.map((c) => [c.name, c.total])).toEqual([
      ['Mercearia', 50],
      ['Limpeza', 10],
      ['Sem categoria', 3],
    ]);
  });
});

describe('priceMovers', () => {
  it('compara primeiro e último preço por unidade', () => {
    const up = product({ id: 'up', name: 'Café' });
    const down = product({ id: 'down', name: 'Leite' });
    const flat = product({ id: 'one' });
    const r = priceMovers(
      [up, down, flat],
      [
        price({ productId: 'up', storeId: 'A', price: 10, date: '2026-09-01T12:00:00Z' }),
        price({ productId: 'up', storeId: 'A', price: 12, date: '2026-11-01T12:00:00Z' }),
        price({ productId: 'down', storeId: 'A', price: 5, date: '2026-09-01T12:00:00Z' }),
        price({ productId: 'down', storeId: 'B', price: 4, date: '2026-11-01T12:00:00Z' }),
        price({ productId: 'one', storeId: 'B', price: 4, date: '2026-11-01T12:00:00Z' }),
      ],
    );
    expect(r.up.map((m) => m.product.id)).toEqual(['up']);
    expect(r.up[0].pct).toBeCloseTo(0.2);
    expect(r.down[0].product.id).toBe('down');
    expect(r.down[0].pct).toBeCloseTo(-0.2);
  });
});

describe('estimatedSavings', () => {
  it('conta só o que foi pago abaixo da média e ignora os preços da própria compra', () => {
    const ps = [purchase('c1', '2026-11-05T12:00:00Z', 0)];
    const its = [item('c1', 'arroz', 2, 20), item('c1', 'cafe', 1, 15)];
    const prices = [
      price({ productId: 'arroz', storeId: 'A', price: 24 }),
      price({ productId: 'arroz', storeId: 'B', price: 26 }),
      price({ productId: 'arroz', storeId: 'A', price: 20, source: 'purchase', purchaseId: 'c1' }),
      price({ productId: 'cafe', storeId: 'A', price: 12 }),
    ];
    // arroz: média 25 − 20 = 5 × 2 = 10; café pago acima da média → 0
    expect(estimatedSavings(its, ps, prices)).toBe(10);
  });
});

describe('budget', () => {
  it('níveis de alerta', () => {
    expect(budgetLevel(100, 0)).toBe('none');
    expect(budgetLevel(79, 100)).toBe('ok');
    expect(budgetLevel(80, 100)).toBe('warn');
    expect(budgetLevel(100, 100)).toBe('over');
  });
  it('status por categoria ordena pelo percentual', () => {
    const r = categoryBudgetStatus(
      [
        { id: 'b1', categoryId: 'merc', limit: 100 },
        { id: 'b2', categoryId: 'limp', limit: 10 },
      ],
      [
        { categoryId: 'merc', name: 'M', color: '#000000', total: 50 },
        { categoryId: 'limp', name: 'L', color: '#000000', total: 12 },
      ],
      new Map(),
    );
    expect(r.map((s) => [s.budget.categoryId, s.level])).toEqual([
      ['limp', 'over'],
      ['merc', 'ok'],
    ]);
  });
});
