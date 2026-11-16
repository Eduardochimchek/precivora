import { flexCompare, rankStations, tankSavings } from '@/services/fuel';
import { daysAgo, fuel, NOW } from './fixtures';

describe('rankStations', () => {
  const recs = [
    fuel({ stationId: 'A', price: 6.39, date: daysAgo(20) }),
    fuel({ stationId: 'A', price: 6.19, date: daysAgo(2) }),
    fuel({ stationId: 'B', price: 6.05, date: daysAgo(1) }),
    fuel({ stationId: 'C', price: 6.29, date: daysAgo(10) }),
    fuel({ stationId: 'B', price: 4.1, fuel: 'etanol', date: daysAgo(1) }),
  ];
  it('usa o último preço de cada posto e ordena do mais barato', () => {
    const r = rankStations(recs, 'gasolina_comum', 7, NOW);
    expect(r.map((q) => [q.stationId, q.record.price])).toEqual([
      ['B', 6.05],
      ['A', 6.19],
      ['C', 6.29],
    ]);
    expect(r[1].diffToBest).toBe(0.14);
    expect(r[2].diffToBest).toBe(0.24);
  });
  it('marca desatualizado e calcula variação no posto', () => {
    const r = rankStations(recs, 'gasolina_comum', 7, NOW);
    expect(r.find((q) => q.stationId === 'C')!.stale).toBe(true);
    const a = r.find((q) => q.stationId === 'A')!;
    expect(a.change?.direction).toBe('down');
    expect(a.change?.previous).toBe(6.39);
  });
  it('filtra pelo combustível', () => {
    expect(rankStations(recs, 'etanol', 7, NOW)).toHaveLength(1);
    expect(rankStations(recs, 'gnv', 7, NOW)).toHaveLength(0);
  });
});

describe('tankSavings', () => {
  it('6,05 vs 6,29 em 40 L = R$ 9,60', () => {
    expect(tankSavings(6.05, 6.29, 40)).toBe(9.6);
    expect(tankSavings(6.05, 6.29, 30)).toBe(7.2);
  });
});

describe('flexCompare', () => {
  it('usa 70% como referência', () => {
    const r = flexCompare(4.2, 6.2, 0.7);
    expect(r.ratio).toBeCloseTo(0.677, 3);
    expect(r.best).toBe('etanol');
    expect(r.maxEthanolPrice).toBe(4.34);
  });
  it('gasolina quando etanol passa do limite', () => {
    expect(flexCompare(4.6, 6.2, 0.7).best).toBe('gasolina');
  });
  it('consumo informado em km/L tem prioridade sobre o percentual', () => {
    const r = flexCompare(4.6, 6.2, 0.7, { etanol: 9, gasolina: 11 });
    expect(r.threshold).toBeCloseTo(0.818, 3);
    expect(r.best).toBe('etanol');
    expect(r.costPerKm!.etanol).toBeCloseTo(0.511, 3);
  });
  it('indiferente quando a razão é praticamente igual', () => {
    expect(flexCompare(4.34, 6.2, 0.7).best).toBe('indiferente');
  });
});
