import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { setNativeSystemDark } from '@/services/theme';

interface SystemThemePlugin {
  get(): Promise<{ dark: boolean }>;
  addListener(event: 'change', cb: (s: { dark: boolean }) => void): Promise<PluginListenerHandle>;
}

const SystemTheme = registerPlugin<SystemThemePlugin>('SystemTheme');

export const SYSTEM_THEME_EVENT = 'precivora:system-theme';

/** No app Android, o modo escuro vem do sistema pelo plugin nativo, não do CSS do WebView. */
export async function initNativeTheme(): Promise<void> {
  const { dark } = await SystemTheme.get();
  setNativeSystemDark(dark);
  void SystemTheme.addListener('change', (s) => {
    setNativeSystemDark(s.dark);
    window.dispatchEvent(new Event(SYSTEM_THEME_EVENT));
  });
}
