import type { GeoPrecision, Place } from '@/types';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Distância em linha reta (km). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (km: number) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`);

export const hasCoords = (p: Pick<Place, 'lat' | 'lng'>): p is Place & LatLng => typeof p.lat === 'number' && typeof p.lng === 'number';

export const PRECISION_LABEL: Record<GeoPrecision, string> = {
  exact: 'no número',
  street: 'na rua (aproximado)',
  area: 'no bairro (aproximado)',
  none: 'endereço não encontrado',
};

/** Rua e número a partir do endereço livre ("Rua X, 123 - Sala 2"). */
export function splitStreet(address: string | undefined): { street?: string; number?: string } {
  if (!address) return {};
  const base = address.split(' - ')[0].trim();
  const m = /^(.*?),?\s+(\d+[A-Za-z]?)\s*$/.exec(base) ?? /^(.*?),\s*(\d+[A-Za-z]?)\b/.exec(base);
  if (m && m[1].trim()) return { street: m[1].replace(/,\s*$/, '').trim(), number: m[2] };
  return { street: base.replace(/,\s*s\/n$/i, '').trim() || undefined };
}

export interface GeocodeQuery {
  params: Record<string, string>;
  /** Precisão máxima que este pedido pode dar. */
  level: GeoPrecision;
}

/** Pedidos ao Nominatim, do mais preciso ao menos: rua com número (ou só rua) e, se falhar, bairro. */
export function geocodeQueries(p: Pick<Place, 'address' | 'neighborhood' | 'city'>): GeocodeQuery[] {
  if (!p.city) return [];
  const out: GeocodeQuery[] = [];
  const { street, number } = splitStreet(p.address);
  const base = { city: p.city, countrycodes: 'br' };
  if (street) out.push({ params: { ...base, street: number ? `${number} ${street}` : street }, level: number ? 'exact' : 'street' });
  if (p.neighborhood) out.push({ params: { q: `${p.neighborhood}, ${p.city}`, countrycodes: 'br' }, level: 'area' });
  return out;
}

interface NominatimResult {
  lat: string;
  lon: string;
  addresstype?: string;
  address?: { house_number?: string; city?: string; town?: string; village?: string; municipality?: string };
}

const fold = (s: string | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Interpreta a resposta: precisão real e se caiu na cidade certa. */
export function readGeocode(results: unknown, query: GeocodeQuery, city: string): { lat: number; lng: number; geo: GeoPrecision } | undefined {
  const r = (Array.isArray(results) ? results[0] : undefined) as NominatimResult | undefined;
  if (!r) return undefined;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const a = r.address ?? {};
  const resultCity = a.city ?? a.town ?? a.village ?? a.municipality;
  if (resultCity && fold(resultCity) !== fold(city)) return undefined;
  if (query.level === 'area') return { lat, lng, geo: 'area' };
  return { lat, lng, geo: a.house_number ? 'exact' : 'street' };
}
