import { db, requestPersistentStorage } from '@/db/database';
import { builtinSegmentRows } from '@/db/defaults';
import { getSettings, saveSettings } from '@/repositories/settings';
import { applyTheme, getThemePreference } from '@/services/theme';
import type { Settings } from '@/types';
import { isNative } from './native';
import { initNativeTheme } from './nativeTheme';

export interface BootResult {
  settings: Settings;
}

/** Inicialização real: abre o banco (aplicando migrações), lê as configurações e sincroniza o tema. */
export async function boot(): Promise<BootResult> {
  if (typeof indexedDB === 'undefined') throw new Error('indexeddb-unavailable');
  await db.open();
  const builtins = builtinSegmentRows(new Date().toISOString());
  const existing = new Set(await db.segments.toCollection().primaryKeys());
  const toAdd = builtins.filter((s) => !existing.has(s.id));
  if (toAdd.length) await db.segments.bulkAdd(toAdd);
  const settings = await getSettings();
  const local = getThemePreference();
  if (settings.theme !== local) {
    // a preferência no aparelho (localStorage) é a que evita o "piscar"; o banco acompanha
    await saveSettings({ theme: local });
    settings.theme = local;
  }
  if (isNative) await initNativeTheme().catch(() => undefined);
  applyTheme(local);
  void requestPersistentStorage();
  return { settings };
}

export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  el.classList.add('done');
  window.setTimeout(() => el.remove(), 400);
}
