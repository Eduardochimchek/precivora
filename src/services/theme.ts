import type { ThemePreference } from '@/types';

const KEY = 'precivora:theme';
const COLORS = { light: '#F7F9FC', dark: '#0B1220' };

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export const systemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

/** Aplica o tema no <html>, na cor da barra de status (theme-color) e no estilo da barra do iOS. */
export function applyTheme(pref: ThemePreference, animate = false): 'light' | 'dark' {
  const theme = resolveTheme(pref);
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate && !reduce) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 350);
  }
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    m.setAttribute('content', COLORS[theme]);
    m.removeAttribute('media');
  });
  document
    .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', theme === 'dark' ? 'black' : 'default');
  return theme;
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* sem armazenamento: aplica só nesta sessão */
  }
  applyTheme(pref, true);
}
