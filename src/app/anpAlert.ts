import { registerPlugin } from '@capacitor/core';
import { db } from '@/db/database';
import { getSettings } from '@/repositories/settings';
import { FUEL_LABEL, rankStations } from '@/services/fuel';
import { searchKey } from '@/utils/text';
import { isNative } from './native';

interface AnpAlertPlugin {
  configure(cfg: Record<string, unknown>): Promise<void>;
  checkNow(o?: { resetNotified?: boolean }): Promise<void>;
  takeRoute(): Promise<{ route?: string | null }>;
  notificationPermission(o?: { request?: boolean }): Promise<{ granted: boolean }>;
}

const AnpAlert = registerPlugin<AnpAlertPlugin>('AnpAlert');

/** Pede (ou só confere) a permissão de notificação do Android 13+. */
export async function notificationsAllowed(request = false): Promise<boolean> {
  if (!isNative) return false;
  return (await AnpAlert.notificationPermission({ request })).granted;
}

/**
 * Passa à conferência diária (nativa, roda com o app fechado) o que ela precisa: cidades e CNPJs dos seus postos,
 * combustíveis escolhidos, o menor preço atual de cada um e a última coleta já importada.
 */
export async function syncAnpAlert(): Promise<void> {
  if (!isNative) return;
  const s = await getSettings();
  const segments = await db.segments.toArray();
  const fuelSegs = new Set(segments.filter((x) => x.mode === 'fuel').map((x) => x.id));
  const stations = (await db.stores.toArray()).filter((p) => fuelSegs.has(p.segmentId) && p.active);
  const ids = new Set(stations.map((p) => p.id));
  const records = (await db.fuelPrices.toArray()).filter((r) => ids.has(r.stationId));
  const cityNames: Record<string, string> = {};
  for (const p of stations) if (p.city) cityNames[searchKey(p.city)] = p.city;
  const best: Record<string, number> = {};
  for (const f of s.anpAlertFuels) {
    const top = rankStations(records, f)[0];
    if (top) best[f] = top.record.price;
  }
  const lastCollection = (s.anpLatest ?? new Date(Date.now() - 7 * 86_400_000).toISOString()).slice(0, 10);
  await AnpAlert.configure({
    enabled: s.anpAlert,
    hour: s.anpAlertHour,
    wifiOnly: s.anpAlertWifi,
    fuels: s.anpAlertFuels,
    cities: Object.keys(cityNames),
    cityNames,
    cnpjs: stations.map((p) => p.cnpj).filter(Boolean),
    best,
    labels: FUEL_LABEL,
    lastCollection,
  }).catch(() => undefined);
}

/** Confere agora (para testar), mesmo que a coleta já tenha sido avisada. */
export const checkAnpAlertNow = () => AnpAlert.checkNow({ resetNotified: true });

/** Se o app abriu pela notificação, vai para Combustíveis e já importa a coleta nova. */
export async function openAlertRoute(): Promise<void> {
  if (!isNative) return;
  const { route } = await AnpAlert.takeRoute().catch(() => ({ route: null }));
  if (!route) return;
  window.location.hash = `#${route}`;
  if (route.includes('anp=1')) {
    const { updateAnpPrices } = await import('./anpNative');
    await updateAnpPrices().catch(() => undefined);
  }
}
