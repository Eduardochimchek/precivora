import { CapacitorHttp } from '@capacitor/core';
import { ANP_URLS, parseAnpCsv, type AnpRow } from '@/services/anp';
import { applyAnpRows, type AnpResult } from '@/repositories/anp';
import { getSettings, saveSettings } from '@/repositories/settings';
import { isNative } from './native';

const AUTO_EVERY_MS = 2 * 24 * 60 * 60 * 1000;
export const ANP_UPDATED_EVENT = 'precivora:anp-updated';

function latin1FromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('windows-1252').decode(bytes);
}

async function download(url: string): Promise<string> {
  const res = await CapacitorHttp.get({ url, responseType: 'arraybuffer', connectTimeout: 30_000, readTimeout: 120_000 });
  if (res.status !== 200) throw new Error(`O site da ANP respondeu ${res.status}. Tente mais tarde.`);
  return typeof res.data === 'string' ? latin1FromBase64(res.data) : String(res.data);
}

let running: Promise<AnpResult> | null = null;

/** Baixa as últimas quatro semanas do levantamento da ANP e grava nos postos. Só no app (o site da ANP não libera leitura pelo navegador). */
export function updateAnpPrices(): Promise<AnpResult> {
  if (!isNative) return Promise.reject(new Error('A atualização pela ANP funciona no app Android.'));
  running ??= (async () => {
    try {
      const rows: AnpRow[] = [];
      for (const url of ANP_URLS) rows.push(...parseAnpCsv(await download(url)));
      const result = await applyAnpRows(rows);
      await saveSettings({ anpCheckedAt: new Date().toISOString(), anpLatest: result.latest });
      window.dispatchEvent(new CustomEvent(ANP_UPDATED_EVENT, { detail: result }));
      return result;
    } finally {
      running = null;
    }
  })();
  return running;
}

const onWifi = () => {
  const type = (navigator as Navigator & { connection?: { type?: string } }).connection?.type;
  return type === 'wifi' || type === 'ethernet';
};

/** Atualização automática: ligada nos ajustes, no Wi-Fi e no máximo a cada dois dias. Falhas ficam silenciosas. */
export async function maybeAutoUpdateAnp(): Promise<void> {
  if (!isNative || !navigator.onLine || !onWifi()) return;
  const s = await getSettings();
  if (!s.anpAuto) return;
  if (s.anpCheckedAt && Date.now() - Date.parse(s.anpCheckedAt) < AUTO_EVERY_MS) return;
  await updateAnpPrices().catch(() => undefined);
}
