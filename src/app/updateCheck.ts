import { App } from '@capacitor/app';
import { CapacitorHttp } from '@capacitor/core';
import { getSettings, saveSettings } from '@/repositories/settings';
import { isNative } from './native';

export const RELEASES_API = 'https://api.github.com/repos/Eduardochimchek/precivora/releases/latest';
const DAY = 86_400_000;

export interface ReleaseInfo {
  version: string;
  apk: string;
  page: string;
}

/** Compara versões "1.0.23" (número a número). */
export function isNewer(candidate: string, current: string): boolean {
  const nums = (v: string) => v.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const a = nums(candidate);
  const b = nums(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

export function readRelease(data: unknown): ReleaseInfo | null {
  const r = data as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean; assets?: { name?: string; browser_download_url?: string }[] };
  if (!r?.tag_name || r.draft || r.prerelease) return null;
  const apk = r.assets?.find((a) => a.name?.endsWith('.apk'))?.browser_download_url;
  if (!apk || !r.html_url) return null;
  return { version: r.tag_name.replace(/^v/, ''), apk, page: r.html_url };
}

export async function appVersion(): Promise<string | undefined> {
  if (!isNative) return undefined;
  return (await App.getInfo()).version;
}

/** Ao abrir o app (no máximo uma vez por dia, se ligado): consulta a última versão publicada no GitHub. */
export async function maybeCheckUpdate(force = false): Promise<ReleaseInfo | null> {
  if (!isNative || !navigator.onLine) return null;
  const s = await getSettings();
  if (!s.updateCheck && !force) return null;
  if (!force && s.updateCheckedAt && Date.now() - Date.parse(s.updateCheckedAt) < DAY) return null;
  try {
    const res = await CapacitorHttp.get({ url: RELEASES_API, headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Precivora-app' }, connectTimeout: 10_000, readTimeout: 15_000 });
    if (res.status !== 200) return null;
    const rel = readRelease(typeof res.data === 'string' ? JSON.parse(res.data) : res.data);
    await saveSettings({ updateCheckedAt: new Date().toISOString(), updateLatest: rel ?? undefined });
    return rel;
  } catch {
    return null;
  }
}
