import { CapacitorHttp } from '@capacitor/core';
import { db } from '@/db/database';
import { geocodeQueries, readGeocode } from '@/services/geo';
import type { Place } from '@/types';
import { isNative } from './native';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const GAP_MS = 1100;
const RETRY_NOT_FOUND_DAYS = 30;
export const GEOCODE_EVENT = 'precivora:geocode';

export interface GeocodeProgress {
  pending: number;
  done: number;
  running: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(params: Record<string, string>): Promise<unknown> {
  const query = { ...params, format: 'jsonv2', addressdetails: '1', limit: '1', 'accept-language': 'pt-BR' };
  if (isNative) {
    const res = await CapacitorHttp.get({ url: NOMINATIM, params: query, headers: { 'User-Agent': 'Precivora/1.0 (app pessoal de comparacao de precos)' }, connectTimeout: 15_000, readTimeout: 20_000 });
    if (res.status === 429 || res.status === 403) throw new Error('limite');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  }
  const res = await fetch(`${NOMINATIM}?${new URLSearchParams(query)}`);
  if (res.status === 429 || res.status === 403) throw new Error('limite');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const needsGeocode = (p: Place, now = Date.now()) =>
  !!p.city && (p.geo === undefined || (p.geo === 'none' && (!p.geoAt || now - Date.parse(p.geoAt) > RETRY_NOT_FOUND_DAYS * 86_400_000)));

let running = false;
let stopRequested = false;
let done = 0;

export async function geocodePending(): Promise<number> {
  return (await db.stores.toArray()).filter((p) => needsGeocode(p)).length;
}

const emit = async () => window.dispatchEvent(new CustomEvent<GeocodeProgress>(GEOCODE_EVENT, { detail: { pending: await geocodePending(), done, running } }));

export const geocodeStatus = async (): Promise<GeocodeProgress> => ({ pending: await geocodePending(), done, running });

/**
 * Localiza no mapa os endereços dos lugares, um por vez (1 pedido por segundo, regra do Nominatim/OpenStreetMap).
 * Ordem: favoritos, postos com preço, outros postos e depois o resto. Só envia o endereço do lugar.
 * Roda em segundo plano até acabar, perder a conexão ou o app ser fechado.
 */
export async function runGeocoding(): Promise<void> {
  if (running || !navigator.onLine) return;
  running = true;
  stopRequested = false;
  done = 0;
  try {
    await emit();
    const fuelSegments = new Set((await db.segments.toArray()).filter((s) => s.mode === 'fuel').map((s) => s.id));
    const priced = new Set((await db.fuelPrices.orderBy('stationId').uniqueKeys()).map(String));
    const rank = (p: Place) => (p.favorite ? 0 : priced.has(p.id) ? 1 : fuelSegments.has(p.segmentId) ? 2 : 3);
    for (;;) {
      if (stopRequested || !navigator.onLine) break;
      const next = (await db.stores.toArray()).filter((p) => needsGeocode(p)).sort((a, b) => rank(a) - rank(b))[0];
      if (!next) break;
      let found: ReturnType<typeof readGeocode>;
      for (const q of geocodeQueries(next)) {
        found = readGeocode(await nominatim(q.params), q, next.city!);
        await sleep(GAP_MS);
        if (found) break;
      }
      const now = new Date().toISOString();
      const current = await db.stores.get(next.id);
      if (current && current.address === next.address && current.city === next.city && current.neighborhood === next.neighborhood) {
        await db.stores.update(next.id, found ? { ...found, geoAt: now } : { geo: 'none', lat: undefined, lng: undefined, geoAt: now });
      }
      done++;
      if (done % 5 === 0) await emit();
    }
  } catch {
    /* sem rede ou limite do serviço: tenta de novo na próxima abertura */
  } finally {
    running = false;
    await emit();
  }
}

export function stopGeocoding(): void {
  stopRequested = true;
}
