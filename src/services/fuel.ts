import type { FuelPrice, FuelType, ID } from '@/types';
import { isStale } from '@/utils/date';
import { byRecent, priceChange, type PriceChange } from './comparison';

export const FUEL_LABEL: Record<FuelType, string> = {
  gasolina_comum: 'Gasolina comum',
  gasolina_aditivada: 'Gasolina aditivada',
  gasolina_premium: 'Gasolina premium',
  etanol: 'Etanol',
  diesel: 'Diesel comum',
  diesel_s10: 'Diesel S10',
  gnv: 'GNV',
};

export const FUEL_SHORT: Record<FuelType, string> = {
  gasolina_comum: 'Gasolina',
  gasolina_aditivada: 'Aditivada',
  gasolina_premium: 'Premium',
  etanol: 'Etanol',
  diesel: 'Diesel',
  diesel_s10: 'S10',
  gnv: 'GNV',
};

export const fuelUnit = (fuel: FuelType) => (fuel === 'gnv' ? 'm³' : 'L');

export interface StationQuote {
  stationId: ID;
  record: FuelPrice;
  stale: boolean;
  /** Diferença por litro em relação ao mais barato. */
  diffToBest: number;
  change?: PriceChange;
}

/** Preço mais recente de cada posto para um combustível, do mais barato ao mais caro. */
export function rankStations(records: FuelPrice[], fuel: FuelType, staleDays = 7, now = new Date()): StationQuote[] {
  const sorted = records.filter((r) => r.fuel === fuel).sort(byRecent);
  const latest = new Map<ID, FuelPrice>();
  const previous = new Map<ID, FuelPrice>();
  for (const r of sorted) {
    if (!latest.has(r.stationId)) latest.set(r.stationId, r);
    else if (!previous.has(r.stationId)) previous.set(r.stationId, r);
  }
  const list = [...latest.values()].sort((a, b) => a.price - b.price);
  const best = list[0]?.price ?? 0;
  return list.map((r) => {
    const prev = previous.get(r.stationId);
    return {
      stationId: r.stationId,
      record: r,
      stale: isStale(r.date, staleDays, now),
      diffToBest: Math.round((r.price - best) * 1000) / 1000,
      change: prev ? priceChange(prev.price, r.price) : undefined,
    };
  });
}

/** Economia ao abastecer `liters` no posto mais barato em vez de outro. */
export const tankSavings = (cheaper: number, other: number, liters: number) => Math.round((other - cheaper) * liters * 100) / 100;

export interface FlexResult {
  /** Preço do etanol dividido pelo da gasolina. */
  ratio: number;
  threshold: number;
  best: 'etanol' | 'gasolina' | 'indiferente';
  /** Preço máximo do etanol para compensar. */
  maxEthanolPrice: number;
  /** Custo por km, quando o consumo é informado. */
  costPerKm?: { etanol: number; gasolina: number };
}

/**
 * Compara etanol e gasolina. `efficiency` é a razão de rendimento do etanol em relação à gasolina
 * (0,70 é só uma referência; cada veículo tem a sua). Se o consumo em km/L for informado, ele manda.
 */
export function flexCompare(
  ethanol: number,
  gasoline: number,
  efficiency = 0.7,
  consumption?: { etanol?: number; gasolina?: number },
): FlexResult {
  const hasKm = !!(consumption?.etanol && consumption?.gasolina);
  const threshold = hasKm ? consumption!.etanol! / consumption!.gasolina! : efficiency;
  const ratio = gasoline > 0 ? ethanol / gasoline : NaN;
  const diff = ratio - threshold;
  const best = Math.abs(diff) < 0.005 ? 'indiferente' : diff < 0 ? 'etanol' : 'gasolina';
  return {
    ratio,
    threshold,
    best,
    maxEthanolPrice: Math.floor(gasoline * threshold * 1000) / 1000,
    costPerKm: hasKm ? { etanol: ethanol / consumption!.etanol!, gasolina: gasoline / consumption!.gasolina! } : undefined,
  };
}
