import { comparable, contentInBase, formatUnitPrice, packageLabel, packagePrice, recordUnitPrice, unitPrice } from '@/services/units';
import { product } from './fixtures';

describe('normalização de unidades', () => {
  it('arroz 5 kg por R$ 25 sai mais barato por kg que 1 kg por R$ 5,50', () => {
    const big = product({ unit: 'kg', packageSize: 5 });
    const small = product({ unit: 'kg', packageSize: 1 });
    expect(unitPrice(25, big)).toBe(5);
    expect(unitPrice(5.5, small)).toBe(5.5);
    expect(unitPrice(25, big)).toBeLessThan(unitPrice(5.5, small));
  });
  it('converte g→kg, ml→L e dúzia→unidades', () => {
    expect(contentInBase({ unit: 'g', packageSize: 500 })).toBe(0.5);
    expect(contentInBase({ unit: 'ml', packageSize: 350 })).toBeCloseTo(0.35);
    expect(contentInBase({ unit: 'dz', packageSize: 1 })).toBe(12);
    expect(unitPrice(4, { unit: 'g', packageSize: 500 })).toBe(8);
    expect(unitPrice(12, { unit: 'dz', packageSize: 1 })).toBe(1);
  });
  it('packagePrice divide pelo número de embalagens', () => {
    expect(packagePrice({ price: 10, quantity: 3 })).toBeCloseTo(3.3333, 3);
    expect(packagePrice({ price: 10, quantity: 0 })).toBe(10);
    expect(recordUnitPrice({ price: 30, quantity: 3 }, { unit: 'kg', packageSize: 2 })).toBe(5);
  });
  it('não considera comparáveis medidas diferentes', () => {
    expect(comparable({ unit: 'kg' }, { unit: 'g' })).toBe(true);
    expect(comparable({ unit: 'kg' }, { unit: 'un' })).toBe(false);
    expect(comparable({ unit: 'pct' }, { unit: 'cx' })).toBe(false);
  });
  it('rótulos', () => {
    expect(formatUnitPrice(5, 'g').replace(/\s/g, ' ')).toBe('R$ 5,00/kg');
    expect(packageLabel({ unit: 'dz', packageSize: 1 })).toBe('1 dúzia');
    expect(packageLabel({ unit: 'g', packageSize: 500 })).toBe('500 g');
  });
});
