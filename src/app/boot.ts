import { db, requestPersistentStorage } from '@/db/database';
import { getSettings, saveSettings } from '@/repositories/settings';
import { applyTheme, getThemePreference } from '@/services/theme';
import type { Settings } from '@/types';

export interface BootResult {
  settings: Settings;
}

/** Inicialização real: abre o banco (aplicando migrações), lê as configurações e sincroniza o tema. */
export async function boot(): Promise<BootResult> {
  if (typeof indexedDB === 'undefined') throw new Error('indexeddb-unavailable');
  await db.open();
  const settings = await getSettings();
  const local = getThemePreference();
  if (settings.theme !== local) {
    // a preferência no aparelho (localStorage) é a que evita o "piscar"; o banco acompanha
    await saveSettings({ theme: local });
    settings.theme = local;
  }
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
