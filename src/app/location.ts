import { Geolocation } from '@capacitor/geolocation';
import type { LatLng } from '@/services/geo';
import { isNative } from './native';

const KEY = 'precivora:posicao';
const MAX_AGE_MS = 5 * 60 * 1000;

export class LocationDenied extends Error {}

export function lastKnownPosition(): (LatLng & { at: number }) | undefined {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as (LatLng & { at: number }) | null;
    return v && Date.now() - v.at < MAX_AGE_MS ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Posição atual do celular. Usada só no aparelho, para calcular distâncias; não é enviada a nenhum serviço. */
export async function currentPosition(): Promise<LatLng> {
  const cached = lastKnownPosition();
  if (cached) return cached;
  let pos: { coords: { latitude: number; longitude: number } };
  if (isNative) {
    const perm = await Geolocation.checkPermissions().catch(() => null);
    if (perm?.location !== 'granted') {
      const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] }).catch(() => null);
      if (req?.location !== 'granted' && req?.coarseLocation !== 'granted') throw new LocationDenied('Sem permissão de localização. Libere nas configurações do Android para ver o que está perto.');
    }
    pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 });
  } else {
    if (!navigator.geolocation) throw new LocationDenied('Este navegador não informa a localização.');
    pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, (e) => rej(e.code === 1 ? new LocationDenied('Localização bloqueada no navegador.') : new Error('Não consegui pegar a localização.')), {
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: 120_000,
      }),
    );
  }
  const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    /* sem armazenamento: só não guarda */
  }
  return p;
}
