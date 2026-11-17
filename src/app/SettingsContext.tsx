import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSettings, saveSettings, DEFAULT_SETTINGS } from '@/repositories/settings';
import { applyTheme, getThemePreference, setThemePreference } from '@/services/theme';
import type { Settings } from '@/types';
import { SYSTEM_THEME_EVENT } from './nativeTheme';

interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<SettingsApi | null>(null);

export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const live = useLiveQuery(getSettings, []);
  const settings = live ?? initial;
  const [, force] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (getThemePreference() === 'system') applyTheme('system', true);
      force((n) => n + 1);
    };
    mq.addEventListener('change', onChange);
    window.addEventListener(SYSTEM_THEME_EVENT, onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener(SYSTEM_THEME_EVENT, onChange);
    };
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    if (patch.theme) setThemePreference(patch.theme);
    await saveSettings(patch);
  }, []);

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsApi {
  const v = useContext(Ctx);
  if (!v) return { settings: DEFAULT_SETTINGS, update: async () => {} };
  return v;
}
